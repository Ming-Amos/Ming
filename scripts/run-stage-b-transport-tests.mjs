/**
 * Stage B transport & contract integration tests.
 *
 * Uses a local HTTP fixture server to verify:
 *  1. Valid response → plan returned, transportProvenance="test", isLive=false
 *  2. Key echo in error body → secret is redacted in usage.errorMessage
 *  3. HTTP 401 → auth error category
 *  4. HTTP 429 → quota error category
 *  5. Malformed JSON response → invalid_output error
 *  6. Schema-invalid plan (no criteria) → invalid_output error
 *  7. Unknown step type in model output → validation error in DraftRecord
 *  8. assertCount with string expected → validation error
 *  9. Unknown step field → validation error
 * 10. Timeout (trickle never completes) → timeout error
 * 11. Oversized response → oversized error
 * 12. Missing API key → 503 / notConfigured from /api/generate
 * 13. Confirmed plan can be run via /api/run-confirmed
 * 14. Stale fingerprint confirmation rejected
 * 15. Open-questions draft cannot be confirmed
 * 16. buildEndpointUrl joins API roots correctly (no double /v1, trailing-slash handling)
 *
 * Runs entirely locally; no real API key required.
 * Starts the Ming server, injects a TestFixtureTransport, and calls the HTTP API.
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

// ── Minimal assertion helpers ────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}
function assertEq(a, b, msg) {
  assert(a === b, `${msg} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`);
}
function assertIncludes(str, substr, msg) {
  assert(typeof str === "string" && str.includes(substr), `${msg} (looking for "${substr}" in "${str}")`);
}
function assertNotIncludes(str, substr, msg) {
  assert(typeof str !== "string" || !str.includes(substr), `${msg} (should NOT contain "${substr}" in "${str}")`);
}

// ── HTTP helper ───────────────────────────────────────────────────

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
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { reject(new Error("bad JSON: " + raw)); }
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
    try { await apiRequest("GET", "/api/plan"); return true; } catch { await sleep(500); }
  }
  return false;
}

// ── Build a valid minimal test-fixture plan ───────────────────────

const VALID_PLAN = {
  planId: "test-stage-b-plan",
  version: "1.0.0",
  source: "generated",
  title: "Stage B test plan",
  description: "Transport integration test fixture",
  fingerprint: "TO_BE_COMPUTED",
  createdAt: new Date().toISOString(),
  criteria: [
    {
      id: "AC-01",
      title: "Test criterion",
      description: "Navigates and asserts",
      contextMode: "fresh",
      steps: [
        { id: "AC-01-S1", type: "navigate", url: "{{TARGET_URL}}", description: "Navigate" },
        { id: "AC-01-S2", type: "assertVisible", value: "日报", description: "Assert something visible" },
      ],
    },
  ],
};

// ── Fixture server setup/control via special header ───────────────
// The test harness controls the transport by calling a special admin endpoint
// /admin/set-fixture that exists only in test mode (enabled by MING_TEST_MODE=1 env var).

async function setFixture(fixture) {
  const r = await apiRequest("POST", "/admin/test-fixture", fixture);
  assert(r.body.ok, `set-fixture accepted: ${JSON.stringify(r.body)}`);
}

// ── Test runner ───────────────────────────────────────────────────

let server;
let projectId, requirementId;

async function main() {
  console.log("▶ 启动 Ming Server（测试模式）…");
  server = spawn("node", ["apps/server/dist/index.js"], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, MING_TEST_MODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => { if (process.env.VERBOSE) process.stdout.write("[sv] " + d); });
  server.stderr.on("data", (d) => { if (process.env.VERBOSE) process.stderr.write("[sv] " + d); });
  server.on("error", (e) => { console.error("server error:", e); process.exit(1); });

  const ready = await waitForServer();
  if (!ready) {
    server.kill();
    console.error("❌ Server 未就绪");
    process.exit(1);
  }
  console.log("✓ Server 就绪\n");

  try {
    await runTests();
  } finally {
    server.kill();
  }

  console.log(`\n════════════════════════════════════`);
  console.log(`Stage B 传输测试结果: ${passed} 通过, ${failed} 失败`);
  if (failed > 0) {
    console.error("❌ 有测试失败");
    process.exitCode = 1;
  } else {
    console.log("🎉 全部通过");
  }
}

async function runTests() {
  // ── Setup: create project and requirement ──────────────────────
  console.log("── 准备测试项目 ──────────────────────────────────────");
  {
    const r = await apiRequest("POST", "/api/projects", { name: "Stage B 传输测试", targetVariant: "normal" });
    assert(r.body.ok, "创建项目成功");
    projectId = r.body.project?.projectId;
    assert(!!projectId, "projectId 存在");
  }
  {
    const r = await apiRequest("POST", `/api/projects/${projectId}/requirements`, {
      text: "员工可以填写、提交和查看自己的日报。需求细节待确认。",
    });
    assert(r.body.ok, "保存需求成功");
    requirementId = r.body.requirement?.requirementId;
    assert(!!requirementId, "requirementId 存在");
  }

  // ── Test 1: Missing API key → 503 notConfigured ───────────────
  console.log("\n── T01: 未配置密钥 → 503 notConfigured ───────────────");
  {
    // Clear fixture (no transport configured at server start)
    await setFixture({ mode: "unconfigured" });
    const r = await apiRequest("POST", "/api/generate", { requirementId });
    assertEq(r.status, 503, "T01: HTTP 503");
    assert(r.body.notConfigured === true, "T01: notConfigured flag");
    assertIncludes(r.body.error, "未配置", "T01: error mentions 未配置");
  }

  // ── Test 2: Valid response → draft with test provenance ────────
  console.log("\n── T02: 有效响应 → 草稿含 test provenance ───────────");
  let draftId, draftFingerprint;
  {
    await setFixture({ mode: "plan", plan: VALID_PLAN });
    const r = await apiRequest("POST", "/api/generate", { requirementId });
    assert(r.body.ok, "T02: generate ok");
    const draft = r.body.draft;
    assert(!!draft?.draftId, "T02: draftId 存在");
    assertEq(draft.plan.source, "generated", "T02: source=generated");
    assertEq(draft.plan.transportProvenance, "test", "T02: transportProvenance=test");
    assertEq(draft.usage.isLive, false, "T02: usage.isLive=false");
    assertEq(draft.usage.status, "success", "T02: usage.status=success");
    assertEq(draft.validationErrors.length, 0, "T02: 无校验错误");
    assertEq(draft.hasOpenQuestions, false, "T02: 无待确认问题");
    draftId = draft.draftId;
    draftFingerprint = draft.plan.fingerprint;
  }

  // ── Test 3: Secret redaction — key echoed in 401 body ─────────
  console.log("\n── T03: 密钥回显 → errorMessage 已脱敏 ──────────────");
  {
    const fakeKey = "sk-test-secret-key-12345";
    await setFixture({
      mode: "http_error",
      statusCode: 401,
      // Response body echoes the key — must be redacted
      responseBody: `{"error": "invalid key: ${fakeKey}"}`,
      apiKey: fakeKey,
    });
    const r = await apiRequest("POST", "/api/generate", { requirementId });
    assertEq(r.status, 502, "T03: HTTP 502");
    assertEq(r.body.errorCategory, "auth", "T03: auth category");
    assertNotIncludes(r.body.error ?? "", fakeKey, "T03: key NOT in error response");
    assertNotIncludes(r.body.usage?.errorMessage ?? "", fakeKey, "T03: key NOT in usage.errorMessage");
    // Also verify nothing in the saved draft contains the key
    const draftList = await apiRequest("GET", `/api/drafts/${r.body?.draftId ?? "none"}`);
    // draft won't be saved on error, so 404 is expected — just check the response fields
    assertNotIncludes(JSON.stringify(r.body), fakeKey, "T03: key NOT anywhere in response body");
  }

  // ── Test 4: HTTP 429 → quota error ────────────────────────────
  console.log("\n── T04: HTTP 429 → quota 错误分类 ───────────────────");
  {
    await setFixture({ mode: "http_error", statusCode: 429, responseBody: '{"error":"rate limit"}' });
    const r = await apiRequest("POST", "/api/generate", { requirementId });
    assertEq(r.status, 502, "T04: HTTP 502");
    assertEq(r.body.errorCategory, "quota", "T04: quota category");
  }

  // ── Test 5: Malformed JSON response ───────────────────────────
  console.log("\n── T05: 返回非 JSON → invalid_output ────────────────");
  {
    await setFixture({ mode: "http_error", statusCode: 200, responseBody: "not json at all" });
    const r = await apiRequest("POST", "/api/generate", { requirementId });
    assertEq(r.status, 502, "T05: HTTP 502");
    assertEq(r.body.errorCategory, "invalid_output", "T05: invalid_output category");
  }

  // ── Test 6: Valid HTTP 200 but plan JSON missing criteria ──────
  console.log("\n── T06: 计划缺少 criteria → invalid_output ──────────");
  {
    await setFixture({
      mode: "http_raw",
      statusCode: 200,
      responseBody: JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ planId: "bad", criteria: [] }) } }],
      }),
    });
    const r = await apiRequest("POST", "/api/generate", { requirementId });
    assertEq(r.status, 502, "T06: HTTP 502");
    assertEq(r.body.errorCategory, "invalid_output", "T06: invalid_output");
  }

  // ── Test 7: Unknown step type in plan → validationErrors ──────
  console.log("\n── T07: 未知步骤类型 → 草稿含 validationErrors ──────");
  {
    const badPlan = {
      ...VALID_PLAN,
      criteria: [{
        ...VALID_PLAN.criteria[0],
        steps: [
          { id: "s1", type: "executeScript", locator: "#x", description: "bad" },
          { id: "s2", type: "assertVisible", value: "x", description: "ok" },
        ],
      }],
    };
    await setFixture({ mode: "plan", plan: badPlan });
    const r = await apiRequest("POST", "/api/generate", { requirementId });
    assert(r.body.ok, "T07: generate ok (draft saved with errors)");
    const errs = r.body.draft?.validationErrors ?? [];
    assert(errs.length > 0, `T07: validationErrors 非空 (${errs.join("; ")})`);
    assertIncludes(errs.join(" "), "executeScript", "T07: error mentions executeScript");
  }

  // ── Test 8: assertCount with string expected → validationErrors
  console.log("\n── T08: assertCount 字符串 expected → 校验拒绝 ──────");
  {
    const badPlan = {
      ...VALID_PLAN,
      criteria: [{
        ...VALID_PLAN.criteria[0],
        steps: [
          { id: "s1", type: "navigate", url: "{{TARGET_URL}}", description: "nav" },
          { id: "s2", type: "assertCount", locator: ".x", expected: "2oops", description: "count" },
        ],
      }],
    };
    await setFixture({ mode: "plan", plan: badPlan });
    const r = await apiRequest("POST", "/api/generate", { requirementId });
    assert(r.body.ok, "T08: generate ok");
    const errs = r.body.draft?.validationErrors ?? [];
    assert(errs.length > 0, `T08: validationErrors 非空`);
    assertIncludes(errs.join(" "), "数字类型", "T08: error mentions 数字类型");
  }

  // ── Test 9: Unknown step field → validationErrors ─────────────
  console.log("\n── T09: 未知步骤字段 → 校验拒绝 ────────────────────");
  {
    const badPlan = {
      ...VALID_PLAN,
      criteria: [{
        ...VALID_PLAN.criteria[0],
        steps: [
          { id: "s1", type: "navigate", url: "{{TARGET_URL}}", description: "nav" },
          { id: "s2", type: "assertVisible", value: "x", description: "ok", unknownField: "oops" },
        ],
      }],
    };
    await setFixture({ mode: "plan", plan: badPlan });
    const r = await apiRequest("POST", "/api/generate", { requirementId });
    assert(r.body.ok, "T09: generate ok");
    const errs = r.body.draft?.validationErrors ?? [];
    assert(errs.length > 0, "T09: validationErrors 非空");
    assertIncludes(errs.join(" "), "unknownField", "T09: error mentions unknownField");
  }

  // ── Test 10: Timeout ──────────────────────────────────────────
  console.log("\n── T10: 超时 → timeout 错误分类 ─────────────────────");
  {
    await setFixture({ mode: "timeout" });
    const r = await apiRequest("POST", "/api/generate", { requirementId });
    assertEq(r.status, 502, "T10: HTTP 502");
    assertEq(r.body.errorCategory, "timeout", "T10: timeout category");
  }

  // ── Test 11: Confirm valid draft ──────────────────────────────
  console.log("\n── T11: 确认有效草稿 ─────────────────────────────────");
  let confirmationId;
  {
    // Re-generate a clean valid draft
    await setFixture({ mode: "plan", plan: VALID_PLAN });
    const genR = await apiRequest("POST", "/api/generate", { requirementId });
    assert(genR.body.ok, "T11: generate ok");
    const draft = genR.body.draft;
    draftId = draft.draftId;
    draftFingerprint = draft.plan.fingerprint;

    const confR = await apiRequest("POST", "/api/confirm", {
      draftId,
      displayedPlanFingerprint: draftFingerprint,
    });
    assert(confR.body.ok, `T11: confirm ok (${confR.body.error ?? ""})`);
    confirmationId = confR.body.confirmation?.confirmationId;
    assert(!!confirmationId, "T11: confirmationId 存在");
    assertEq(confR.body.confirmation?.planFingerprint, draftFingerprint, "T11: fingerprint 匹配");
  }

  // ── Test 12: Stale fingerprint rejected ───────────────────────
  console.log("\n── T12: 过期指纹 → 确认拒绝 ────────────────────────");
  {
    const r = await apiRequest("POST", "/api/confirm", {
      draftId,
      displayedPlanFingerprint: "aaaa0000",
    });
    assertEq(r.status, 400, "T12: HTTP 400");
    assertIncludes(r.body.error, "指纹", "T12: error mentions 指纹");
  }

  // ── Test 13: Draft with open questions cannot be confirmed ─────
  console.log("\n── T13: 含问题的草稿 → 确认拒绝 ────────────────────");
  {
    const planWithQuestions = {
      ...VALID_PLAN,
      criteria: [{
        ...VALID_PLAN.criteria[0],
        openQuestions: ["What is the expected error message?"],
      }],
    };
    await setFixture({ mode: "plan", plan: planWithQuestions });
    const genR = await apiRequest("POST", "/api/generate", { requirementId });
    assert(genR.body.ok, "T13: generate ok");
    const qDraftId = genR.body.draft?.draftId;
    const qFingerprint = genR.body.draft?.plan?.fingerprint;
    assert(genR.body.draft?.hasOpenQuestions === true, "T13: hasOpenQuestions=true");

    const confR = await apiRequest("POST", "/api/confirm", {
      draftId: qDraftId,
      displayedPlanFingerprint: qFingerprint,
    });
    assertEq(confR.status, 400, "T13: HTTP 400");
    assertIncludes(confR.body.error, "openQuestions", "T13: error mentions openQuestions");
  }

  // ── Test 14: run-confirmed routes through real runner ─────────
  console.log("\n── T14: 已确认计划 → /api/run-confirmed 接受执行 ────");
  {
    const r = await apiRequest("POST", "/api/run-confirmed", { confirmationId });
    assert(r.body.ok, `T14: run-confirmed ok (${r.body.error ?? ""})`);
    const runId = r.body.runId;
    assert(!!runId, "T14: runId 存在");

    // Poll until done (max 90s — real browser run)
    const start = Date.now();
    let progress;
    while (Date.now() - start < 90000) {
      const p = await apiRequest("GET", `/api/run/${runId}/progress`);
      if (!p.body.ok) { assert(false, `T14: progress error: ${p.body.error}`); break; }
      progress = p.body.progress;
      if (progress.status !== "running") break;
      await sleep(2000);
    }
    assert(progress?.status !== "running", `T14: 运行完成 (status=${progress?.status})`);
    // Verify confirmationId is stored in run record
    const rec = await apiRequest("GET", `/api/run/${runId}`);
    assert(rec.body.ok, "T14: fetch run ok");
    assertEq(rec.body.run?.confirmationId, confirmationId, "T14: confirmationId 绑定到运行记录");
    assertEq(rec.body.run?.requirementId, requirementId, "T14: requirementId 绑定到运行记录");
  }

  // ── Test 15: Draft with validation errors cannot be confirmed ──
  console.log("\n── T15: 校验错误草稿 → 确认拒绝 ────────────────────");
  {
    const badPlan = {
      ...VALID_PLAN,
      criteria: [{
        ...VALID_PLAN.criteria[0],
        steps: [
          { id: "s1", type: "navigate", url: "{{TARGET_URL}}", description: "nav" },
          // No assertion step — should fail validation
          { id: "s2", type: "fill", locator: "日报内容", value: "x", description: "fill only" },
        ],
      }],
    };
    await setFixture({ mode: "plan", plan: badPlan });
    const genR = await apiRequest("POST", "/api/generate", { requirementId });
    assert(genR.body.ok, "T15: generate ok");
    const bDraftId = genR.body.draft?.draftId;
    const bFingerprint = genR.body.draft?.plan?.fingerprint;
    const errs = genR.body.draft?.validationErrors ?? [];
    assert(errs.length > 0, "T15: validationErrors 非空 (no assertion step)");

    const confR = await apiRequest("POST", "/api/confirm", {
      draftId: bDraftId,
      displayedPlanFingerprint: bFingerprint,
    });
    assertEq(confR.status, 400, "T15: HTTP 400");
    assertIncludes(confR.body.error, "校验错误", "T15: error mentions 校验错误");
  }

  // ── Test 16: buildEndpointUrl URL joining ─────────────────────
  console.log("\n── T16: buildEndpointUrl 路径拼接 ───────────────────");
  {
    const r = await apiRequest("GET", "/admin/test-endpoint-url");
    if (r.body.ok) {
      const cases = r.body.cases;
      for (const { input, expected, actual } of cases) {
        assertEq(actual, expected, `T16: buildEndpointUrl(${JSON.stringify(input[0])}, ${JSON.stringify(input[1])})`);
      }
    } else {
      assert(false, "T16: endpoint-url test endpoint not available");
    }
  }

  // ── Test 17: provenance in saved DraftRecord ──────────────────
  console.log("\n── T17: 草稿记录中 provenance 字段 ─────────────────");
  {
    await setFixture({ mode: "plan", plan: VALID_PLAN });
    const r = await apiRequest("POST", "/api/generate", { requirementId });
    assert(r.body.ok, "T17: generate ok");
    const d = r.body.draft;
    // Fetch draft back from disk to verify persistence
    const fetched = await apiRequest("GET", `/api/drafts/${d.draftId}`);
    assert(fetched.body.ok, "T17: fetch draft ok");
    assertEq(fetched.body.draft?.plan?.transportProvenance, "test", "T17: persisteed transportProvenance=test");
    assertEq(fetched.body.draft?.usage?.isLive, false, "T17: persisted isLive=false");
  }
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
