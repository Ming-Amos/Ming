/**
 * Stage A Web UI validation script.
 *
 * Uses createRequire anchored to packages/runner for Playwright,
 * and spawns Vite via its real JS bin (vite/bin/vite.js via node),
 * not the shell-script .bin/vite wrapper.
 *
 * Strengthened checks:
 *  - Capture runId from the API response intercepted in the page context
 *  - Wait for THAT specific runId to finish (not arbitrary page text)
 *  - Assert normal: AC-01/02/03 all passed; buggy: AC-01 passed, AC-02 failed, AC-03 passed
 *  - Open the failed AC-02 criterion; assert expected/actual text visible
 *  - Assert the failure screenshot image loads (naturalWidth > 0)
 *  - Select a history entry by specific runId (not div style); fail if not found
 *  - Timestamped UI screenshot sub-directory under runtime/screenshots/
 */

import { createRequire } from "module";
import { spawn } from "child_process";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Resolve playwright from packages/runner where it is installed
const requireFromRunner = createRequire(
  path.join(PROJECT_ROOT, "packages/runner/package.json")
);
const { chromium } = requireFromRunner("playwright");

// Screenshot directory — timestamped sub-folder
const TS = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const UI_SCREENSHOTS_DIR = path.join(PROJECT_ROOT, "runtime", "screenshots", `ui-${TS}`);
fs.mkdirSync(UI_SCREENSHOTS_DIR, { recursive: true });

// ── Helpers ────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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
    } catch {
      await sleep(400);
    }
  }
  return false;
}

function apiGet(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:4001${urlPath}`, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { reject(new Error("Non-JSON: " + raw.slice(0, 200))); }
      });
    });
    req.on("error", reject);
  });
}

let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

async function screenshot(page, name) {
  const filePath = path.join(UI_SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  📸 ${name}.png`);
  return filePath;
}

/**
 * Intercept the next POST /api/run response to capture the runId,
 * click the start button, and wait for the specific run to finish.
 * Returns the full RunRecord from /api/run/:runId.
 */
