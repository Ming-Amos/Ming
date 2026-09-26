import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { AcceptancePlan, RunRecord, RunProgress, TargetConfig, CriteriaStatus } from "@ming/contracts";
import { PlanRunner, computeFingerprint } from "@ming/runner";

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
[RUNS_DIR, SCREENSHOTS_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

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
  // Compute and inject the real plan fingerprint (excludes the fingerprint field itself)
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

// POST /api/run  发起验收运行
// body: {
//   variant: "normal"|"buggy",
//   confirmed: true (strict boolean),
//   confirmedPlanId: string,
//   confirmedPlanFingerprint: string
// }
app.post("/api/run", (req: Request, res: Response) => {
  const { variant, confirmed, confirmedPlanId, confirmedPlanFingerprint } =
    req.body as {
      variant?: unknown;
      confirmed?: unknown;
      confirmedPlanId?: unknown;
      confirmedPlanFingerprint?: unknown;
    };

  // Issue 5: must be strict boolean true, not truthy string
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

  // Load the current plan and verify the client confirmed the right version
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

  const runId = uuidv4();
  const targetCfg = ALLOWED_VARIANTS[variant];
  const target: TargetConfig = {
    variant,
    url: targetCfg.url,
    fingerprint: computeTargetFingerprint(targetCfg.htmlPath),
  };

  // Generate unique test content for this run (timestamp ensures no collision with history)
  const uniqueContent = `Ming测试-${variant}-${Date.now()}`;

  // Initialize live progress
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
      saveRun(record);
      return record;
    } catch (err: unknown) {
      // If runner.run() throws (e.g. plan validation — though we already validated above),
      // save a terminal error record so polling can see it.
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
      };
      saveRun(errorRecord);
      return errorRecord;
    } finally {
      runningJobs.delete(runId);
      liveProgress.delete(runId);
    }
  })();

  runningJobs.set(runId, job);

  // Return runId immediately; front end polls for progress
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

  // If still running, wait for completion
  const running = runningJobs.get(runId);
  if (running) {
    try {
      await running;
    } catch {
      // Error already saved by job wrapper above
    }
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
  // Return slim summaries; full details available via /api/run/:runId
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
  }));
  res.json({ ok: true, runs: summary });
});

// GET /api/screenshots/:filename  提供截图访问
app.get("/api/screenshots/:filename", (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ ok: false, error: "截图不存在" });
    return;
  }
  res.sendFile(filePath);
});

// ── 静态文件服务（玩具日报样例） ──────────────────────────────────
// Only serves the configured local samples
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
