/**
 * Stage B Web UI validation script.
 * Codex review correction: resolve Vite from its owning workspace and retain
 * startup errors; core application implementation remains Bob's work.
 *
 * Exercises the StageBFlow component (Stage B tab) end-to-end using the
 * in-process TestFixtureTransport injected via /admin/test-fixture
 * (MING_TEST_MODE=1).  The fixture plan is the Stage A plan body reused with
 * source="generated" so it passes validateDraftPlan without weakening schema.
 *
 * Tests:
 *  B-UI-01  Stage B tab present and switches content
 *  B-UI-02  Step 1 creates a project; badge visible
 *  B-UI-03  Step 2 saves a requirement; badge visible
 *  B-UI-04  Generate with unconfigured fixture → error banner
 *  B-UI-05  Switch to plan fixture; generate succeeds; draft review panel shown
 *  B-UI-06  Draft shows plan title and AC-01/02/03 criteria
 *  B-UI-07  Confirm button enabled (no validation errors, no open questions)
 *  B-UI-08  Step 4 confirm → confirmation badge with confirmationId
 *  B-UI-09  Step 5 run-confirmed → runId captured; poll until terminal
 *  B-UI-10  RunResultPanel shows runId prefix, target, fingerprint
 *  B-UI-11  Rerun with same confirmationId → second runId; same planFingerprint
 *  B-UI-12  Final screenshot saved
 */

import { createRequire } from "module";
import { spawn } from "child_process";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const requireFromRunner = createRequire(
  path.join(PROJECT_ROOT, "packages/runner/package.json")
);
const { chromium } = requireFromRunner("playwright");

const TS = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, "runtime", "screenshots", `stage-b-ui-${TS}`);
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// ── Valid fixture plan — Stage A criteria reused, source overridden to
//    "generated" so validateDraftPlan accepts it as a model-generated draft.
const FIXTURE_PLAN = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "fixtures/stage-a-plan.json"), "utf8")
);
FIXTURE_PLAN.source = "generated";
// Remove the TO_BE_COMPUTED sentinel; server will recompute
delete FIXTURE_PLAN.fingerprint;

// ── Helpers ────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForPort(port, maxMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      await new Promise((res, rej) => {
        const req = http.get(`http://127.0.0.1:${port}/`, (r) => { r.resume(); res(); });
        req.on("error", rej);
        req.setTimeout(800, () => { req.destroy(); rej(new Error("timeout")); });
      });
      return true;
    } catch { await sleep(400); }
  }
  return false;
}

