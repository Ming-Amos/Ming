import { chromium, Browser, BrowserContext, Page, Locator } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { createHash } from "crypto";
import {
  AcceptancePlan,
  AcceptanceCriteria,
  CriteriaResult,
  StepResult,
  RunRecord,
  TargetConfig,
  RunStatus,
  CriteriaStatus,
  StepStatus,
} from "@ming/contracts";
import { computeFingerprint } from "./fingerprint";

export interface RunnerOptions {
  screenshotDir: string;
  runId: string;
  onCriteriaStart?: (criteriaId: string) => void;
  /** Optional callback fired after each criterion completes (for live progress). */
  onCriteriaComplete?: (criteriaId: string, status: CriteriaStatus, result: CriteriaResult) => void;
  onStepComplete?: (criteriaId: string, step: StepResult) => void;
  signal?: AbortSignal;
  deadlineMs?: number;
}

const ALLOWED_STEP_TYPES = new Set([
  "navigate",
  "fill",
  "click",
  "reload",
  "assertVisible",
  "assertVisibleIn",
  "assertNotVisible",
  "assertCount",
  "assertInputEnabled",
  "assertInputDisabled",
  "selectOption", "check", "uncheck", "assertValue", "assertUrl",
]);

// Required fields per step type (validated before execution)
const REQUIRED_FIELDS: Record<string, string[]> = {
  navigate: ["url"],
  fill: ["locator", "value"],
  click: ["locator"],
  reload: [],
  assertVisible: ["value"],
  assertVisibleIn: ["locator", "value"],
  assertNotVisible: ["value"],
  assertCount: ["locator"],
  assertInputEnabled: ["locator"],
  assertInputDisabled: ["locator"],
  selectOption: ["locator", "value"], check: ["locator"], uncheck: ["locator"],
  assertValue: ["locator", "value"], assertUrl: ["value"],
};

// ── 计划结构深度校验 ──────────────────────────────────────────────
function validatePlan(plan: AcceptancePlan): void {
  if (!plan.planId || typeof plan.planId !== "string") {
    throw new Error("Invalid plan: planId is required");
  }
  if (!Array.isArray(plan.criteria) || plan.criteria.length === 0) {
    throw new Error("Invalid plan: criteria must be a non-empty array");
  }
  if (plan.criteria.length > 20 || plan.criteria.reduce((n, c) => n + (Array.isArray(c.steps) ? c.steps.length : 0), 0) > 120) {
    throw new Error("A run supports up to 20 criteria and 120 steps. Split this acceptance scope into smaller plans.");
  }

  const seenCriteriaIds = new Set<string>();

  for (const c of plan.criteria) {
    if (!c.id || typeof c.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(c.id)) {
      throw new Error("A criterion is missing a valid ID");
    }
    if (seenCriteriaIds.has(c.id)) {
      throw new Error(`Duplicate criterion ID: "${c.id}"`);
    }
    seenCriteriaIds.add(c.id);

    if (!Array.isArray(c.steps) || c.steps.length === 0) {
      throw new Error(`Criterion "${c.id}": steps must be a non-empty array`);
    }

    const seenStepIds = new Set<string>();
    for (const s of c.steps) {
      if (!s.id || typeof s.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(s.id)) {
        throw new Error(`Criterion "${c.id}" contains a step without a valid ID`);
      }
      if (seenStepIds.has(s.id)) {
        throw new Error(`Duplicate step ID "${s.id}" in criterion "${c.id}"`);
      }
      seenStepIds.add(s.id);

      if (!ALLOWED_STEP_TYPES.has(s.type)) {
        throw new Error(`Step "${s.id}" uses unsupported type "${s.type}"; execution refused`);
      }

      // Validate required fields per step type
      for (const field of REQUIRED_FIELDS[s.type] ?? []) {
        const val = (s as unknown as Record<string, unknown>)[field];
        if (val === undefined || val === null) {
          throw new Error(`Step "${s.id}" (${s.type}) is missing required field "${field}"`);
        }
      }

      // assertCount: expected must be a proper integer literal without coercion
      if (s.type === "assertCount") {
        const exp = s.expected;
        if (exp === undefined || exp === null) {
          throw new Error(`Step "${s.id}" (assertCount) is missing expected`);
        }
        // Must be a number type (not string) and a non-negative integer — "2oops" must fail
        if (typeof exp !== "number") {
          throw new Error(
            `Step "${s.id}" (assertCount): expected must be a number, not a string (received: ${JSON.stringify(exp)})`
          );
        }
        if (!Number.isInteger(exp) || exp < 0) {
          throw new Error(
            `Step "${s.id}" (assertCount): expected must be a non-negative integer (received: ${exp})`
          );
        }
      }

      // Disallow arbitrary script execution fields
      const sAsRecord = s as unknown as Record<string, unknown>;
      if (
        sAsRecord["script"] !== undefined ||
        sAsRecord["eval"] !== undefined
      ) {
        throw new Error(`Step "${s.id}" contains a prohibited script/eval field`);
      }

      // Disallow unknown fields beyond the declared PlanStep interface
      const KNOWN_STEP_KEYS = new Set([
        "id", "type", "locator", "value", "url", "expected", "description",
      ]);
      for (const key of Object.keys(sAsRecord)) {
        if (!KNOWN_STEP_KEYS.has(key)) {
          throw new Error(`Step "${s.id}" contains unknown field "${key}"; execution refused`);
        }
      }
    }

    // Each executable criterion must have at least one assertion step
    const ASSERTION_TYPES = new Set([
      "assertVisible", "assertVisibleIn", "assertNotVisible",
      "assertCount", "assertInputEnabled", "assertInputDisabled", "assertValue", "assertUrl",
    ]);
    const hasAssertion = c.steps.some((s) => ASSERTION_TYPES.has(s.type));
    if (!hasAssertion) {
      throw new Error(`Criterion "${c.id}" has no assertion steps and cannot verify expected behavior`);
    }
  }

  // Validate dependency references (only backward references are allowed)
  const orderedIds: string[] = [];
  for (const c of plan.criteria) {
    for (const dep of c.dependsOn ?? []) {
      if (!orderedIds.includes(dep)) {
        throw new Error(
          `Criterion "${c.id}" depends on "${dep}", which is missing or appears later; forward or circular dependencies are not supported`
        );
      }
    }
    orderedIds.push(c.id);
  }
}