async function triggerRunAndWait(page, startBtn, timeoutMs = 120000) {
  // Set up route interception BEFORE clicking so we don't miss the response
  let capturedRunId = null;
  await page.route("**/api/run", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (json.ok && json.runId) {
      capturedRunId = json.runId;
    }
    await route.fulfill({ response });
  });

  await startBtn.click();

  // Wait until capturedRunId is populated (max 5s for the API call)
  const runIdDeadline = Date.now() + 5000;
  while (!capturedRunId && Date.now() < runIdDeadline) {
    await sleep(100);
  }
  if (!capturedRunId) {
    throw new Error("Did not capture runId from POST /api/run within 5s");
  }
  await page.unroute("**/api/run");
  console.log(`  [captured runId] ${capturedRunId}`);

  // Poll the API directly for THIS specific runId
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await apiGet(`/api/run/${capturedRunId}/progress`);
    if (!r.body.ok) throw new Error("progress error: " + JSON.stringify(r.body));
    if (r.body.progress.status !== "running") break;
    process.stdout.write(".");
    await sleep(1500);
  }
  console.log("");

  // Fetch full record
  const recResp = await apiGet(`/api/run/${capturedRunId}`);
  if (!recResp.body.ok) throw new Error("fetch run failed: " + JSON.stringify(recResp.body));
  return { runId: capturedRunId, record: recResp.body.run };
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  // ── Start API server ───────────────────────────────────────────
  console.log("▶ 启动 Ming Server (port 4001)…");
  const apiServer = spawn("node", ["apps/server/dist/index.js"], {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  apiServer.stdout.on("data", (d) => {
    if (process.env.VERBOSE) process.stdout.write("[api] " + d);
  });
  apiServer.stderr.on("data", (d) => process.stderr.write("[api-err] " + d));
  apiServer.on("error", (e) => { console.error("API server spawn error:", e); process.exit(1); });

  // ── Start Vite dev server via its real JS bin ──────────────────
  console.log("▶ 启动 Vite Dev Server (port 4000)…");
  const viteBin = path.join(PROJECT_ROOT, "apps/web/node_modules/vite/bin/vite.js");
  const viteServer = spawn(
    process.execPath,   // same `node` binary
    [viteBin, "--port", "4000", "--host", "127.0.0.1"],
    {
      cwd: path.join(PROJECT_ROOT, "apps/web"),
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  viteServer.stdout.on("data", (d) => {
    if (process.env.VERBOSE) process.stdout.write("[vite] " + d);
  });
  viteServer.stderr.on("data", (d) => {
    if (process.env.VERBOSE) process.stderr.write("[vite-err] " + d);
  });
  viteServer.on("error", (e) => { console.error("Vite spawn error:", e); process.exit(1); });

  const [apiReady, viteReady] = await Promise.all([
    waitForPort(4001),
    waitForPort(4000),
  ]);

  if (!apiReady) {
    console.error("❌ API server (4001) 未就绪");
    apiServer.kill(); viteServer.kill(); process.exit(1);
  }
  if (!viteReady) {
    console.error("❌ Vite server (4000) 未就绪");
    apiServer.kill(); viteServer.kill(); process.exit(1);
  }
  console.log("✓ 两个服务已就绪\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Track runIds for history check
  let normalRunId = null;
  let buggyRunId = null;

  try {
    // ── Test 1: Page loads and displays plan + fixture notice ─────
    console.log("── Test 1: 页面加载与计划展示 ──────────────────────────");
    await page.goto("http://127.0.0.1:4000/", { waitUntil: "networkidle" });
    await screenshot(page, "01-initial-load");

    const title = await page.title();
    assert("页面标题包含 Ming", title.includes("Ming"), title);

    const heading = await page.textContent("h1");
    assert("H1 标题为 Ming", heading?.trim() === "Ming", heading ?? "");

    const fixtureBadge = await page.locator("text=开发验证样例").first().isVisible();
    assert("显示开发验证样例提示（fixture 标记）", fixtureBadge);

    const planTitleVisible = await page.locator("text=日报系统验收计划").first().isVisible();
    assert("显示计划标题", planTitleVisible);

    const ac01 = await page.locator("text=AC-01").first().isVisible();
    const ac02 = await page.locator("text=AC-02").first().isVisible();
    const ac03 = await page.locator("text=AC-03").first().isVisible();
    assert("AC-01/02/03 均显示在计划区", ac01 && ac02 && ac03);

    // ── Test 2: Target selector shows both options ────────────────
    console.log("\n── Test 2: 目标选择器 ──────────────────────────────────");
    const normalBtn = page.locator("button", { hasText: "正常版" }).first();
    const buggyBtn  = page.locator("button", { hasText: "预置缺陷版" }).first();
    assert("正常版按钮可见", await normalBtn.isVisible());
    assert("预置缺陷版按钮可见", await buggyBtn.isVisible());

    // ── Test 3: Start button disabled until confirmed ─────────────
    console.log("\n── Test 3: 确认前按钮禁用 ───────────────────────────────");
    const startBtn = page.locator("button", { hasText: /开始验收|运行中/ }).first();
    assert("确认前 [开始验收] 禁用", await startBtn.isDisabled());

    const checkbox = page.locator('input[type="checkbox"]').first();
    await checkbox.check();
    await sleep(200);
    assert("确认后 [开始验收] 可用", await startBtn.isEnabled());
    await screenshot(page, "02-confirmed-normal");

    // ── Test 4: Normal run via UI ────────────────────────────────
    console.log("\n── Test 4: 通过 UI 执行正常版验收 ─────────────────────");
    await normalBtn.click();
    await sleep(100);
    if (!(await checkbox.isChecked())) await checkbox.check();
    await sleep(100);

    const { runId: nRunId, record: normalRecord } = await triggerRunAndWait(page, startBtn);
    normalRunId = nRunId;

    // Wait for page to reflect the result (the UI polls and renders)
    await page.waitForFunction(
      () => document.body.innerText.includes("通过") || document.body.innerText.includes("失败"),
      { timeout: 10000 }
    ).catch(() => null);
    await screenshot(page, "03-result-normal");

    // Assert via the API record (not page text) — precise per-criterion check
    assert(
      "正常版整体状态 passed",
      normalRecord.status === "passed",
      `got ${normalRecord.status}`
    );
    const nAC01 = normalRecord.criteria.find(c => c.criteriaId === "AC-01");
    const nAC02 = normalRecord.criteria.find(c => c.criteriaId === "AC-02");
    const nAC03 = normalRecord.criteria.find(c => c.criteriaId === "AC-03");
    assert("正常版 AC-01 passed", nAC01?.status === "passed", nAC01?.status);
    assert("正常版 AC-02 passed", nAC02?.status === "passed", nAC02?.status);
    assert("正常版 AC-03 passed", nAC03?.status === "passed", nAC03?.status);

    // ── Test 5: Buggy run via UI ─────────────────────────────────
    console.log("\n── Test 5: 通过 UI 执行缺陷版验收 ─────────────────────");
    await buggyBtn.click();
    await sleep(200);
    if (!(await checkbox.isChecked())) await checkbox.check();
    await sleep(100);

    const { runId: bRunId, record: buggyRecord } = await triggerRunAndWait(page, startBtn);
    buggyRunId = bRunId;

    await page.waitForFunction(
      () => document.body.innerText.includes("失败"),
      { timeout: 10000 }
    ).catch(() => null);
    await screenshot(page, "04-result-buggy");

    // Per-criterion assertions on the API record
    assert(
      "缺陷版整体状态 failed",
      buggyRecord.status === "failed",
      `got ${buggyRecord.status}`
    );
    const bAC01 = buggyRecord.criteria.find(c => c.criteriaId === "AC-01");
    const bAC02 = buggyRecord.criteria.find(c => c.criteriaId === "AC-02");
    const bAC03 = buggyRecord.criteria.find(c => c.criteriaId === "AC-03");
    assert("缺陷版 AC-01 passed", bAC01?.status === "passed", bAC01?.status);
    assert("缺陷版 AC-02 failed", bAC02?.status === "failed", bAC02?.status);
    assert("缺陷版 AC-03 passed", bAC03?.status === "passed", bAC03?.status);

    // ── Test 6: Expand failed AC-02; check expected/actual and screenshot ─
    console.log("\n── Test 6: AC-02 失败详情与截图验证 ───────────────────");

    // The AC-02 card header should be visible in the result panel.
    // It expands on click if not already open (failed cards default open in App.tsx).
    const ac02Card = page.locator("text=AC-02").first();
    assert("AC-02 card 可见", await ac02Card.isVisible());

    // The expected/actual text comes from the step detail. Wait for it.
    await page.waitForSelector("text=期望", { timeout: 5000 }).catch(() => null);
    const expectedRowVisible = await page.locator("text=期望").first().isVisible().catch(() => false);
    assert("显示 '期望' 标签", expectedRowVisible);

    const actualRowVisible = await page.locator("text=实际").first().isVisible().catch(() => false);
    assert("显示 '实际' 标签", actualRowVisible);

    // Verify the actual screenshot in the result: find the "查看截图" button for AC-02's failure step
    // The failure step for AC-02 is AC-02-S2. Its screenshot button should appear.
    // First find any 查看截图 button on page
    const screenshotBtns = await page.locator("button", { hasText: "查看截图" }).all();
    assert("存在查看截图按钮", screenshotBtns.length > 0, `found ${screenshotBtns.length}`);

    if (screenshotBtns.length > 0) {
      await screenshotBtns[0].click();
      await sleep(600);
      await screenshot(page, "05-ac02-screenshot-expanded");

      // Verify the screenshot image actually loads (naturalWidth > 0)
      const imgLoaded = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll("img[alt='步骤截图']"));
        if (imgs.length === 0) return { ok: false, reason: "no img element found" };
        const img = imgs[0];
        if (img.naturalWidth > 0) return { ok: true, naturalWidth: img.naturalWidth };
        return { ok: false, reason: `naturalWidth=${img.naturalWidth}, complete=${img.complete}, src=${img.src.slice(0, 80)}` };
      });
      assert(
        "AC-02 失败截图已加载（naturalWidth > 0）",
        imgLoaded.ok,
        imgLoaded.reason ?? ""
      );
      console.log(`  └─ screenshot naturalWidth: ${imgLoaded.naturalWidth ?? "n/a"}`);
    }

    // ── Test 7: History panel — select by specific runId ─────────
    console.log("\n── Test 7: 历史面板按 runId 选择 ───────────────────────");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(400);
    await screenshot(page, "06-history-panel");

    // History panel must be visible
    const historyHeading = await page.locator("text=历史记录").first().isVisible().catch(() => false);
    assert("历史记录面板可见", historyHeading);

    // Find the row that contains the exact normalRunId prefix (first 8 chars shown)
    const shortId = normalRunId.slice(0, 8);
    const historyRow = page.locator(`text=${shortId}`).first();
    const historyRowVisible = await historyRow.isVisible().catch(() => false);
    if (!historyRowVisible) {
      // This is a hard failure: the history row for our run must exist
      assert(`历史中存在 runId 前缀 ${shortId}`, false, "row not found in DOM");
    } else {
      assert(`历史中存在 runId 前缀 ${shortId}`, true);
      await historyRow.click();
      await sleep(500);
      await screenshot(page, "07-history-detail");

      const historyDetailVisible = await page.locator("text=历史详情").first().isVisible().catch(() => false);
      assert("点击历史条目后显示 '历史详情' 面板", historyDetailVisible);

      // The detail panel should contain the full runId fingerprint info
      const pageText = await page.textContent("body");
      assert(
        "历史详情面板含 runId 的前8字符",
        pageText?.includes(shortId) ?? false,
        "shortId not in body"
      );
    }

  } finally {
    await browser.close();
    apiServer.kill();
    viteServer.kill();
    console.log("\n[浏览器和服务已停止]");
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════");
  console.log(`Web UI 测试结果：${passed} 通过  ${failed} 失败`);
  console.log(`截图目录：runtime/screenshots/ui-${TS}/`);
  console.log("════════════════════════════════════════");

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log("🎉 所有 Web UI 测试通过");
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
