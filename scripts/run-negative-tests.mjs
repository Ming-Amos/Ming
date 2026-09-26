/**
 * Stage A negative-case test script.
 * Tests: unconfirmed, non-boolean confirmed, stale fingerprint, wrong planId,
 *        invalid variant, unreachable target.
 * Starts the Ming server internally, makes HTTP calls, asserts status+body,
 * and reports PASS/FAIL per case.
 */

import http from "http";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ── HTTP helper ────────────────────────────────────────────────────

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 4001,
        path: urlPath,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            reject(new Error("Non-JSON response: " + raw.slice(0, 200)));
          }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      await request("GET", "/api/plan");
      return true;
    } catch {
      await sleep(400);
    }
  }
  return false;
}

// ── Assertion helpers ──────────────────────────────────────────────

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

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const logFile = path.join(PROJECT_ROOT, "runtime", "server-neg-test.log");

  console.log("▶ 启动 Ming Server（负面测试用）…");
  const serverProc = spawn(
    "node",
    ["apps/server/dist/index.js"],
    {
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const logLines = [];
  serverProc.stdout.on("data", (d) => logLines.push(d.toString()));
  serverProc.stderr.on("data", (d) => logLines.push(d.toString()));
  serverProc.on("error", (e) => { console.error("spawn error:", e); process.exit(1); });

  const ready = await waitForServer();
  if (!ready) {
    serverProc.kill();
    console.error("❌ Server 未就绪");
    process.exit(1);
  }
  console.log("✓ Server 已就绪\n");

  try {
    // Get real plan for fingerprint/planId
    const planResp = await request("GET", "/api/plan");
    assert("GET /api/plan 返回 ok:true", planResp.body.ok === true);
    const plan = planResp.body.plan;
    const realPlanId = plan.planId;
    const realFingerprint = plan.fingerprint;

    console.log(`  计划ID: ${realPlanId}  指纹: ${realFingerprint}\n`);

    // ── Case 1: confirmed 缺失（不传 confirmed 字段）────────────────
    console.log("── Case 1: confirmed 字段缺失 ──────────────────────");
    {
      const r = await request("POST", "/api/run", {
        variant: "normal",
        confirmedPlanId: realPlanId,
        confirmedPlanFingerprint: realFingerprint,
        // confirmed not sent at all → undefined → not === true
      });
      assert("HTTP 400", r.status === 400, `got ${r.status}`);
      assert("ok: false", r.body.ok === false, JSON.stringify(r.body));
      assert("error 含 confirmed", /confirmed/i.test(r.body.error ?? ""), r.body.error);
    }

    // ── Case 2: confirmed = "true"（字符串而非布尔值）───────────────
    console.log("\n── Case 2: confirmed = \"true\"（字符串）────────────────");
    {
      const r = await request("POST", "/api/run", {
        variant: "normal",
        confirmed: "true",      // string, not boolean
        confirmedPlanId: realPlanId,
        confirmedPlanFingerprint: realFingerprint,
      });
      assert("HTTP 400", r.status === 400, `got ${r.status}`);
      assert("ok: false", r.body.ok === false);
      assert("error 含 confirmed", /confirmed/i.test(r.body.error ?? ""), r.body.error);
    }

    // ── Case 3: confirmed = 1（数字）────────────────────────────────
    console.log("\n── Case 3: confirmed = 1（数字 truthy）─────────────────");
    {
      const r = await request("POST", "/api/run", {
        variant: "normal",
        confirmed: 1,
        confirmedPlanId: realPlanId,
        confirmedPlanFingerprint: realFingerprint,
      });
      assert("HTTP 400", r.status === 400, `got ${r.status}`);
      assert("ok: false", r.body.ok === false);
    }

    // ── Case 4: 错误的 planId ────────────────────────────────────────
    console.log("\n── Case 4: 错误的 confirmedPlanId ───────────────────────");
    {
      const r = await request("POST", "/api/run", {
        variant: "normal",
        confirmed: true,
        confirmedPlanId: "wrong-plan-id",
        confirmedPlanFingerprint: realFingerprint,
      });
      assert("HTTP 400", r.status === 400, `got ${r.status}`);
      assert("ok: false", r.body.ok === false);
      assert("error 含 planId", /planId|plan/i.test(r.body.error ?? ""), r.body.error);
    }

    // ── Case 5: 过期/错误的计划指纹 ──────────────────────────────────
    console.log("\n── Case 5: 过期计划指纹 ────────────────────────────────");
    {
      const r = await request("POST", "/api/run", {
        variant: "normal",
        confirmed: true,
        confirmedPlanId: realPlanId,
        confirmedPlanFingerprint: "staledeadbeef000",
      });
      assert("HTTP 400", r.status === 400, `got ${r.status}`);
      assert("ok: false", r.body.ok === false);
      assert("error 含指纹相关词", /指纹|fingerprint/i.test(r.body.error ?? ""), r.body.error);
    }

    // ── Case 6: 无效 variant ─────────────────────────────────────────
    console.log("\n── Case 6: 无效目标 variant ────────────────────────────");
    {
      const r = await request("POST", "/api/run", {
        variant: "production-live",
        confirmed: true,
        confirmedPlanId: realPlanId,
        confirmedPlanFingerprint: realFingerprint,
      });
      assert("HTTP 400", r.status === 400, `got ${r.status}`);
      assert("ok: false", r.body.ok === false);
      assert("error 含 variant", /variant|版本|production-live/i.test(r.body.error ?? ""), r.body.error);
    }

    // ── Case 7: 404 for unknown runId ────────────────────────────────
    console.log("\n── Case 7: 未知 runId 返回 404 ─────────────────────────");
    {
      const r = await request("GET", "/api/run/00000000-0000-0000-0000-000000000000");
      assert("HTTP 404", r.status === 404, `got ${r.status}`);
      assert("ok: false", r.body.ok === false);
    }

    // ── Case 8: 404 for unknown progress ────────────────────────────
    console.log("\n── Case 8: 未知 runId 进度返回 404 ─────────────────────");
    {
      const r = await request("GET", "/api/run/00000000-0000-0000-0000-000000000000/progress");
      assert("HTTP 404", r.status === 404, `got ${r.status}`);
      assert("ok: false", r.body.ok === false);
    }

    // ── Case 9: 不可达目标 ────────────────────────────────────────────
    // We test this by temporarily pointing the plan to a port that is not listening.
    // The server only allows known variants so we can't pass a custom URL via API.
    // Instead we directly call the runner in-process to verify it handles unreachable URL.
    console.log("\n── Case 9: 目标不可达时记录 error（Runner 单元验证）───────");
    {
      // Dynamically import built runner (already compiled to dist/)
      // On Windows, ESM dynamic import requires a file:// URL for absolute paths.
      let runnerMod;
      const _runnerDistPath = path.join(PROJECT_ROOT, "packages/runner/dist/index.js");
      const _runnerDistUrl = new URL("file:///" + _runnerDistPath.replace(/\\/g, "/")).href;
      try {
        runnerMod = await import(_runnerDistUrl);
      } catch (e) {
        console.error("  ⚠ 无法加载 runner dist:", e.message);
        failed++;
        return;
      }
      const { PlanRunner } = runnerMod;
      const screenshotDir = path.join(PROJECT_ROOT, "runtime", "screenshots");
      const testRunId = "unreachable-test-" + Date.now();
      const runner = new PlanRunner({ screenshotDir, runId: testRunId });

      // Minimal valid plan pointing to a port we know isn't serving
      const unreachablePlan = {
        planId: "test-unreachable",
        version: "1.0.0",
        source: "fixture",
        title: "不可达测试计划",
        description: "测试目标不可达时的错误处理",
        fingerprint: "dummy",
        createdAt: new Date().toISOString(),
        criteria: [
          {
            id: "AC-U1",
            title: "导航到不可达地址",
            description: "测试",
            contextMode: "fresh",
            steps: [
              {
                id: "S1",
                type: "navigate",
                url: "http://127.0.0.1:19999/nonexistent",
                description: "打开不可达页面",
              },
            ],
          },
        ],
      };

      const record = await runner.run(
        unreachablePlan,
        { variant: "unreachable", url: "http://127.0.0.1:19999/nonexistent", fingerprint: "x" },
        "test-content"
      );

      // The navigation should fail with error status (not silently pass)
      assert(
        "不可达目标：整体状态为 error 或 failed（非 passed）",
        record.status !== "passed",
        `got status=${record.status}`
      );
      const ac = record.criteria[0];
      assert(
        "不可达目标：AC 状态为 error 或 failed（非 passed）",
        ac.status === "error" || ac.status === "failed",
        `got criteria status=${ac.status}`
      );
      const failedStep = ac.steps.find(s => s.status === "error" || s.status === "failed");
      assert(
        "不可达目标：有步骤记录错误",
        failedStep != null,
        "no error step found: " + JSON.stringify(ac.steps.map(s => s.status))
      );
      console.log(`    └─ 实际状态: ${record.status} / ${ac.status} / step: ${failedStep?.error?.slice(0, 80) ?? "n/a"}`);
    }

    // ── Case 10: 无效计划被 Runner 拒绝（未知 step type 和缺失必填字段）────
    console.log("\n── Case 10: 无效计划被 Runner 拒绝 ────────────────────");
    {
      // Re-use the already-imported runner module from Case 9 scope.
      // We need runner again — import once more (cached by Node module system).
      const _runnerDistPath2 = path.join(PROJECT_ROOT, "packages/runner/dist/index.js");
      const _runnerDistUrl2 = new URL("file:///" + _runnerDistPath2.replace(/\\/g, "/")).href;
      const runnerMod2 = await import(_runnerDistUrl2);
      const { PlanRunner: PlanRunner2 } = runnerMod2;
      const screenshotDir = path.join(PROJECT_ROOT, "runtime", "screenshots");

      // Sub-case A: unknown step type
      {
        const runner = new PlanRunner2({ screenshotDir, runId: "invalid-plan-test-A-" + Date.now() });
        const badTypePlan = {
          planId: "bad-type-plan",
          version: "1.0.0",
          source: "fixture",
          title: "无效步骤类型测试",
          description: "test",
          fingerprint: "dummy",
          createdAt: new Date().toISOString(),
          criteria: [{
            id: "C1",
            title: "test",
            description: "test",
            contextMode: "fresh",
            steps: [{
              id: "S1",
              type: "executeScript",   // not in ALLOWED_STEP_TYPES
              description: "非法步骤",
            }],
          }],
        };
        let threw = false;
        let errMsg = "";
        try {
          await runner.run(badTypePlan, { variant: "x", url: "http://127.0.0.1:4001/normal", fingerprint: "x" }, "t");
        } catch (e) {
          threw = true;
          errMsg = e.message;
        }
        assert(
          "未知 step type 抛出错误（不执行浏览器）",
          threw,
          "should throw but did not"
        );
        assert(
          "错误消息含 executeScript 或未注册",
          /executeScript|未注册/i.test(errMsg),
          errMsg
        );
        console.log(`    └─ 错误: ${errMsg.slice(0, 100)}`);
      }

      // Sub-case B: fill step missing required 'locator' field
      {
        const runner = new PlanRunner2({ screenshotDir, runId: "invalid-plan-test-B-" + Date.now() });
        const missingFieldPlan = {
          planId: "missing-field-plan",
          version: "1.0.0",
          source: "fixture",
          title: "缺失必填字段测试",
          description: "test",
          fingerprint: "dummy",
          createdAt: new Date().toISOString(),
          criteria: [{
            id: "C1",
            title: "test",
            description: "test",
            contextMode: "fresh",
            steps: [
              {
                id: "S1",
                type: "navigate",
                url: "http://127.0.0.1:4001/normal",
                description: "打开页面",
              },
              {
                id: "S2",
                type: "fill",
                // locator intentionally missing
                value: "somevalue",
                description: "填写内容（缺 locator）",
              },
            ],
          }],
        };
        let threw2 = false;
        let errMsg2 = "";
        try {
          await runner.run(missingFieldPlan, { variant: "x", url: "http://127.0.0.1:4001/normal", fingerprint: "x" }, "t");
        } catch (e) {
          threw2 = true;
          errMsg2 = e.message;
        }
        assert(
          "fill 缺 locator 字段时抛出错误",
          threw2,
          "should throw but did not"
        );
        assert(
          "错误消息含 locator 或缺少",
          /locator|缺少/i.test(errMsg2),
          errMsg2
        );
        console.log(`    └─ 错误: ${errMsg2.slice(0, 100)}`);
      }
    }

    // ── Summary ───────────────────────────────────────────────────
    console.log("\n════════════════════════════════════════");
    console.log(`负面测试结果：${passed} 通过  ${failed} 失败`);
    console.log("════════════════════════════════════════");

    if (failed > 0) {
      process.exitCode = 1;
    } else {
      console.log("🎉 所有负面测试通过");
    }

  } finally {
    serverProc.kill();
    console.log("[server 已停止]");
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
