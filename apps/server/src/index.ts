import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import {
  AcceptancePlan,
  RunRecord,
  RunProgress,
  TargetConfig,
  CriteriaStatus,
  ProjectRecord,
  RequirementRecord,
  DraftRecord,
  ConfirmationRecord,
} from "@ming/contracts";
import { PlanRunner, computeFingerprint } from "@ming/runner";
import { getProviderStatus, createLiveTransport } from "./provider/index";
import { TestFixtureTransport, buildEndpointUrl } from "./provider/openai-transport";
import { inspectPage } from "./inspector/page-inspector";
import { validateDraftPlan } from "./validator/draft-validator";
import type { ProviderTransport } from "./provider/types";

// Allow injecting a test transport (used by integration tests via MING_TEST_TRANSPORT env)
// The test transport is set at module level by the integration test harness.
let _testTransport: ProviderTransport | null = null;
export function setTestTransport(t: ProviderTransport | null): void {
  _testTransport = t;
}
function getTransport(): ProviderTransport | null {
  return _testTransport ?? createLiveTransport();
}

const app: Application = express();
app.use(cors());
app.use(express.json());

// ── 路径配置 ──────────────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const RUNTIME_DIR = path.join(PROJECT_ROOT, "runtime");
const RUNS_DIR = path.join(RUNTIME_DIR, "runs");
const SCREENSHOTS_DIR = path.join(RUNTIME_DIR, "screenshots");
const FIXTURES_DIR = path.join(PROJECT_ROOT, "fixtures");
const EXAMPLES_DIR = path.join(PROJECT_ROOT, "examples", "daily-report");

// Stage B data dirs
const PROJECTS_DIR = path.join(RUNTIME_DIR, "projects");
const REQUIREMENTS_DIR = path.join(RUNTIME_DIR, "requirements");
const DRAFTS_DIR = path.join(RUNTIME_DIR, "drafts");
const CONFIRMATIONS_DIR = path.join(RUNTIME_DIR, "confirmations");

// 允许的目标地址（限制只能访问本机样例，不提供任意URL执行端点）
const ALLOWED_VARIANTS: Record<string, { url: string; htmlPath: string }> = {
  normal: {
    url: "http://localhost:4001/normal",
    htmlPath: path.join(EXAMPLES_DIR, "normal", "index.html"),
  },
  buggy: {
    url: "http://localhost:4001/buggy",
    htmlPath: path.join(EXAMPLES_DIR, "buggy", "index.html"),
  },
};

// ── 目录初始化 ────────────────────────────────────────────────────
[RUNS_DIR, SCREENSHOTS_DIR, PROJECTS_DIR, REQUIREMENTS_DIR, DRAFTS_DIR, CONFIRMATIONS_DIR]
  .forEach((d) => fs.mkdirSync(d, { recursive: true }));

// ── 运行状态（内存缓存+文件持久化） ──────────────────────────────
const runningJobs = new Map<string, Promise<RunRecord>>();

// Live progress tracking: map from runId → partial progress
interface LiveProgress {
  totalCriteria: number;
  finishedCriteria: number;
  currentCriteria?: string;
}
const liveProgress = new Map<string, LiveProgress>();

function saveRun(record: RunRecord): void {
  const filePath = path.join(RUNS_DIR, `${record.runId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
}

function loadRun(runId: string): RunRecord | null {
  const filePath = path.join(RUNS_DIR, `${runId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as RunRecord;
  } catch {
    return null;
  }
}

function listRuns(): RunRecord[] {
  if (!fs.existsSync(RUNS_DIR)) return [];
  return fs
    .readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), "utf-8")) as RunRecord;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as RunRecord[];
}

// ── 加载计划 ─────────────────────────────────────────────────────
function loadPlan(): AcceptancePlan {
  const planPath = path.join(FIXTURES_DIR, "stage-a-plan.json");
  const raw = JSON.parse(fs.readFileSync(planPath, "utf-8")) as AcceptancePlan;
  raw.fingerprint = computeFingerprint(raw);
  return raw;
}

