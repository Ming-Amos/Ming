import { chromium, Browser, BrowserContext, Page } from "playwright";
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
  /** Optional callback fired after each criterion completes (for live progress). */
  onCriteriaComplete?: (criteriaId: string, status: CriteriaStatus) => void;
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
};

// ── 计划结构深度校验 ──────────────────────────────────────────────
function validatePlan(plan: AcceptancePlan): void {
  if (!plan.planId || typeof plan.planId !== "string") {
    throw new Error("计划结构无效：planId 缺失");
  }
  if (!Array.isArray(plan.criteria) || plan.criteria.length === 0) {
    throw new Error("计划结构无效：criteria 为空或不是数组");
  }

  const seenCriteriaIds = new Set<string>();

  for (const c of plan.criteria) {
    if (!c.id || typeof c.id !== "string") {
      throw new Error("criteria 缺少有效 id");
    }
    if (seenCriteriaIds.has(c.id)) {
      throw new Error(`criteria id "${c.id}" 重复`);
    }
    seenCriteriaIds.add(c.id);

    if (!Array.isArray(c.steps) || c.steps.length === 0) {
      throw new Error(`criteria "${c.id}"：steps 为空或不是数组`);
    }

    const seenStepIds = new Set<string>();
    for (const s of c.steps) {
      if (!s.id || typeof s.id !== "string") {
        throw new Error(`criteria "${c.id}" 包含没有有效 id 的步骤`);
      }
      if (seenStepIds.has(s.id)) {
        throw new Error(`步骤 id "${s.id}" 在 criteria "${c.id}" 中重复`);
      }
      seenStepIds.add(s.id);

      if (!ALLOWED_STEP_TYPES.has(s.type)) {
        throw new Error(`步骤 "${s.id}" 类型 "${s.type}" 未注册，拒绝执行`);
      }

      // Validate required fields per step type
      for (const field of REQUIRED_FIELDS[s.type] ?? []) {
        const val = (s as unknown as Record<string, unknown>)[field];
        if (val === undefined || val === null) {
          throw new Error(`步骤 "${s.id}" (${s.type}) 缺少必填字段 "${field}"`);
        }
      }

      // assertCount: expected must be a proper integer literal without coercion
      if (s.type === "assertCount") {
        const exp = s.expected;
        if (exp === undefined || exp === null) {
          throw new Error(`步骤 "${s.id}" (assertCount) 缺少 expected 字段`);
        }
        // Must be a number type (not string) and a non-negative integer — "2oops" must fail
        if (typeof exp !== "number") {
          throw new Error(
            `步骤 "${s.id}" (assertCount) expected 必须是数字类型，不接受字符串（得到：${JSON.stringify(exp)}）`
          );
        }
        if (!Number.isInteger(exp) || exp < 0) {
          throw new Error(
            `步骤 "${s.id}" (assertCount) expected 必须是非负整数，得到：${exp}`
          );
        }
      }

      // Disallow arbitrary script execution fields
      const sAsRecord = s as unknown as Record<string, unknown>;
      if (
        sAsRecord["script"] !== undefined ||
        sAsRecord["eval"] !== undefined
      ) {
        throw new Error(`步骤 "${s.id}" 包含禁止字段 script/eval`);
      }

      // Disallow unknown fields beyond the declared PlanStep interface
      const KNOWN_STEP_KEYS = new Set([
        "id", "type", "locator", "value", "url", "expected", "description",
      ]);
      for (const key of Object.keys(sAsRecord)) {
        if (!KNOWN_STEP_KEYS.has(key)) {
          throw new Error(`步骤 "${s.id}" 包含未知字段 "${key}"，拒绝执行`);
        }
      }
    }

    // Each executable criterion must have at least one assertion step
    const ASSERTION_TYPES = new Set([
      "assertVisible", "assertVisibleIn", "assertNotVisible",
      "assertCount", "assertInputEnabled", "assertInputDisabled",
    ]);
    const hasAssertion = c.steps.some((s) => ASSERTION_TYPES.has(s.type));
    if (!hasAssertion) {
      throw new Error(`criteria "${c.id}" 没有任何断言步骤，无法验证预期行为`);
    }
  }

  // Validate dependency references (only backward references are allowed)
  const orderedIds: string[] = [];
  for (const c of plan.criteria) {
    for (const dep of c.dependsOn ?? []) {
      if (!orderedIds.includes(dep)) {
        throw new Error(
          `criteria "${c.id}" 依赖 "${dep}"，但 "${dep}" 不存在或出现在后面（不支持后向/循环依赖）`
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
            `步骤 "${s.id}" 引用未知模板变量 {{${varName}}}，执行前必须解析`
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
  stepId: string,
  label: string
): Promise<string | undefined> {
  try {
    const filename = `${runId}_${stepId}_${label}.png`;
    const fullPath = path.join(screenshotDir, filename);
    await page.screenshot({ path: fullPath, fullPage: false });
    return filename;
  } catch {
    return undefined;
  }
}

// ── 单步执行 ─────────────────────────────────────────────────────
async function executeStep(
  page: Page,
  step: AcceptanceCriteria["steps"][0],
  vars: Record<string, string>,
  screenshotDir: string,
  runId: string
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
        result.actual = `已导航到 ${url}`;
        result.status = "passed";
        break;
      }

      case "fill": {
        const locator = resolveTemplate(step.locator, vars);
        const value = resolveTemplate(step.value, vars);
        const el = page.getByLabel(locator);
        if (await el.count() === 0) throw new Error(`找不到可访问名称为 "${locator}" 的元素`);
        await el.fill(value);
        result.actual = `已填入内容（长度=${value.length}）`;
        result.status = "passed";
        break;
      }

      case "click": {
        const locator = resolveTemplate(step.locator, vars);
        let el = page.getByRole("button", { name: locator });
        if (await el.count() === 0) el = page.getByLabel(locator);
        if (await el.count() === 0) throw new Error(`找不到可点击元素 "${locator}"`);
        await el.click();
        result.actual = `已点击 "${locator}"`;
        result.status = "passed";
        break;
      }

      case "reload": {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
        result.actual = "页面已刷新";
        result.status = "passed";
        break;
      }

      case "assertVisible": {
        const text = resolveTemplate(step.value, vars);
        const visible = await page.getByText(text, { exact: false }).isVisible();
        result.actual = visible ? `文本 "${text}" 可见` : `文本 "${text}" 不可见`;
        result.expected = text;
        result.status = visible ? "passed" : "failed";
        if (!visible) result.error = `预期文本 "${text}" 可见，但页面上未找到`;
        break;
      }

      case "assertVisibleIn": {
        // Text must be visible within a scoped CSS selector (e.g. the record list only)
        const scopeLocator = resolveTemplate(step.locator, vars);
        const text = resolveTemplate(step.value, vars);
        const scope = page.locator(scopeLocator);
        if (await scope.count() === 0) {
          result.status = "error";
          result.error = `作用域 "${scopeLocator}" 不存在`;
          result.actual = `找不到 "${scopeLocator}"`;
          break;
        }
        const visible = await scope.getByText(text, { exact: false }).isVisible();
        result.actual = visible
          ? `文本 "${text}" 在 "${scopeLocator}" 中可见`
          : `文本 "${text}" 在 "${scopeLocator}" 中不可见`;
        result.expected = text;
        result.status = visible ? "passed" : "failed";
        if (!visible) {
          result.error = `预期 "${scopeLocator}" 内文本 "${text}" 可见，但未找到`;
        }
        break;
      }

      case "assertNotVisible": {
        const text = resolveTemplate(step.value, vars);
        const visible = await page.getByText(text, { exact: false }).isVisible();
        result.actual = visible ? `文本 "${text}" 仍可见` : `文本 "${text}" 不可见`;
        result.expected = `"${text}" 不可见`;
        result.status = visible ? "failed" : "passed";
        if (visible) result.error = `预期文本 "${text}" 不可见，但页面上仍然存在`;
        break;
      }

      case "assertCount": {
        const locator = resolveTemplate(step.locator, vars);
        const expected =
          typeof step.expected === "number"
            ? step.expected
            : parseInt(String(step.expected), 10);
        const count = await page.locator(locator).count();
        result.actual = String(count);
        result.expected = expected;
        result.status = count === expected ? "passed" : "failed";
        if (count !== expected) {
          result.error = `预期 ${expected} 个 "${locator}"，实际找到 ${count} 个`;
        }
        break;
      }

      case "assertInputEnabled": {
        const locator = resolveTemplate(step.locator, vars);
        const el = page.getByRole("button", { name: locator });
        const enabled = await el.isEnabled();
        result.actual = enabled ? "已启用" : "已禁用";
        result.status = enabled ? "passed" : "failed";
        if (!enabled) result.error = `预期按钮 "${locator}" 可用，实际已禁用`;
        break;
      }

      case "assertInputDisabled": {
        const locator = resolveTemplate(step.locator, vars);
        const el = page.getByRole("button", { name: locator });
        const disabled = await el.isDisabled();
        result.actual = disabled ? "已禁用" : "已启用";
        result.status = disabled ? "passed" : "failed";
        if (!disabled) result.error = `预期按钮 "${locator}" 已禁用，实际可用`;
        break;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.status = "error";
    result.error = message;
    result.actual = `执行异常：${message}`;
  }

  result.durationMs = Date.now() - start;

  // Screenshot on failure or error
  if (result.status === "failed" || result.status === "error") {
    result.screenshotPath = await takeScreenshot(
      page, screenshotDir, runId, step.id, result.status
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
  inheritedContext?: { context: BrowserContext; page: Page }
): Promise<CriteriaRunOutcome> {
  if (dependencyFailed) {
    return {
      result: {
        criteriaId: criteria.id,
        title: criteria.title,
        status: "blocked",
        blockedReason: `前置条件 ${criteria.dependsOn?.join(", ")} 未通过，本条跳过执行`,
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
    context = await browser.newContext({ storageState: undefined });
    page = await context.newPage();
    weOwnContext = true;
  }

  const stepResults: StepResult[] = [];
  let criteriaStatus: CriteriaStatus = "passed";

  try {
    for (const step of criteria.steps) {
      const stepResult = await executeStep(page, step, vars, screenshotDir, runId);
      stepResults.push(stepResult);

      if (stepResult.status === "failed" || stepResult.status === "error") {
        const shot = await takeScreenshot(page, screenshotDir, runId, step.id, "failure_scene");
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
    const finalShot = await takeScreenshot(page, screenshotDir, runId, criteria.id, "final");
    if (finalShot && stepResults.length > 0) {
      const last = stepResults[stepResults.length - 1];
      if (!last.screenshotPath) last.screenshotPath = finalShot;
    }
  } finally {
    // If we own the context and it failed, close it now (no point passing it on)
    if (weOwnContext && criteriaStatus !== "passed") {
      await context.close();
      weOwnContext = false;
    }
  }

  const result: CriteriaResult = {
    criteriaId: criteria.id,
    title: criteria.title,
    status: criteriaStatus,
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
    const src = fs.readFileSync(__filename, "utf-8");
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

    try {
      browser = await chromium.launch({ headless: true });

      const passedIds = new Set<string>();
      let liveContextForNext: { context: BrowserContext; page: Page } | undefined;

      for (let i = 0; i < plan.criteria.length; i++) {
        const criteria = plan.criteria[i];

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
          passedInContext
        );

        criteriaResults.push(outcome.result);
        this.opts.onCriteriaComplete?.(criteria.id, outcome.result.status);

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
      fatalError = err instanceof Error ? err.message : String(err);
    } finally {
      if (browser) await browser.close();
    }

    const finishedAt = new Date().toISOString();

    // Build final criteria list; any criterion not reached is marked not_run
    const finalCriteria: CriteriaResult[] = plan.criteria.map((c, i) => {
      if (i < criteriaResults.length) return criteriaResults[i];
      return {
        criteriaId: c.id,
        title: c.title,
        status: "not_run" as CriteriaStatus,
        blockedReason: fatalError
          ? `执行前发生致命错误：${fatalError}`
          : "未到达此条标准的执行",
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
    };
  }
}
