/**
 * Stage A acceptance runner script.
 * Starts the Ming server, runs normal + buggy (x2) acceptance runs via API,
 * then writes a JSON evidence file.
 */

import http from "http";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: "127.0.0.1",
      port: 4001,
      path: urlPath,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); } catch { reject(new Error("bad JSON: " + raw)); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function waitForServer(maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      await apiRequest("GET", "/api/plan");
      return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

async function pollUntilDone(runId, maxMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await apiRequest("GET", `/api/run/${runId}/progress`);
    if (!r.ok) throw new Error("progress error: " + r.error);
    if (r.progress.status !== "running") return r.progress;
    process.stdout.write(".");
    await sleep(2000);
  }
  throw new Error("run timed out after " + maxMs + "ms");
}

async function fetchRun(runId) {
  const r = await apiRequest("GET", `/api/run/${runId}`);
  if (!r.ok) throw new Error("fetch run error: " + r.error);
  return r.run;
}

async function runAcceptance(plan, variant) {
  const startResp = await apiRequest("POST", "/api/run", {
    variant,
    confirmed: true,
    confirmedPlanId: plan.planId,
    confirmedPlanFingerprint: plan.fingerprint,
  });
  if (!startResp.ok) throw new Error("start run failed: " + startResp.error);
  const { runId } = startResp;
  console.log(`  [${variant}] 运行ID: ${runId}`);
  process.stdout.write("  进度：");
  const progress = await pollUntilDone(runId);
  console.log(`\n  状态: ${progress.status}`);
  return fetchRun(runId);
}

async function main() {
  // Start the server
  console.log("▶ 启动 Ming Server…");
  const server = spawn("node", ["apps/server/dist/index.js"], {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => process.stdout.write("[server] " + d));
  server.stderr.on("data", (d) => process.stderr.write("[server] " + d));
  server.on("error", (e) => { console.error("server spawn error:", e); process.exit(1); });

  const ready = await waitForServer();
  if (!ready) {
    server.kill();
    console.error("❌ Server 未就绪，退出");
    process.exit(1);
  }
  console.log("✓ Server 已就绪\n");

  try {
    // Get plan
    const planResp = await apiRequest("GET", "/api/plan");
    if (!planResp.ok) throw new Error("get plan: " + planResp.error);
    const plan = planResp.plan;
    console.log(`计划: ${plan.title}`);
    console.log(`计划指纹: ${plan.fingerprint}\n`);

    const results = [];

    // Run 1: normal
    console.log("── 运行1：正常版 ──────────────────────────");
    const normalRun = await runAcceptance(plan, "normal");
    results.push({ label: "正常版（Run 1）", run: normalRun });
    printSummary(normalRun);

    // Run 2: buggy (first)
    console.log("\n── 运行2：预置缺陷版（第1次）──────────────");
    const buggyRun1 = await runAcceptance(plan, "buggy");
    results.push({ label: "缺陷版（Run 2，第1次）", run: buggyRun1 });
    printSummary(buggyRun1);

    // Run 3: buggy (second – fresh data, retain history)
    console.log("\n── 运行3：预置缺陷版（第2次，新数据）───────");
    const buggyRun2 = await runAcceptance(plan, "buggy");
    results.push({ label: "缺陷版（Run 3，第2次）", run: buggyRun2 });
    printSummary(buggyRun2);

    // Save evidence
    const evidencePath = path.join(PROJECT_ROOT, "runtime", "stage-a-evidence.json");
    fs.writeFileSync(evidencePath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n✓ 证据已保存: ${evidencePath}`);

    // Print final summary
    console.log("\n════════════════════════════════════════");
    console.log("Stage A 验证摘要");
    console.log("════════════════════════════════════════");
    for (const { label, run } of results) {
      const cs = run.criteria.map(c => `${c.criteriaId}:${c.status}`).join("  ");
      console.log(`${label.padEnd(24)} 总体:${run.status}  ${cs}`);
    }

    // Validate expected outcomes
    let allOk = true;
    const normal = results[0].run;
    if (!normal.criteria.every(c => c.status === "passed")) {
      console.error("❌ 正常版期望全部通过，但有失败");
      allOk = false;
    } else {
      console.log("✓ 正常版：AC-01/02/03 全部通过");
    }

    for (const { label, run } of results.slice(1)) {
      const ac01 = run.criteria.find(c => c.criteriaId === "AC-01");
      const ac02 = run.criteria.find(c => c.criteriaId === "AC-02");
      const ac03 = run.criteria.find(c => c.criteriaId === "AC-03");
      if (ac01?.status !== "passed") { console.error(`❌ ${label}: AC-01 应通过`); allOk = false; }
      if (ac02?.status !== "failed") { console.error(`❌ ${label}: AC-02 应失败`); allOk = false; }
      if (ac03?.status !== "passed") { console.error(`❌ ${label}: AC-03 应通过`); allOk = false; }
      if (allOk) console.log(`✓ ${label}：AC-01通过 AC-02失败 AC-03通过（符合预期）`);
    }

    if (allOk) {
      console.log("\n🎉 Stage A 所有期望结果确认正确");
    } else {
      console.error("\n❌ Stage A 部分期望未达成");
      process.exitCode = 1;
    }

  } finally {
    server.kill();
    console.log("\n[server已停止]");
  }
}

function printSummary(run) {
  console.log(`  运行ID:    ${run.runId}`);
  console.log(`  目标:      ${run.targetVariant}`);
  console.log(`  总体状态:  ${run.status}`);
  for (const c of run.criteria) {
    const icon = c.status === "passed" ? "✓" : c.status === "failed" ? "✗" : "·";
    console.log(`  ${icon} ${c.criteriaId} [${c.status}] ${c.title}`);
    if (c.blockedReason) console.log(`      └─ ${c.blockedReason}`);
    for (const s of c.steps) {
      if (s.status !== "passed") {
        console.log(`      ↳ ${s.stepId} [${s.status}]: ${s.description}`);
        if (s.actual) console.log(`          实际: ${s.actual}`);
        if (s.error) console.log(`          错误: ${s.error}`);
      }
    }
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