// ── 目标指纹（基于 HTML 内容） ───────────────────────────────────
function computeTargetFingerprint(htmlPath: string): string {
  try {
    const content = fs.readFileSync(htmlPath, "utf-8");
    return computeFingerprint(content);
  } catch {
    return "unknown";
  }
}

// ── Stage B: JSON 文件存取辅助 ────────────────────────────────────
function saveJson<T>(dir: string, id: string, data: T): void {
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(data, null, 2), "utf-8");
}
function loadJson<T>(dir: string, id: string): T | null {
  const p = path.join(dir, `${id}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as T; } catch { return null; }
}

// ── 启动运行的内部函数（Stage A 和 Stage B 共用） ────────────────
function launchRun(opts: {
  plan: AcceptancePlan;
  variant: string;
  targetCfg: { url: string; htmlPath: string };
  confirmationId?: string;
  requirementId?: string;
}): string {
  const { plan, variant, targetCfg, confirmationId, requirementId } = opts;
  const runId = uuidv4();
  const target: TargetConfig = {
    variant,
    url: targetCfg.url,
    fingerprint: computeTargetFingerprint(targetCfg.htmlPath),
  };
  const uniqueContent = `Ming测试-${variant}-${Date.now()}`;

  liveProgress.set(runId, {
    totalCriteria: plan.criteria.length,
    finishedCriteria: 0,
  });

  const job = (async (): Promise<RunRecord> => {
    try {
      const runner = new PlanRunner({
        screenshotDir: SCREENSHOTS_DIR,
        runId,
        onCriteriaComplete: (criteriaId: string, _status: CriteriaStatus) => {
          const lp = liveProgress.get(runId);
          if (lp) {
            lp.finishedCriteria += 1;
            lp.currentCriteria = criteriaId;
          }
        },
      });
      const record = await runner.run(plan, target, uniqueContent);
      // Attach Stage B linkage
      if (confirmationId) record.confirmationId = confirmationId;
      if (requirementId) record.requirementId = requirementId;
      saveRun(record);
      return record;
    } catch (err: unknown) {
      const fatalError = err instanceof Error ? err.message : String(err);
      const errorRecord: RunRecord = {
        runId,
        planId: plan.planId,
        planVersion: plan.version,
        planFingerprint: plan.fingerprint,
        targetVariant: variant,
        targetUrl: targetCfg.url,
        targetFingerprint: target.fingerprint,
        status: "error",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        criteria: plan.criteria.map((c) => ({
          criteriaId: c.id,
          title: c.title,
          status: "not_run",
          blockedReason: `致命错误：${fatalError}`,
          steps: c.steps.map((s) => ({
            stepId: s.id,
            description: s.description,
            status: "skipped",
          })),
        })),
        fatalError,
        confirmationId,
        requirementId,
      };
      saveRun(errorRecord);
      return errorRecord;
    } finally {
      runningJobs.delete(runId);
      liveProgress.delete(runId);
    }
  })();

  runningJobs.set(runId, job);
  return runId;
}

// ── API 路由 ─────────────────────────────────────────────────────

// GET /api/plan  返回固定计划（含真实指纹）
app.get("/api/plan", (_req: Request, res: Response) => {
  try {
    const plan = loadPlan();
    res.json({ ok: true, plan });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// GET /api/targets  返回允许的目标列表
app.get("/api/targets", (_req: Request, res: Response) => {
  const targets = Object.entries(ALLOWED_VARIANTS).map(([variant, cfg]) => ({
    variant,
    url: cfg.url,
    label: variant === "normal" ? "正常版（localStorage持久化）" : "预置缺陷版（刷新后丢失）",
    fingerprint: computeTargetFingerprint(cfg.htmlPath),
  }));
  res.json({ ok: true, targets });
});

// POST /api/run  发起验收运行（Stage A 固定夹具）
app.post("/api/run", (req: Request, res: Response) => {
  const { variant, confirmed, confirmedPlanId, confirmedPlanFingerprint } =
    req.body as {
      variant?: unknown;
      confirmed?: unknown;
      confirmedPlanId?: unknown;
      confirmedPlanFingerprint?: unknown;
    };

  if (confirmed !== true) {
    res.status(400).json({
      ok: false,
      error: "必须先确认计划（confirmed 必须是布尔 true，不接受字符串）才能执行",
    });
    return;
  }

  if (!variant || typeof variant !== "string" || !ALLOWED_VARIANTS[variant]) {
    res.status(400).json({
      ok: false,
      error: `不支持的目标版本 "${variant}"，只允许：${Object.keys(ALLOWED_VARIANTS).join(",")}`,
    });
    return;
  }

  let plan: AcceptancePlan;
  try {
    plan = loadPlan();
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: `计划加载失败：${String(err)}` });
    return;
  }

  if (typeof confirmedPlanId !== "string" || confirmedPlanId !== plan.planId) {
    res.status(400).json({
      ok: false,
      error: `确认的 planId "${confirmedPlanId}" 与当前计划 "${plan.planId}" 不符`,
    });
    return;
  }

  if (
    typeof confirmedPlanFingerprint !== "string" ||
    confirmedPlanFingerprint !== plan.fingerprint
  ) {
    res.status(400).json({
      ok: false,
      error: `确认的计划指纹已过期（客户端：${confirmedPlanFingerprint}，当前：${plan.fingerprint}）。请重新查看并确认计划。`,
    });
    return;
  }

  const runId = launchRun({
    plan,
    variant,
    targetCfg: ALLOWED_VARIANTS[variant],
  });

  res.json({ ok: true, runId });
});

// GET /api/run/:runId/progress  轮询进度
app.get("/api/run/:runId/progress", async (req: Request, res: Response) => {
  const { runId } = req.params;
  const isRunning = runningJobs.has(runId);

  if (isRunning) {
    const lp = liveProgress.get(runId);
    const progress: RunProgress = {
      runId,
      status: "running",
      currentCriteria: lp?.currentCriteria,
      finishedCriteria: lp?.finishedCriteria ?? 0,
      totalCriteria: lp?.totalCriteria ?? 0,
    };
    res.json({ ok: true, progress });
    return;
  }

  const record = loadRun(runId);
  if (!record) {
    res.status(404).json({ ok: false, error: `runId ${runId} 不存在` });
    return;
  }

  const finishedCriteria = record.criteria.filter(
    (c) => c.status !== "pending" && c.status !== "running" && c.status !== "not_run"
  ).length;

  const progress: RunProgress = {
    runId,
    status: record.status,
    finishedCriteria,
    totalCriteria: record.criteria.length,
    fatalError: record.fatalError,
  };

  res.json({ ok: true, progress });
});

// GET /api/run/:runId  获取完整结果
app.get("/api/run/:runId", async (req: Request, res: Response) => {
  const { runId } = req.params;

  const running = runningJobs.get(runId);
  if (running) {
    try { await running; } catch { /* Error already saved */ }
  }

  const record = loadRun(runId);
  if (!record) {
    res.status(404).json({ ok: false, error: `runId ${runId} 不存在` });
    return;
  }

  res.json({ ok: true, run: record });
});

// GET /api/history  历史记录列表
app.get("/api/history", (_req: Request, res: Response) => {
  const runs = listRuns().sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  const summary = runs.map((r) => ({
    runId: r.runId,
    planVersion: r.planVersion,
    planFingerprint: r.planFingerprint,
    targetVariant: r.targetVariant,
    targetFingerprint: r.targetFingerprint,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    criteriaSummary: r.criteria.map((c) => ({ id: c.criteriaId, status: c.status })),
    fatalError: r.fatalError,
    confirmationId: r.confirmationId,
    requirementId: r.requirementId,
  }));
  res.json({ ok: true, runs: summary });
});

// GET /api/screenshots/:filename  提供截图访问
app.get("/api/screenshots/:filename", (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ ok: false, error: "截图不存在" });
    return;
  }
  res.sendFile(filePath);
});

// ── Stage B Routes ────────────────────────────────────────────────

// GET /api/provider/status  返回提供商配置状态（不含密钥）
app.get("/api/provider/status", (_req: Request, res: Response) => {
  const status = getProviderStatus();
  res.json({ ok: true, status });
});

// POST /api/projects  创建项目记录
// body: { name: string, targetVariant: string }
app.post("/api/projects", (req: Request, res: Response) => {
  const { name, targetVariant } = req.body as { name?: unknown; targetVariant?: unknown };
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ ok: false, error: "name 不能为空" });
    return;
  }
  if (!targetVariant || typeof targetVariant !== "string" || !ALLOWED_VARIANTS[targetVariant]) {
    res.status(400).json({
      ok: false,
      error: `targetVariant 必须是 ${Object.keys(ALLOWED_VARIANTS).join(" 或 ")}`,
    });
    return;
  }
  const projectId = uuidv4();
  const now = new Date().toISOString();
  const project: ProjectRecord = {
    projectId,
    name: name.trim(),
    targetVariant,
    targetUrl: ALLOWED_VARIANTS[targetVariant].url,
    createdAt: now,
    updatedAt: now,
  };
  saveJson(PROJECTS_DIR, projectId, project);
  res.json({ ok: true, project });
});

// GET /api/projects/:projectId  获取项目
app.get("/api/projects/:projectId", (req: Request, res: Response) => {
  const project = loadJson<ProjectRecord>(PROJECTS_DIR, req.params.projectId);
  if (!project) { res.status(404).json({ ok: false, error: "项目不存在" }); return; }
  res.json({ ok: true, project });
});

// GET /api/projects/:projectId/context  检查目标页面结构
app.get("/api/projects/:projectId/context", async (req: Request, res: Response) => {
  const project = loadJson<ProjectRecord>(PROJECTS_DIR, req.params.projectId);
  if (!project) { res.status(404).json({ ok: false, error: "项目不存在" }); return; }
  const targetCfg = ALLOWED_VARIANTS[project.targetVariant];
  if (!targetCfg) { res.status(400).json({ ok: false, error: "项目目标变体不在允许列表中" }); return; }

  try {
    const context = await inspectPage({
      projectId: project.projectId,
      targetVariant: project.targetVariant,
      targetUrl: targetCfg.url,
    });
    res.json({ ok: true, context });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// POST /api/projects/:projectId/requirements  保存需求
// body: { text: string }
app.post("/api/projects/:projectId/requirements", (req: Request, res: Response) => {
  const project = loadJson<ProjectRecord>(PROJECTS_DIR, req.params.projectId);
  if (!project) { res.status(404).json({ ok: false, error: "项目不存在" }); return; }

  const { text } = req.body as { text?: unknown };
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ ok: false, error: "需求 text 不能为空" });
    return;
  }

  const requirementId = uuidv4();
  const record: RequirementRecord = {
    requirementId,
    projectId: project.projectId,
    version: 1,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  saveJson(REQUIREMENTS_DIR, requirementId, record);
  res.json({ ok: true, requirement: record });
});

// GET /api/requirements/:requirementId  获取需求
app.get("/api/requirements/:requirementId", (req: Request, res: Response) => {
  const req2 = loadJson<RequirementRecord>(REQUIREMENTS_DIR, req.params.requirementId);
  if (!req2) { res.status(404).json({ ok: false, error: "需求不存在" }); return; }
  res.json({ ok: true, requirement: req2 });
});

// POST /api/generate  调用模型生成草稿
// body: { requirementId: string }
// Fix 2: bounded async error boundary — catches unhandled rejections inside the route
app.post("/api/generate", async (req: Request, res: Response, next: NextFunction) => {
  const { requirementId } = req.body as { requirementId?: unknown };
  if (!requirementId || typeof requirementId !== "string") {
    res.status(400).json({ ok: false, error: "requirementId 缺失" });
    return;
  }

  const requirement = loadJson<RequirementRecord>(REQUIREMENTS_DIR, requirementId);
  if (!requirement) { res.status(404).json({ ok: false, error: "需求不存在" }); return; }

  const project = loadJson<ProjectRecord>(PROJECTS_DIR, requirement.projectId);
  if (!project) { res.status(404).json({ ok: false, error: "关联项目不存在" }); return; }

  // Get page context (best-effort; non-blocking on failure)
  let pageContext = null;
  const targetCfg = ALLOWED_VARIANTS[project.targetVariant];
  if (targetCfg) {
    try {
      pageContext = await inspectPage({
        projectId: project.projectId,
        targetVariant: project.targetVariant,
        targetUrl: targetCfg.url,
      });
    } catch {
      // page context failure is non-fatal; model will receive null context
    }
  }

  const transport = getTransport();
  if (!transport) {
    // No transport configured — return distinct "model not configured" response
    res.status(503).json({
      ok: false,
      error: "模型未配置：请在 apps/server/.env 中设置 PROVIDER_BASE_URL、PROVIDER_MODEL_ID 和 PROVIDER_API_KEY",
      notConfigured: true,
    });
    return;
  }

  let outcome;
  try {
    outcome = await transport.generate({
      requirement: requirement.text,
      pageContext,
      projectId: project.projectId,
      requirementId: requirement.requirementId,
    });
  } catch (err: unknown) {
    next(err);
    return;
  }

  if (!outcome.ok) {
    res.status(502).json({
      ok: false,
      error: outcome.usage.errorMessage ?? "模型调用失败",
      errorCategory: outcome.usage.errorCategory,
      usage: outcome.usage,
    });
    return;
  }

  // Validate the generated plan before saving
  const validationErrors = validateDraftPlan(outcome.plan);

  // Count existing drafts for this requirement
  let draftVersion = 1;
  try {
    const existingDrafts = fs.readdirSync(DRAFTS_DIR).filter((f) => f.endsWith(".json"));
    for (const f of existingDrafts) {
      const d = loadJson<DraftRecord>(DRAFTS_DIR, f.replace(".json", ""));
      if (d && d.requirementId === requirementId) draftVersion = Math.max(draftVersion, d.draftVersion + 1);
    }
  } catch { /* best-effort */ }

  // Fix 3: openQuestions must be a string array; a non-array value also counts as open question
  const hasOpenQuestions = (outcome.plan.criteria ?? []).some((c) => {
    const oq = (c as unknown as Record<string, unknown>)["openQuestions"];
    if (oq === undefined || oq === null) return false;
    if (!Array.isArray(oq)) return true; // non-array string counts as open question
    return oq.some((q) => typeof q === "string" && q.trim().length > 0);
  });

  const draftId = uuidv4();
  const draftRecord: DraftRecord = {
    draftId,
    projectId: project.projectId,
    requirementId,
    draftVersion,
    plan: outcome.plan,
    usage: outcome.usage,
    hasOpenQuestions,
    validationErrors,
    createdAt: new Date().toISOString(),
  };
  saveJson(DRAFTS_DIR, draftId, draftRecord);

  res.json({ ok: true, draft: draftRecord });
});

// GET /api/drafts/:draftId  获取草稿
app.get("/api/drafts/:draftId", (req: Request, res: Response) => {
  const draft = loadJson<DraftRecord>(DRAFTS_DIR, req.params.draftId);
  if (!draft) { res.status(404).json({ ok: false, error: "草稿不存在" }); return; }
  res.json({ ok: true, draft });
});

// POST /api/confirm  确认草稿，创建不可变确认记录
// body: { draftId: string, displayedPlanFingerprint: string }
app.post("/api/confirm", (req: Request, res: Response) => {
  const { draftId, displayedPlanFingerprint } = req.body as {
    draftId?: unknown;
    displayedPlanFingerprint?: unknown;
  };
  if (!draftId || typeof draftId !== "string") {
    res.status(400).json({ ok: false, error: "draftId 缺失" });
    return;
  }
  if (!displayedPlanFingerprint || typeof displayedPlanFingerprint !== "string") {
    res.status(400).json({ ok: false, error: "displayedPlanFingerprint 缺失" });
    return;
  }

  const draft = loadJson<DraftRecord>(DRAFTS_DIR, draftId);
  if (!draft) { res.status(404).json({ ok: false, error: "草稿不存在" }); return; }

  // Validate fingerprint match (ensures user confirmed the exact displayed plan)
  if (draft.plan.fingerprint !== displayedPlanFingerprint) {
    res.status(400).json({
      ok: false,
      error: `指纹不匹配（展示：${displayedPlanFingerprint}，草稿：${draft.plan.fingerprint}）`,
    });
    return;
  }

  // Block confirmation if validation errors exist
  if (draft.validationErrors.length > 0) {
    res.status(400).json({
      ok: false,
      error: `草稿包含校验错误，无法确认：${draft.validationErrors.join("；")}`,
    });
    return;
  }

  // Block confirmation if there are open questions
  if (draft.hasOpenQuestions) {
    res.status(400).json({
      ok: false,
      error: "草稿存在未解答的问题（openQuestions），请修改需求重新生成后再确认",
    });
    return;
  }

  const project = loadJson<ProjectRecord>(PROJECTS_DIR, draft.projectId);
  if (!project) { res.status(404).json({ ok: false, error: "关联项目不存在" }); return; }

  const confirmationId = uuidv4();
  const confirmation: ConfirmationRecord = {
    confirmationId,
    draftId,
    planId: draft.plan.planId,
    planFingerprint: draft.plan.fingerprint,
    planVersion: draft.plan.version,
    projectId: draft.projectId,
    requirementId: draft.requirementId,
    targetVariant: project.targetVariant,
    confirmedAt: new Date().toISOString(),
    planSnapshot: draft.plan,
  };
  saveJson(CONFIRMATIONS_DIR, confirmationId, confirmation);

  res.json({ ok: true, confirmation });
});

// GET /api/confirmations/:confirmationId  获取确认记录
app.get("/api/confirmations/:confirmationId", (req: Request, res: Response) => {
  const confirmation = loadJson<ConfirmationRecord>(CONFIRMATIONS_DIR, req.params.confirmationId);
  if (!confirmation) { res.status(404).json({ ok: false, error: "确认记录不存在" }); return; }
  res.json({ ok: true, confirmation });
});

// POST /api/run-confirmed  从已确认计划发起执行
// body: { confirmationId: string }
app.post("/api/run-confirmed", (req: Request, res: Response) => {
  const { confirmationId } = req.body as { confirmationId?: unknown };
  if (!confirmationId || typeof confirmationId !== "string") {
    res.status(400).json({ ok: false, error: "confirmationId 缺失" });
    return;
  }

  const confirmation = loadJson<ConfirmationRecord>(CONFIRMATIONS_DIR, confirmationId);
  if (!confirmation) { res.status(404).json({ ok: false, error: "确认记录不存在" }); return; }

  const targetCfg = ALLOWED_VARIANTS[confirmation.targetVariant];
  if (!targetCfg) {
    res.status(400).json({
      ok: false,
      error: `目标变体 "${confirmation.targetVariant}" 不在允许列表中`,
    });
    return;
  }

  // Re-validate plan at run boundary (plan snapshot is immutable, but re-check for safety)
  const errors = validateDraftPlan(confirmation.planSnapshot);
  if (errors.length > 0) {
    res.status(400).json({
      ok: false,
      error: `确认计划执行前验证失败：${errors.join("；")}`,
    });
    return;
  }

  const runId = launchRun({
    plan: confirmation.planSnapshot,
    variant: confirmation.targetVariant,
    targetCfg,
    confirmationId,
    requirementId: confirmation.requirementId,
  });

  res.json({ ok: true, runId });
});

// ── Admin routes (test-mode only) ────────────────────────────────
// These endpoints are only accessible when MING_TEST_MODE=1 is set.
// They allow integration tests to inject fixture transports via HTTP.

// POST /admin/test-fixture  set the active transport for subsequent /api/generate calls
// body: { mode: "plan" | "unconfigured" | "http_error" | "http_raw" | "timeout", ... }
app.post("/admin/test-fixture", (req: Request, res: Response) => {
  if (process.env.MING_TEST_MODE !== "1") {
    res.status(403).json({ ok: false, error: "test mode not enabled" });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const mode = body.mode as string;
  if (mode === "unconfigured") {
    setTestTransport(null);
    res.json({ ok: true, mode });
    return;
  }
  if (mode === "plan") {
    const t = new TestFixtureTransport(body.plan as AcceptancePlan ?? null);
    setTestTransport(t);
    res.json({ ok: true, mode });
    return;
  }
  if (mode === "timeout") {
    // Fixture that never resolves — simulates a slow API
    const t = new TestFixtureTransport(null, undefined, 0, true);
    setTestTransport(t);
    res.json({ ok: true, mode });
    return;
  }
  if (mode === "http_error" || mode === "http_raw") {
    // Use the raw-response fixture transport
    const statusCode = typeof body.statusCode === "number" ? body.statusCode : 200;
    const responseBody = typeof body.responseBody === "string" ? body.responseBody : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey : "sk-fixture-key";
    const t = new TestFixtureTransport(null, undefined, 0, false, { statusCode, responseBody, apiKey });
    setTestTransport(t);
    res.json({ ok: true, mode });
    return;
  }
  res.status(400).json({ ok: false, error: `unknown mode: ${mode}` });
});

// GET /admin/test-endpoint-url  exercise buildEndpointUrl with known cases
app.get("/admin/test-endpoint-url", (req: Request, res: Response) => {
  if (process.env.MING_TEST_MODE !== "1") {
    res.status(403).json({ ok: false, error: "test mode not enabled" });
    return;
  }
  const cases = [
    { input: ["https://api.openai.com/v1", "chat/completions"], expected: "https://api.openai.com/v1/chat/completions" },
    { input: ["https://api.openai.com/v1/", "chat/completions"], expected: "https://api.openai.com/v1/chat/completions" },
    { input: ["https://api.openai.com", "chat/completions"], expected: "https://api.openai.com/chat/completions" },
    { input: ["https://localhost:8080/v1", "chat/completions"], expected: "https://localhost:8080/v1/chat/completions" },
  ].map(({ input, expected }) => ({
    input,
    expected,
    actual: buildEndpointUrl(input[0], input[1]),
  }));
  res.json({ ok: true, cases });
});

// ── 静态文件服务（玩具日报样例） ──────────────────────────────────
app.use("/normal", express.static(path.join(EXAMPLES_DIR, "normal")));
app.use("/buggy", express.static(path.join(EXAMPLES_DIR, "buggy")));

// ── 错误处理 ──────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[server error]", err);
  res.status(500).json({ ok: false, error: err.message });
});

const PORT = parseInt(process.env.PORT ?? "4001", 10);
app.listen(PORT, "127.0.0.1", () => {
  console.log(`[Ming Server] 已启动：http://127.0.0.1:${PORT}`);
  console.log(`  日报样例（正常版）：http://127.0.0.1:${PORT}/normal`);
  console.log(`  日报样例（缺陷版）：http://127.0.0.1:${PORT}/buggy`);
  console.log(`  API：             http://127.0.0.1:${PORT}/api`);
});

export default app;