// ── 变量解析检查（用于生成计划提交前校验） ────────────────────────
const KNOWN_TEMPLATE_VARS = new Set(["TARGET_URL", "UNIQUE_CONTENT"]);

/** 从字符串中提取所有 {{VAR}} 变量名 */
function extractTemplateVars(value: string | undefined): string[] {
  if (!value) return [];
  const matches = [...value.matchAll(/\{\{(\w+)\}\}/g)];
  return matches.map((m) => m[1]);
}

/**
 * 校验计划中的所有模板变量均在 KNOWN_TEMPLATE_VARS 中。
 * 未知变量会阻止执行。
 */
export function validateTemplateVars(plan: AcceptancePlan): string[] {
  const errors: string[] = [];
  for (const c of plan.criteria) {
    for (const s of c.steps) {
      for (const varName of [
        ...extractTemplateVars(s.url),
        ...extractTemplateVars(s.value),
        ...extractTemplateVars(s.locator),
      ]) {
        if (!KNOWN_TEMPLATE_VARS.has(varName)) {
          errors.push(
            `Step "${s.id}" references unknown template variable {{${varName}}}; resolve it before running`
          );
        }
      }
    }
  }
  return errors;
}

// ── 模板变量替换 ──────────────────────────────────────────────────
function resolveTemplate(value: string | undefined, vars: Record<string, string>): string {
  if (value === undefined) return "";
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ── 截图 ──────────────────────────────────────────────────────────
async function takeScreenshot(
  page: Page,
  screenshotDir: string,
  runId: string,
  criteriaId: string,
  stepId: string,
  label: string
): Promise<string | undefined> {
  try {
    // Step IDs are scoped to a criterion. Include both lengths so even IDs with
    // underscores cannot collide with another criterion/step pair.
    const filename = `${runId}_c${criteriaId.length}_${criteriaId}_s${stepId.length}_${stepId}_${label}`.replace(/[^A-Za-z0-9_-]/g, "_") + ".png";
    const fullPath = path.join(screenshotDir, filename);
    await page.screenshot({ path: fullPath, fullPage: false, timeout: 4000,
      mask: [page.locator('input[type="password"], input[name*="token" i], input[name*="api_key" i], input[name*="secret" i]')] });
    return filename;
  } catch {
    return undefined;
  }
}

// ── 单步执行 ─────────────────────────────────────────────────────
function safeMessage(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, "").replace(/\b(?:Bearer\s+|sk-[a-zA-Z0-9_-]{8,})[^\s"'<>]*/gi, "[REDACTED]")
    .replace(/((?:api[_-]?key|password|secret|token)["']?\s*[=:]\s*["']?)[^\s,;"'<>]+/gi, "$1[REDACTED]")
    .replace(/https?:\/\/[^\s"'<>]+/g, value => { try { const u = new URL(value); return u.origin + u.pathname; } catch { return "[URL]"; } })
    .slice(0, 1200);
}
async function actionLocator(page: Page, value: string, mode: "fill" | "click" | "input" = "input"): Promise<Locator> {
  if (value.startsWith("css=")) return page.locator(value.slice(4));
  if (mode === "click") {
    const button = page.getByRole("button", { name: value, exact: true });
    if (await button.count()) return button;
    const link = page.getByRole("link", { name: value, exact: true });
    if (await link.count()) return link;
  }
  const label = page.getByLabel(value, { exact: true });
  if (await label.count()) return label;
  const partial = page.getByLabel(value, { exact: false });
  const count = await partial.count();
  if (count === 1) return partial;
  if (count > 1) throw new Error(`Multiple controls match "${value}". Use a more specific accessible name or a css= locator`);
  const button = page.getByRole("button", { name: value, exact: true });
  if (await button.count()) return button;
  throw new Error(`Control "${value}" was not found. Check its accessible name or use a css= locator`);
}
async function eventually(check: () => Promise<boolean>): Promise<boolean> {
  const until = Date.now() + 2500;
  do { if (await check()) return true; await new Promise(resolve => setTimeout(resolve, 100)); } while (Date.now() < until);
  return false;
}
async function executeStep(
  page: Page,
  step: AcceptanceCriteria["steps"][0],
  vars: Record<string, string>,
  screenshotDir: string,
  runId: string,
  criteriaId: string
): Promise<StepResult> {
  const start = Date.now();
  const result: StepResult = {
    stepId: step.id,
    description: step.description,
    status: "running",
    expected: step.expected,
  };

  try {
    switch (step.type) {
      case "navigate": {
        const url = resolveTemplate(step.url, vars);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        result.actual = `Navigated to ${url}`;
        result.status = "passed";
        break;
      }

      case "fill": {
        const locator = resolveTemplate(step.locator, vars);
        const value = resolveTemplate(step.value, vars);
        const el = await actionLocator(page, locator, "fill");
        if (await el.count() === 0) throw new Error(`No element has the accessible name "${locator}"`);
        await el.fill(value);
        result.actual = `Entered text (${value.length} characters)`;
        result.status = "passed";
        break;
      }

      case "click": {
        const locator = resolveTemplate(step.locator, vars);
        const el = await actionLocator(page, locator, "click");
        if (await el.count() === 0) throw new Error(`Clickable element "${locator}" was not found`);
        await el.click();
        result.actual = `Clicked "${locator}"`;
        result.status = "passed";
        break;
      }

      case "reload": {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
        result.actual = "Page reloaded";
        result.status = "passed";
        break;
      }

      case "assertVisible": {
        const text = resolveTemplate(step.value, vars);
        const visible = await eventually(() => page.getByText(text, { exact: false }).isVisible());
        result.actual = visible ? `Text "${text}" is visible` : `Text "${text}" is not visible`;
        result.expected = text;
        result.status = visible ? "passed" : "failed";
        if (!visible) result.error = `Expected text "${text}" to be visible, but it was not found on the page`;
        break;
      }

      case "assertVisibleIn": {
        // Text must be visible within a scoped CSS selector (e.g. the record list only)
        const scopeLocator = resolveTemplate(step.locator, vars);
        const text = resolveTemplate(step.value, vars);
        const scope = page.locator(scopeLocator);
        if (await scope.count() === 0) {
          result.status = "error";
          result.error = `Scope "${scopeLocator}" does not exist`;
          result.actual = `Could not find "${scopeLocator}"`;
          break;
        }
        const visible = await eventually(() => scope.getByText(text, { exact: false }).isVisible());
        result.actual = visible
          ? `Text "${text}" is visible within "${scopeLocator}"`
          : `Text "${text}" is not visible within "${scopeLocator}"`;
        result.expected = text;
        result.status = visible ? "passed" : "failed";
        if (!visible) {
          result.error = `Expected text "${text}" within "${scopeLocator}" to be visible, but it was not found`;
        }
        break;
      }

      case "assertNotVisible": {
        const text = resolveTemplate(step.value, vars);
        const visible = !await eventually(async () => !(await page.getByText(text, { exact: false }).isVisible()));
        result.actual = visible ? `Text "${text}" is still visible` : `Text "${text}" is not visible`;
        result.expected = `"${text}" is not visible`;
        result.status = visible ? "failed" : "passed";
        if (visible) result.error = `Expected text "${text}" to be hidden, but it is still visible`;
        break;
      }

      case "assertCount": {
        const locator = resolveTemplate(step.locator, vars);
        const expected =
          typeof step.expected === "number"
            ? step.expected
            : parseInt(String(step.expected), 10);
        let count = 0;
        await eventually(async () => { count = await page.locator(locator).count(); return count === expected; });
        result.actual = String(count);
        result.expected = expected;
        result.status = count === expected ? "passed" : "failed";
        if (count !== expected) {
          result.error = `Expected ${expected} matches for "${locator}"; found ${count}`;
        }
        break;
      }

      case "assertInputEnabled": {
        const locator = resolveTemplate(step.locator, vars);
        const el = await actionLocator(page, locator);
        const enabled = await eventually(() => el.isEnabled());
        result.actual = enabled ? "Enabled" : "Disabled";
        result.status = enabled ? "passed" : "failed";
        if (!enabled) result.error = `Expected control "${locator}" to be enabled; it is disabled`;
        break;
      }

      case "assertInputDisabled": {
        const locator = resolveTemplate(step.locator, vars);
        const el = await actionLocator(page, locator);
        const disabled = await eventually(() => el.isDisabled());
        result.actual = disabled ? "Disabled" : "Enabled";
        result.status = disabled ? "passed" : "failed";
        if (!disabled) result.error = `Expected control "${locator}" to be disabled; it is enabled`;
        break;
      }
      case "selectOption": case "check": case "uncheck": {
        const el = await actionLocator(page, resolveTemplate(step.locator, vars));
        if (step.type === "selectOption") await el.selectOption(resolveTemplate(step.value, vars));
        else await el.setChecked(step.type === "check");
        result.status = "passed"; result.actual = "Page action completed"; break;
      }
      case "assertValue": {
        const el = await actionLocator(page, resolveTemplate(step.locator, vars));
        const expected = resolveTemplate(step.value, vars);
        let actual = "";
        const passed = await eventually(async () => { actual = await el.inputValue(); return actual === expected; });
        result.status = passed ? "passed" : "failed"; result.expected = expected; result.actual = actual;
        if (!passed) result.error = "The input value does not match the acceptance criterion"; break;
      }
      case "assertUrl": {
        const expected = resolveTemplate(step.value, vars);
        const passed = await eventually(async () => expected.startsWith("/") ? new URL(page.url()).pathname === expected : page.url() === expected);
        result.status = passed ? "passed" : "failed"; result.expected = expected; result.actual = page.url();
        if (!passed) result.error = "The current page URL does not match the acceptance criterion"; break;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.status = "error";
    result.error = message;
    result.actual = `Execution error: ${message}`;
  }

  result.durationMs = Date.now() - start;
  if (result.actual) result.actual = safeMessage(result.actual);
  if (result.error) result.error = safeMessage(result.error);
  if (typeof result.expected === "string") result.expected = safeMessage(result.expected);

  // Screenshot on failure or error
  if (result.status === "failed" || result.status === "error") {
    result.screenshotPath = await takeScreenshot(
      page, screenshotDir, runId, criteriaId, step.id, result.status
    );
  }

  return result;
}

// ── Live context hand-off outcome ────────────────────────────────
interface CriteriaRunOutcome {
  result: CriteriaResult;
  /**
   * Live browser context+page to hand to the next criterion if it declares
   * contextMode="inherit". The caller is responsible for closing it when no
   * longer needed.
   */
  liveContext?: { context: BrowserContext; page: Page };
}

// ── 单条标准执行 ─────────────────────────────────────────────────
async function runCriteriaWithContext(
  browser: Browser,
  criteria: AcceptanceCriteria,
  vars: Record<string, string>,
  screenshotDir: string,
  runId: string,
  dependencyFailed: boolean,
  inheritedContext?: { context: BrowserContext; page: Page },
  target?: TargetConfig,
  lifecycle?: { stopReason: () => string | undefined; diagnostics: NonNullable<RunRecord["diagnostics"]>; onStepComplete?: RunnerOptions["onStepComplete"] }
): Promise<CriteriaRunOutcome> {
  if (dependencyFailed) {
    return {
      result: {
        criteriaId: criteria.id,
        title: criteria.title,
        status: "blocked",
        blockedReason: `Prerequisites ${criteria.dependsOn?.join(", ")} did not pass; this criterion was skipped`,
        steps: criteria.steps.map((s) => ({
          stepId: s.id,
          description: s.description,
          status: "skipped" as StepStatus,
        })),
      },
    };
  }

  const contextMode = criteria.contextMode ?? "fresh";
  let context: BrowserContext;
  let page: Page;
  let weOwnContext = false;

  if (contextMode === "inherit" && inheritedContext) {
    // Reuse the caller-provided context (e.g. AC-02 continues in AC-01's browser)
    context = inheritedContext.context;
    page = inheritedContext.page;
  } else {
    // Fresh isolated context
    context = await browser.newContext({ storageState: undefined, serviceWorkers: "block" });
    context.setDefaultTimeout(5000);
    context.setDefaultNavigationTimeout(15000);
    if (target) {
      const documentUrl = new URL(target.url); documentUrl.hash = "";
      await context.route("**/*", async route => {
        const request = route.request(); const url = new URL(request.url());
        if (url.origin !== documentUrl.origin || !["http:", "https:"].includes(url.protocol)) return route.abort("blockedbyclient");
        if (target.htmlSnapshot !== undefined) {
          if (url.href === documentUrl.href && request.isNavigationRequest()) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: target.htmlSnapshot });
          return route.abort("blockedbyclient");
        }
        try {
          // Browser redirect chains can bypass a routing handler. Inspect the
          // first response without following redirects, rather than sending a
          // second probe that could repeat an application mutation.
          const response = await route.fetch({ maxRedirects: 0, timeout: 15000 });
          if (response.status() >= 300 && response.status() < 400 && response.status() !== 304) {
            if (lifecycle && lifecycle.diagnostics.length < 80) lifecycle.diagnostics.push({ kind: "network", message: "HTTP redirect blocked. Connect the final local page URL; this runner does not follow server redirects.", status: response.status(), url: url.origin + url.pathname, at: new Date().toISOString() });
            return route.abort("blockedbyresponse");
          }
          await route.fulfill({ response });
        } catch { await route.abort("failed").catch(() => undefined); }
      });
      // Vite/local development sockets remain available; external sockets do not.
      await context.routeWebSocket("**/*", socket => {
        const url = new URL(socket.url());
        if (target.htmlSnapshot === undefined && url.host === documentUrl.host && ["ws:", "wss:"].includes(url.protocol)) socket.connectToServer();
        else socket.close();
      });
    }
    page = await context.newPage();
    const addDiagnostic = (entry: Omit<NonNullable<RunRecord["diagnostics"]>[number], "at">) => {
      if (lifecycle && lifecycle.diagnostics.length < 80) lifecycle.diagnostics.push({ ...entry, message: safeMessage(entry.message), at: new Date().toISOString() });
    };
    page.on("console", message => { if (["error", "warning"].includes(message.type())) addDiagnostic({ kind: "console", level: message.type(), message: message.text() }); });
    page.on("pageerror", error => addDiagnostic({ kind: "pageerror", message: error.message }));
    page.on("response", response => { if (response.status() >= 400) { const url = new URL(response.url()); addDiagnostic({ kind: "network", message: `HTTP ${response.status()}`, url: url.origin + url.pathname, status: response.status() }); } });
    page.on("requestfailed", request => { try { const url = new URL(request.url()); addDiagnostic({ kind: "network", message: request.failure()?.errorText || "Request failed", url: url.origin + url.pathname }); } catch { /* Ignore non-URL browser internals. */ } });
    weOwnContext = true;
  }

  const stepResults: StepResult[] = [];
  let criteriaStatus: CriteriaStatus = "passed";
  let blockedReason: string | undefined;

  try {
    for (const step of criteria.steps) {
      if (lifecycle?.stopReason()) throw new Error(lifecycle.stopReason());
      const stepResult = await executeStep(page, step, vars, screenshotDir, runId, criteria.id);
      stepResults.push(stepResult);
      lifecycle?.onStepComplete?.(criteria.id, stepResult);

      if (stepResult.status === "failed" || stepResult.status === "error") {
        const shot = await takeScreenshot(page, screenshotDir, runId, criteria.id, step.id, "failure_scene");
        if (shot && !stepResult.screenshotPath) stepResult.screenshotPath = shot;
        criteriaStatus = stepResult.status === "failed" ? "failed" : "error";
        // Mark remaining steps as skipped
        const failIdx = criteria.steps.indexOf(step);
        for (let i = failIdx + 1; i < criteria.steps.length; i++) {
          stepResults.push({
            stepId: criteria.steps[i].id,
            description: criteria.steps[i].description,
            status: "skipped",
          });
        }
        break;
      }
    }

    // Final state screenshot attached to last step
    const finalShot = await takeScreenshot(page, screenshotDir, runId, criteria.id, criteria.id, "final");
    if (finalShot && stepResults.length > 0) {
      const last = [...stepResults].reverse().find(step => step.status !== "skipped");
      if (last && !last.screenshotPath) last.screenshotPath = finalShot;
    }
  } catch (error) {
    // Cancellation may happen between steps, after a real action completed.
    // Preserve those observations instead of replacing the whole criterion
    // with an unexecuted placeholder in the outer run error handler.
    criteriaStatus = "error";
    blockedReason = lifecycle?.stopReason() ?? safeMessage(error instanceof Error ? error.message : String(error));
    for (const step of criteria.steps.slice(stepResults.length)) {
      stepResults.push({ stepId: step.id, description: step.description, status: "skipped" });
    }
  } finally {
    // If we own the context and it failed, close it now (no point passing it on)
    if (weOwnContext && criteriaStatus !== "passed") {
      await context.close().catch(() => undefined);
      weOwnContext = false;
    }
  }

  const result: CriteriaResult = {
    criteriaId: criteria.id,
    title: criteria.title,
    status: criteriaStatus,
    blockedReason,
    steps: stepResults,
  };

  // Surface the live context when the criterion passed, regardless of whether we created it
  // or received it via inherit.  The caller decides whether to close it or pass it on.
  // If we own a failed context it was already closed above, so criteriaStatus check suffices.
  const liveContext =
    criteriaStatus === "passed" ? { context, page } : undefined;

  return { result, liveContext };
}

// ── Runner 自身指纹（plan-runner 实现版本，防止混用不同版本） ──────
function computeRunnerFingerprint(): string {
  try {
    const src = fs.readFileSync(__filename, "utf-8") + fs.readFileSync(require.resolve("./fingerprint"), "utf-8");
    return createHash("sha256").update(src, "utf-8").digest("hex").slice(0, 16);
  } catch {
    return "unknown";
  }
}

const RUNNER_FINGERPRINT = computeRunnerFingerprint();

// ── 主执行器 ─────────────────────────────────────────────────────
export class PlanRunner {
  constructor(private opts: RunnerOptions) {
    fs.mkdirSync(opts.screenshotDir, { recursive: true });
  }

  async run(
    plan: AcceptancePlan,
    target: TargetConfig,
    uniqueContent: string
  ): Promise<RunRecord> {
    // Validate plan structure BEFORE launching a browser or assigning a runId result
    validatePlan(plan);
    if (target.htmlSnapshot !== undefined && computeFingerprint(target.htmlSnapshot) !== target.fingerprint) {
      throw new Error("Captured HTML does not match the expected target fingerprint");
    }

    const startedAt = new Date().toISOString();
    // Hash the whole plan (computeFingerprint excludes the "fingerprint" key itself)
    const planFingerprint = computeFingerprint(plan);

    const vars: Record<string, string> = {
      TARGET_URL: target.url,
      UNIQUE_CONTENT: uniqueContent,
    };

    let browser: Browser | null = null;
    const criteriaResults: CriteriaResult[] = [];
    let fatalError: string | undefined;
    let terminationReason: RunRecord["terminationReason"];
    const diagnostics: NonNullable<RunRecord["diagnostics"]> = [];
    const stopReason = () => terminationReason === "cancelled" ? "Acceptance run cancelled. Unexecuted steps are not marked as passed." : terminationReason === "deadline" ? "Acceptance run timed out. Reduce the scope or check the page response before retrying." : undefined;
    const abort = () => { terminationReason = terminationReason ?? "cancelled"; void browser?.close().catch(() => undefined); };
    this.opts.signal?.addEventListener("abort", abort, { once: true });
    if (this.opts.signal?.aborted) abort();
    const timeoutMs = Math.min(180000, Math.max(1000, this.opts.deadlineMs ?? 120000));
    const deadline = setTimeout(() => { terminationReason = "deadline"; void browser?.close().catch(() => undefined); }, timeoutMs);

    try {
      if (stopReason()) throw new Error(stopReason());
      browser = await chromium.launch({ headless: true });
      if (stopReason()) throw new Error(stopReason());

      const passedIds = new Set<string>();
      let liveContextForNext: { context: BrowserContext; page: Page } | undefined;

      for (let i = 0; i < plan.criteria.length; i++) {
        if (stopReason()) throw new Error(stopReason());
        const criteria = plan.criteria[i];
        this.opts.onCriteriaStart?.(criteria.id);

        const depFailed =
          criteria.dependsOn != null &&
          criteria.dependsOn.some((dep) => !passedIds.has(dep));

        const nextCriteria = plan.criteria[i + 1];
        const nextWantsInherit = nextCriteria?.contextMode === "inherit";

        const passedInContext = liveContextForNext;
        const outcome = await runCriteriaWithContext(
          browser,
          criteria,
          vars,
          this.opts.screenshotDir,
          this.opts.runId,
          depFailed,
          passedInContext,
          target,
          { stopReason, diagnostics, onStepComplete: this.opts.onStepComplete }
        );

        criteriaResults.push(outcome.result);
        this.opts.onCriteriaComplete?.(criteria.id, outcome.result.status, outcome.result);

        if (outcome.result.status === "passed") {
          passedIds.add(criteria.id);
        }

        // Context hand-off: pass liveContext to next criterion only if it wants it.
        // If the criterion failed while using an inherited context, the context was not
        // returned — close the one we passed in so it is not leaked.
        if (outcome.liveContext) {
          if (nextWantsInherit) {
            liveContextForNext = outcome.liveContext;
          } else {
            await outcome.liveContext.context.close();
            liveContextForNext = undefined;
          }
        } else {
          // No live context returned (failed, or fresh-that-failed, or blocked)
          // If we passed an inherited context in and it wasn't returned, close it explicitly
          if (passedInContext && criteria.contextMode === "inherit") {
            await passedInContext.context.close();
          }
          liveContextForNext = undefined;
        }
      }

      // Close any still-open live context (e.g. last criterion passed with no successor)
      if (liveContextForNext) {
        await liveContextForNext.context.close();
      }
    } catch (err: unknown) {
      fatalError = stopReason() ?? safeMessage(err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(deadline);
      this.opts.signal?.removeEventListener("abort", abort);
      if (browser) {
        try { await browser.close(); }
        catch (err) { fatalError = fatalError ?? (err instanceof Error ? err.message : String(err)); }
      }
    }
    if (stopReason()) fatalError = stopReason();

    const finishedAt = new Date().toISOString();

    // Build final criteria list; any criterion not reached is marked not_run
    const finalCriteria: CriteriaResult[] = plan.criteria.map((c, i) => {
      if (i < criteriaResults.length) return criteriaResults[i];
      return {
        criteriaId: c.id,
        title: c.title,
        status: "not_run" as CriteriaStatus,
        blockedReason: fatalError
          ? `Fatal error before execution: ${fatalError}`
          : "This criterion was not reached",
        steps: c.steps.map((s) => ({
          stepId: s.id,
          description: s.description,
          status: "skipped" as StepStatus,
        })),
      };
    });

    let overallStatus: RunStatus = "passed";
    if (fatalError) {
      overallStatus = "error";
    } else {
      for (const r of finalCriteria) {
        if (r.status === "failed") { overallStatus = "failed"; break; }
        if (r.status === "error") { overallStatus = "error"; break; }
      }
    }

    return {
      runId: this.opts.runId,
      planId: plan.planId,
      planVersion: plan.version,
      planFingerprint,
      targetVariant: target.variant,
      targetUrl: target.url,
      targetFingerprint: target.fingerprint,
      status: overallStatus,
      startedAt,
      finishedAt,
      criteria: finalCriteria,
      fatalError,
      runnerFingerprint: RUNNER_FINGERPRINT,
      planSnapshot: JSON.parse(JSON.stringify(plan)) as AcceptancePlan,
      sourceBinding: target.htmlSnapshot !== undefined ? "self-contained-html-snapshot" : "live-url-observed",
      terminationReason,
      diagnostics,
    };
  }
}