function apiPost(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: "127.0.0.1", port: 4001, path: urlPath, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    };
    const req = http.request(opts, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { reject(new Error(`Non-JSON from ${urlPath}: ` + raw.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function apiGet(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:4001${urlPath}`, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { reject(new Error(`Non-JSON from ${urlPath}: ` + raw.slice(0, 200))); }
      });
    });
    req.on("error", reject);
  });
}

let passed = 0;
let failed = 0;
function assert(label, condition, detail = "") {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${detail ? " — " + detail : ""}`); failed++; }
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  📸 ${name}.png`);
  return filePath;
}

async function setFixture(mode, extra = {}) {
  const r = await apiPost("/admin/test-fixture", { mode, ...extra });
  if (!r.body.ok) throw new Error(`set-fixture "${mode}" failed: ` + JSON.stringify(r.body));
}

/**
 * Intercept the next POST /api/run-confirmed response to capture runId,
 * click the trigger button, then poll /api/run/:runId/progress until terminal.
 * Returns the full RunRecord from /api/run/:runId.
 */
async function triggerRunConfirmedAndWait(page, triggerBtn, timeoutMs = 60000) {
  let capturedRunId = null;
  await page.route("**/api/run-confirmed", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (json.ok && json.runId) capturedRunId = json.runId;
    await route.fulfill({ response });
  });

  await triggerBtn.click();

  // Wait for runId to appear (max 6s)
  const idDeadline = Date.now() + 6000;
  while (!capturedRunId && Date.now() < idDeadline) await sleep(100);
  if (!capturedRunId) throw new Error("Did not capture runId from POST /api/run-confirmed within 6s");
  await page.unroute("**/api/run-confirmed");
  console.log(`  [captured runId] ${capturedRunId}`);

  // Poll progress API until terminal
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await apiGet(`/api/run/${capturedRunId}/progress`);
    if (!r.body.ok) throw new Error("progress error: " + JSON.stringify(r.body));
    if (r.body.progress.status !== "running") break;
    await sleep(600);
  }

  const rec = await apiGet(`/api/run/${capturedRunId}`);
  if (!rec.body.ok) throw new Error("fetch run failed: " + JSON.stringify(rec.body));
  return { runId: capturedRunId, run: rec.body.run };
}

// ── Server + Vite startup ──────────────────────────────────────────

console.log("▶ 启动 Ming Server（Stage B UI 测试模式）…");
const serverEnv = { ...process.env, MING_TEST_MODE: "1" };
const serverProc = spawn(
  "node",
  [path.join(PROJECT_ROOT, "apps/server/dist/index.js")],
  { env: serverEnv, stdio: ["ignore", "pipe", "pipe"] }
);
serverProc.stdout.on("data", () => {});
serverProc.stderr.on("data", (data) => process.stderr.write(data));

console.log("▶ 启动 Vite Dev Server…");
const viteBin = path.join(PROJECT_ROOT, "apps/web/node_modules/vite/bin/vite.js");
const viteProc = spawn(
  "node", [viteBin, "--port", "4000", "--strictPort"],
  { cwd: path.join(PROJECT_ROOT, "apps/web"), stdio: ["ignore", "pipe", "pipe"] }
);
viteProc.stderr.on("data", (data) => process.stderr.write(data));
viteProc.stdout.on("data", () => {});

const serverReady = await waitForPort(4001);
const viteReady = await waitForPort(4000);
if (!serverReady || !viteReady) {
  serverProc.kill();
  viteProc.kill();
  console.error("服务启动失败"); process.exit(1);
}
console.log("✓ 两个服务已就绪\n");

// ── Browser ────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

let firstRunId = null;
let firstPlanFingerprint = null;
let capturedConfirmationId = null;

try {
  // ── B-UI-01: Tab switcher ──────────────────────────────────────
  console.log("── B-UI-01: Stage B 标签切换 ──────────────────────────────────────");
  await page.goto("http://127.0.0.1:4000", { waitUntil: "networkidle" });
  await screenshot(page, "01-initial");

  const stageBTab = page.locator("button", { hasText: "Stage B" });
  const tabCount = await stageBTab.count();
  assert("B-UI-01: Stage B 标签按钮存在", tabCount > 0, `found ${tabCount}`);
  if (tabCount === 0) throw new Error("Stage B tab not found — cannot continue");

  await stageBTab.click();
  await page.waitForTimeout(400);
  await screenshot(page, "02-stage-b-tab");
  assert("B-UI-01: 切换后显示步骤 1 面板",
    await page.locator("text=步骤 1：创建项目").isVisible());

  // ── B-UI-02: Create project ────────────────────────────────────
  console.log("\n── B-UI-02: 步骤 1 创建项目 ──────────────────────────────────────");
  const projectInput = page.locator("input[placeholder='项目名称']");
  assert("B-UI-02: 项目名称输入框存在", await projectInput.isVisible());
  await projectInput.fill("Stage-B-UI-Test-" + Date.now());

  const createBtn = page.locator("button", { hasText: "创建项目" });
  assert("B-UI-02: 创建项目按钮存在", await createBtn.isVisible());
  await createBtn.click();
  // Wait for project badge (API call may take a moment)
  await page.waitForSelector("text=项目：", { timeout: 8000 });
  await screenshot(page, "03-project-created");
  assert("B-UI-02: 项目 badge 出现",
    await page.locator("text=项目：").first().isVisible());

  // ── B-UI-03: Save requirement ──────────────────────────────────
  console.log("\n── B-UI-03: 步骤 2 保存需求 ──────────────────────────────────────");
  const saveReqBtn = page.locator("button", { hasText: "保存需求" });
  assert("B-UI-03: 保存需求按钮存在", await saveReqBtn.isVisible());
  await saveReqBtn.click();
  await page.waitForSelector("text=需求已保存", { timeout: 8000 });
  await screenshot(page, "04-requirement-saved");
  assert("B-UI-03: 需求已保存 badge 出现",
    await page.locator("text=需求已保存").isVisible());

  // ── B-UI-04: Generate with unconfigured fixture → error ────────
  console.log("\n── B-UI-04: fixture=unconfigured → 错误 banner ───────────────────");
  await setFixture("unconfigured");
  const genBtn = page.locator("button", { hasText: "生成草稿" });
  assert("B-UI-04: 生成草稿按钮存在", await genBtn.isVisible());
  const missingConfigResponse = page.waitForResponse(r => r.url().endsWith('/api/generate') && r.request().method() === 'POST');
  await genBtn.click();
  assert("B-UI-04: 未配置的生成请求返回 503", (await missingConfigResponse).status() === 503);
  const missingConfigBanner = page.getByText(/^模型未配置：/);
  await missingConfigBanner.waitFor({ state: 'visible', timeout: 8000 });
  const errVisible = await missingConfigBanner.isVisible();
  assert("B-UI-04: 错误 banner 出现（服务端返回 503）", errVisible);
  await screenshot(page, "05-generate-503");

  // ── B-UI-05: Switch to plan fixture → generate succeeds ────────
  console.log("\n── B-UI-05: fixture=plan → 生成成功，草稿面板 ────────────────────");
  await setFixture("plan", { plan: FIXTURE_PLAN });

  // "重新生成" button should be visible after the error
  const regenBtn = page.locator("button", { hasText: "重新生成" });
  if (await regenBtn.isVisible()) await regenBtn.click();
  await page.waitForTimeout(300);

  const genBtn2 = page.locator("button", { hasText: "生成草稿" });
  await genBtn2.waitFor({ state: "visible", timeout: 5000 });
  await genBtn2.click();
  // Draft review panel header
  await page.waitForSelector("text=步骤 4：审查草稿并确认", { timeout: 12000 });
  await screenshot(page, "06-draft-generated");
  assert("B-UI-05: 草稿审查面板出现",
    await page.locator("text=步骤 4：审查草稿并确认").isVisible());

  // ── B-UI-06: Draft shows plan criteria ────────────────────────
  console.log("\n── B-UI-06: 草稿内容：计划标题与验收条目 ─────────────────────────");
  assert("B-UI-06: 计划标题显示",
    await page.locator("text=日报系统验收计划").first().isVisible());
  assert("B-UI-06: AC-01 条目显示",
    await page.locator("text=AC-01").first().isVisible());
  assert("B-UI-06: AC-02 条目显示",
    await page.locator("text=AC-02").first().isVisible());
  assert("B-UI-06: AC-03 条目显示",
    await page.locator("text=AC-03").first().isVisible());

  // ── B-UI-07: Confirm button enabled ───────────────────────────
  console.log("\n── B-UI-07: 确认按钮可用 ─────────────────────────────────────────");
  const confirmBtn = page.locator("button", { hasText: "确认计划" });
  assert("B-UI-07: 确认计划按钮存在", await confirmBtn.isVisible());
  assert("B-UI-07: 确认计划按钮未禁用", !(await confirmBtn.isDisabled()));

  // ── B-UI-08: Confirm → confirmation badge ─────────────────────
  console.log("\n── B-UI-08: 步骤 4 确认计划 ──────────────────────────────────────");
  // Intercept confirm to capture confirmationId
  let capturedConfirmResponse = null;
  await page.route("**/api/confirm", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (json.ok && json.confirmation) capturedConfirmResponse = json.confirmation;
    await route.fulfill({ response });
  });
  await confirmBtn.click();
  await page.waitForSelector("text=确认 ID：", { timeout: 8000 });
  await page.unroute("**/api/confirm");
  await screenshot(page, "07-confirmed");

  capturedConfirmationId = capturedConfirmResponse?.confirmationId ?? null;
  firstPlanFingerprint = capturedConfirmResponse?.planFingerprint ?? null;
  assert("B-UI-08: 确认 badge 出现", await page.locator("text=确认 ID：").isVisible());
  assert("B-UI-08: confirmationId 已捕获", capturedConfirmationId !== null,
    `got ${capturedConfirmationId}`);
  assert("B-UI-08: planFingerprint 已捕获", firstPlanFingerprint !== null,
    `got ${firstPlanFingerprint}`);
  console.log(`  [confirmationId] ${capturedConfirmationId}`);
  console.log(`  [planFingerprint] ${firstPlanFingerprint}`);

  // ── B-UI-09: Run confirmed → capture runId ────────────────────
  console.log("\n── B-UI-09: 步骤 5 执行验收运行 ──────────────────────────────────");
  const runBtn = page.locator("button", { hasText: "执行验收运行" });
  assert("B-UI-09: 执行验收运行按钮存在", await runBtn.isVisible());

  const { runId, run } = await triggerRunConfirmedAndWait(page, runBtn);
  firstRunId = runId;

  // Wait for RunResultPanel to render in the page (poll for runId prefix)
  const runIdPrefix = runId.slice(0, 8);
  let resultVisible = false;
  const uiDeadline = Date.now() + 15000;
  while (Date.now() < uiDeadline) {
    if (await page.locator(`text=运行 ${runIdPrefix}`).isVisible()) {
      resultVisible = true; break;
    }
    await sleep(500);
  }
  await screenshot(page, "08-run-result");

  assert("B-UI-09: runId 已捕获", runId !== null, runId);
  assert("B-UI-09: 正常样例实际运行通过",
    run.status === "passed",
    `status=${run.status}`);
  assert("B-UI-09: 三条真实业务检查全部通过",
    run.criteria.length === 3 && ['AC-01', 'AC-02', 'AC-03'].every(id => run.criteria.some(c => c.criteriaId === id && c.status === 'passed')));

  // ── B-UI-10: RunResultPanel content ───────────────────────────
  console.log("\n── B-UI-10: RunResultPanel 内容验证 ──────────────────────────────");
  assert("B-UI-10: RunResultPanel 显示 runId 前缀",
    resultVisible, `looking for "运行 ${runIdPrefix}"`);
  assert("B-UI-10: 显示目标（目标：）",
    await page.locator("text=目标：").first().isVisible());
  assert("B-UI-10: 显示计划指纹（计划指纹：）",
    await page.getByText(/^计划指纹：/).isVisible());
  // StatusBadge renders "通过" or "失败"
  const statusBadgeVisible =
    await page.locator("text=通过").first().isVisible() ||
    await page.locator("text=失败").first().isVisible();
  assert("B-UI-10: 状态 badge 可见（通过 或 失败）", statusBadgeVisible);
  // Verify run record fields from API
  assert("B-UI-10: run.confirmationId 匹配",
    run.confirmationId === capturedConfirmationId,
    `expected ${capturedConfirmationId}, got ${run.confirmationId}`);
  assert("B-UI-10: run.planFingerprint 匹配",
    run.planFingerprint === firstPlanFingerprint,
    `expected ${firstPlanFingerprint}, got ${run.planFingerprint}`);
  const resultPanel = page.getByText(`运行 ${runIdPrefix}…`, { exact: true }).locator('..').locator('..');
  await resultPanel.getByText('AC-01', { exact: true }).click();
  await resultPanel.getByRole('button', { name: /查看截图/ }).first().click();
  const evidenceImage = resultPanel.getByRole('img', { name: '步骤截图' }).first();
  await evidenceImage.waitFor({ state: 'visible' });
  await page.waitForFunction(id => [...document.images].some(img => img.src.includes(id) && img.complete && img.naturalWidth > 0), runId);
  assert("B-UI-10: 图片来源属于本轮且真实加载", await evidenceImage.evaluate((img, id) => img.src.includes(id) && img.naturalWidth > 0, runId));
  await screenshot(page, '08b-real-evidence');

  // ── B-UI-11: Rerun with same confirmationId through the UI ───
  console.log("\n── B-UI-11: 同一 confirmationId 重新运行（指纹不变）──────────────");
  // Codex review: rerun through the actual webpage, without reconfirmation.
  const second = await triggerRunConfirmedAndWait(page, runBtn);
  const secondRunId = second.runId;
  assert("B-UI-11: 第二次 runId 存在", !!secondRunId, `got ${secondRunId}`);
  assert("B-UI-11: 第二次 runId 与第一次不同",
    secondRunId !== firstRunId, `both=${firstRunId}`);

  const rerunRec = { body: { run: second.run } };
  assert("B-UI-11: 重新运行全部通过", second.run.status === 'passed' && second.run.criteria.every(c => c.status === 'passed'));
  assert("B-UI-11: 重跑复用原确认记录", second.run.confirmationId === capturedConfirmationId);
  assert("B-UI-11: 第二次运行计划指纹与首次相同",
    rerunRec.body.run?.planFingerprint === firstPlanFingerprint,
    `expected ${firstPlanFingerprint}, got ${rerunRec.body.run?.planFingerprint}`);
  console.log(`  [second runId] ${secondRunId}`);
  // Codex review: wait for the webpage's own polling/render, not just the API result.
  const rerunHeading = page.getByText(`运行 ${secondRunId.slice(0, 8)}…`, { exact: true });
  await rerunHeading.waitFor({ state: 'visible', timeout: 10000 });
  assert('B-UI-11: 网页显示第二轮结果', await rerunHeading.isVisible());
  assert('B-UI-11: 完成后执行按钮再次可用', await runBtn.isEnabled());

  // ── B-UI-12: Final screenshot ──────────────────────────────────
  console.log("\n── B-UI-12: 最终截图 ─────────────────────────────────────────────");
  await screenshot(page, "09-stage-b-final");
  assert("B-UI-12: 截图已保存", true);

} catch (err) {
  console.error("⚠ 测试异常:", err.message);
  try { await screenshot(page, "error-state"); } catch { /* ignore */ }
  failed++;
} finally {
  await browser.close();
  serverProc.kill();
  viteProc.kill();
  await sleep(400);
  console.log("\n[服务已停止]");
}

// ── Summary ────────────────────────────────────────────────────────
console.log("\n════════════════════════════════════════");
console.log(`Stage B Web UI 测试结果：${passed} 通过  ${failed} 失败`);
console.log(`截图目录：runtime/screenshots/stage-b-ui-${TS}/`);
console.log("════════════════════════════════════════");
if (failed > 0) {
  console.error(`❌ ${failed} 个测试失败`);
  process.exit(1);
} else {
  console.log("🎉 所有 Stage B Web UI 测试通过");
}
