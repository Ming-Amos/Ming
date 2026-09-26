/**
 * Codex independent API verification; Bob owns Ming's implementation.
 * Run only after a fresh build, with Ming already listening on 127.0.0.1:4001.
 * Creates real Stage A buggy baseline/rerun records through public APIs.
 * Does not start/stop services, read .env, edit targets, or fabricate run records.
 * This is not Bob MCP integration, a successful repair, or live-model validation.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = "http://127.0.0.1:4001";
const TARGET_FILE = path.join(ROOT, "examples", "daily-report", "buggy", "index.html");
const startedAt = new Date().toISOString();
const reviewId = randomUUID();
const owner = `Codex-independent-api-${reviewId}`;
const reportPath = path.join(ROOT, "runtime", `review-repair-api-${startedAt.replace(/[:.]/g, "-")}-${reviewId.slice(0, 8)}.json`);
const report = {
  author: "Codex independent review",
  scope: "Real local HTTP API checks using fresh Stage A buggy browser runs; not Bob MCP or live-provider validation",
  reviewId, startedAt, baseUrl: BASE_URL, nodeVersion: process.version,
  assumptions: [
    "Operator already built current code and started Ming on 127.0.0.1:4001",
    "Buggy target still contains its original persistence defect",
    "No concurrent edits to target, plan, runner, or service restart during this test",
  ],
  serviceLifecycleManagedByScript: false,
  targetOrRunRecordsWrittenByScript: false,
  envFilesRead: false,
  requests: [], checks: [], ids: {},
};

const hashFile = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const knownFingerprint = (value) => typeof value === "string" && value.length > 0 && value !== "unknown";
const sameIds = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

function check(name, condition) {
  report.checks.push({ name, passed: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`);
  if (!condition) throw new Error(`Check failed: ${name}`);
}

function request(method, route, body) {
  if (!route.startsWith("/api/")) throw new Error("Only Ming API paths are allowed");
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    let settled = false;
    let timer;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(result);
    };
    const req = http.request({
      hostname: "127.0.0.1", port: 4001, path: route, method, agent: false,
      headers: { Accept: "application/json", ...(data === undefined ? {} : {
        "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data),
      }) },
    }, (res) => {
      const chunks = [];
      let bytes = 0;
      report.requests.push({ method, route, status: res.statusCode });
      res.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) {
          req.destroy(new Error(`Response exceeds 2 MiB for ${method} ${route}`));
          return;
        }
        chunks.push(chunk);
      });
      res.on("error", (error) => finish(error));
      res.on("aborted", () => finish(new Error(`Response aborted for ${method} ${route}`)));
      res.on("end", () => {
        try { finish(null, { status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }); }
        catch { finish(new Error(`Expected JSON from ${method} ${route}; HTTP ${res.statusCode}`)); }
      });
    });
    req.on("error", (error) => finish(error));
    timer = setTimeout(() => req.destroy(new Error(`10-second request timeout: ${method} ${route}`)), 10_000);
    if (data !== undefined) req.write(data);
    req.end();
  });
}

async function successful(method, route, body) {
  const response = await request(method, route, body);
  check(`${method} ${route} succeeds`, response.status === 200 && response.body.ok === true);
  return response.body;
}

async function waitForRun(runId) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const response = await request("GET", `/api/run/${encodeURIComponent(runId)}/progress`);
    if (response.status !== 200 || response.body.ok !== true) {
      throw new Error(`Progress unavailable for ${runId}; HTTP ${response.status}`);
    }
    const status = response.body.progress?.status;
    if (["passed", "failed", "error"].includes(status)) {
      const result = await successful("GET", `/api/run/${encodeURIComponent(runId)}`);
      return result.run;
    }
    if (!["pending", "running"].includes(status)) throw new Error(`Unexpected progress status for ${runId}`);
    await sleep(300);
  }
  throw new Error(`Run ${runId} did not reach a terminal state within 120 seconds; service left untouched`);
}

function summarizeRun(run) {
  return {
    runId: run.runId, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt,
    planId: run.planId, planVersion: run.planVersion, planFingerprint: run.planFingerprint,
    runnerFingerprint: run.runnerFingerprint, targetVariant: run.targetVariant,
    targetUrl: run.targetUrl, targetFingerprint: run.targetFingerprint,
    hasFatalError: Boolean(run.fatalError),
    criteria: run.criteria.map((criterion) => ({
      criteriaId: criterion.criteriaId, status: criterion.status,
      steps: criterion.steps.map((step) => ({
        stepId: step.stepId, status: step.status, screenshotPath: step.screenshotPath,
      })),
    })),
  };
}

function requireBuggyFailure(label, run, expectedIds) {
  check(`${label}: terminal business failure, no fatal error`, run.status === "failed" && !run.fatalError);
  check(`${label}: same complete registered criteria`, Array.isArray(run.criteria)
    && run.criteria.length === expectedIds.length && sameIds(run.criteria.map((c) => c.criteriaId), expectedIds));
  const states = new Map(run.criteria.map((c) => [c.criteriaId, c.status]));
  check(`${label}: persistence AC-02 fails and AC-01/AC-03 pass`, states.get("AC-02") === "failed"
    && states.get("AC-01") === "passed" && states.get("AC-03") === "passed");
  check(`${label}: failed assertion has saved screenshot evidence`, run.criteria
    .some((c) => c.criteriaId === "AC-02" && c.steps.some((s) => s.status === "failed" && typeof s.screenshotPath === "string" && s.screenshotPath.length > 0)));
  check(`${label}: known runner fingerprint`, knownFingerprint(run.runnerFingerprint));
}

async function main() {
  report.targetSourceSha256Before = hashFile(TARGET_FILE);
  const { plan } = await successful("GET", "/api/plan");
  const { targets } = await successful("GET", "/api/targets");
  const buggy = targets.find((target) => target.variant === "buggy");
  check("Stage A fixed fixture has three expected criteria", plan.planId === "stage-a-daily-report"
    && plan.criteria.length === 3 && sameIds(plan.criteria.map((c) => c.id), ["AC-01", "AC-02", "AC-03"]));
  check("Buggy target has known fingerprint", buggy && knownFingerprint(buggy.fingerprint));
  const criterionIds = plan.criteria.map((c) => c.id);
  report.plan = { planId: plan.planId, version: plan.version, fingerprint: plan.fingerprint };

  const start = await successful("POST", "/api/run", {
    variant: "buggy", confirmed: true,
    confirmedPlanId: plan.planId, confirmedPlanFingerprint: plan.fingerprint,
  });
  check("Fresh baseline run ID returned", typeof start.runId === "string" && start.runId.length > 0);
  report.ids.baselineRunId = start.runId;
  const baseline = await waitForRun(start.runId);
  report.baseline = summarizeRun(baseline);
  check("Baseline matches requested run, plan, and buggy target", baseline.runId === start.runId
    && baseline.planFingerprint === plan.fingerprint && baseline.targetVariant === "buggy"
    && baseline.targetUrl === buggy.url && baseline.targetFingerprint === buggy.fingerprint);
  requireBuggyFailure("Baseline", baseline, criterionIds);
  const baselineFile = path.join(ROOT, "runtime", "runs", `${baseline.runId}.json`);
  report.baselineRecordSha256Before = hashFile(baselineFile);

  const created = await successful("POST", "/api/repair-tasks", { baselineRunId: baseline.runId });
  const task = created.task;
  check("Repair task binds fresh baseline and waits", task?.baselineRunId === baseline.runId
    && task.status === "waiting" && typeof task.taskId === "string" && task.taskId.length > 0);
  report.ids.taskId = task.taskId;
  const taskRoute = `/api/repair-tasks/${encodeURIComponent(task.taskId)}`;
  const duplicate = await request("POST", "/api/repair-tasks", { baselineRunId: baseline.runId });
  check("Duplicate creation rejects with original task ID", duplicate.status === 409
    && duplicate.body.ok === false && duplicate.body.existingTaskId === task.taskId);
  const listed = await successful("GET", "/api/repair-tasks");
  const matching = listed.tasks.filter((entry) => entry.baselineRunId === baseline.runId);
  check("Repeated creation has only one persisted task", matching.length === 1 && matching[0].taskId === task.taskId);

  const claimed = await successful("POST", `${taskRoute}/claim`, { claimedBy: owner });
  check("Claim is persisted for this independent test owner", claimed.task.status === "claimed" && claimed.task.claimedBy === owner);
  const again = await successful("POST", `${taskRoute}/claim`, { claimedBy: owner });
  check("Same-owner claim is idempotent", again.task.taskId === task.taskId && again.task.claimedBy === owner
    && again.task.status === "claimed" && again.task.claimedAt === claimed.task.claimedAt);
  const conflict = await request("POST", `${taskRoute}/claim`, { claimedBy: `${owner}-competitor` });
  check("Competing owner is rejected", conflict.status === 409 && conflict.body.ok === false);
  const afterClaim = await successful("GET", taskRoute);
  check("Competing claim did not change owner", afterClaim.task.claimedBy === owner && afterClaim.task.status === "claimed");

  const stale = await request("POST", `${taskRoute}/rerun`, { expectedTargetFingerprint: `invalid-${reviewId}` });
  check("Wrong expected source fingerprint is rejected", stale.status === 409 && stale.body.ok === false && !stale.body.runId);
  const afterStale = await successful("GET", taskRoute);
  check("Rejected rerun leaves claimed task without run ID", afterStale.task.status === "claimed" && !afterStale.task.rerunId);

  check("Source unchanged before genuine rerun", hashFile(TARGET_FILE) === report.targetSourceSha256Before);
  const currentTargets = await successful("GET", "/api/targets");
  const currentBuggy = currentTargets.targets.find((target) => target.variant === "buggy");
  check("Current source fingerprint still matches baseline", currentBuggy?.fingerprint === baseline.targetFingerprint);
  const rerunStart = await successful("POST", `${taskRoute}/rerun`, { expectedTargetFingerprint: currentBuggy.fingerprint });
  check("Rerun returns a different real run ID", typeof rerunStart.runId === "string"
    && rerunStart.runId.length > 0 && rerunStart.runId !== baseline.runId && rerunStart.taskId === task.taskId);
  report.ids.rerunId = rerunStart.runId;
  const rerun = await waitForRun(rerunStart.runId);
  report.rerun = summarizeRun(rerun);
  requireBuggyFailure("Unmodified-source rerun", rerun, criterionIds);
  check("Rerun preserves plan, runner, target identity, and unchanged source", rerun.planFingerprint === baseline.planFingerprint
    && rerun.runnerFingerprint === baseline.runnerFingerprint && rerun.targetVariant === baseline.targetVariant
    && rerun.targetUrl === baseline.targetUrl && rerun.targetFingerprint === baseline.targetFingerprint);
  const finalTask = await successful("GET", taskRoute);
  check("Task links rerun and remains failed", finalTask.task.rerunId === rerun.runId && finalTask.task.status === "failed");
  report.taskFinalStatus = finalTask.task.status;
  const { comparison } = await successful("GET", `${taskRoute}/comparison`);
  report.comparison = comparison;
  check("Comparison binds this task and both real runs", comparison.taskId === task.taskId
    && comparison.baselineRunId === baseline.runId && comparison.rerunId === rerun.runId);
  check("Comparison cannot declare verified repair", comparison.verifiedRepair === false);
  check("Comparison reports equal plan/runner/target and no source change", comparison.planFingerprintMatch === true
    && comparison.runnerFingerprintMatch === true && comparison.targetIdentityMatch === true && comparison.targetFingerprintChanged === false);
  check("Original persistence failure remains unresolved", comparison.previouslyFailedStillFailing.includes("AC-02")
    && comparison.previouslyFailedNowPassed.length === 0);
  report.baselineRecordSha256After = hashFile(baselineFile);
  check("Original baseline record remains byte-for-byte unchanged", report.baselineRecordSha256After === report.baselineRecordSha256Before);
}

try {
  await main();
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  if (!report.checks.some((entry) => !entry.passed)) report.checks.push({ name: "Execution completed without unexpected error", passed: false });
} finally {
  try {
    report.targetSourceSha256After = hashFile(TARGET_FILE);
    report.checks.push({ name: "Target source unchanged for entire review", passed: report.targetSourceSha256After === report.targetSourceSha256Before });
  } catch (error) {
    report.checks.push({ name: "Target source remains readable", passed: false });
    report.cleanupError = error instanceof Error ? error.message : String(error);
  }
  report.finishedAt = new Date().toISOString();
  report.passedChecks = report.checks.filter((entry) => entry.passed).length;
  report.failedChecks = report.checks.filter((entry) => !entry.passed).length;
  report.passed = report.failedChecks === 0 && !report.error;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(`Codex independent API review: ${report.passedChecks} passed, ${report.failedChecks} failed`);
  console.log(`Report: ${reportPath}`);
  console.log(`Real IDs: ${JSON.stringify(report.ids)}`);
  if (report.error) console.error(report.error);
  process.exitCode = report.passed ? 0 : 1;
}
