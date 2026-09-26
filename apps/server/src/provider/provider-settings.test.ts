/** Local HTTP fixtures only. These tests do not call a commercial model provider. */
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import express from "express";
import { mountProviderRoutes } from "../provider-routes";
import { configureProviderStorage, saveProviderConfig, clearProviderConfig, getProviderStatus, createLiveTransport,
  testProviderConnection, recordProviderUsage, validateProviderBaseUrl } from "./index";

const fakeKey = "test-only-fixture-provider-key-abc123";
const savedEnvironment = Object.fromEntries(["PROVIDER_BASE_URL", "PROVIDER_LABEL", "PROVIDER_MODEL_ID", "PROVIDER_API_KEY", "MING_PUBLIC_DEMO"].map(key => [key, process.env[key]]));
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ming-provider-tests-"));
let runtimeDir: string, baseUrl: string, requestCount = 0;
let captured: Record<string, unknown> | undefined;
let responseMode = "ok";
const mock = http.createServer((req, res) => {
  requestCount++;
  let body = "";
  req.on("data", part => { body += part; });
  req.on("end", () => {
    captured = JSON.parse(body) as Record<string, unknown>;
    if (responseMode === "timeout") return;
    if (responseMode === "auth") { res.writeHead(401).end(`Rejected ${fakeKey} ${encodeURIComponent(fakeKey)}`); return; }
    if (responseMode === "quota") { res.writeHead(429).end(`Quota ${fakeKey}`); return; }
    if (responseMode === "redirect") { res.writeHead(302, { Location: `${baseUrl}/redirect-target` }).end(); return; }
    if (responseMode === "oversize") { res.end("x".repeat(34 * 1024)); return; }
    if (responseMode === "invalid") { res.end(`invalid ${fakeKey}`); return; }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { content: responseMode === "echo-secret" ? fakeKey : "OK" } }],
      ...(responseMode === "no-usage" ? {} : { usage: { prompt_tokens: 11, completion_tokens: 2 } }) }));
  });
});
before(async () => {
  await new Promise<void>(resolve => mock.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(mock.address() as { port: number }).port}/v1`;
});
beforeEach(() => {
  for (const key of Object.keys(savedEnvironment)) delete process.env[key];
  runtimeDir = fs.mkdtempSync(path.join(temporaryRoot, "case-"));
  configureProviderStorage(runtimeDir); requestCount = 0; captured = undefined; responseMode = "ok";
});
after(async () => {
  mock.closeAllConnections(); await new Promise<void>(resolve => mock.close(() => resolve()));
  for (const [key, value] of Object.entries(savedEnvironment)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const resolved = path.resolve(temporaryRoot), tempParent = path.resolve(os.tmpdir());
  assert.equal(path.dirname(resolved), tempParent); assert.ok(path.basename(resolved).startsWith("ming-provider-tests-"));
  fs.rmSync(resolved, { recursive: true, force: true });
});
function save(key = fakeKey) { return saveProviderConfig({ providerLabel: "Local test fixture", baseUrl, modelId: "fixture-model", apiKey: key }); }

test("saving activates immediately, returns no secret and sends no model call", () => {
  assert.equal(getProviderStatus().configured, false);
  assert.equal(createLiveTransport(), null);
  const status = save();
  assert.equal(status.configured, true); assert.equal(status.configSource, "local"); assert.equal(status.hasKey, true);
  assert.equal(status.keyStored, true); assert.equal(requestCount, 0); assert.ok(createLiveTransport());
  assert.ok(!JSON.stringify(status).includes(fakeKey));
  if (process.platform !== "win32") assert.equal(fs.statSync(path.join(runtimeDir, "provider-config.json")).mode & 0o777, 0o600);
});
test("blank or omitted key retains the existing key; explicit deletion clears it", () => {
  save(); saveProviderConfig({ providerLabel: "Renamed fixture", baseUrl, modelId: "fixture-model", apiKey: "  " });
  assert.equal(JSON.parse(fs.readFileSync(path.join(runtimeDir, "provider-config.json"), "utf8")).apiKey, fakeKey);
  saveProviderConfig({ providerLabel: "Renamed fixture", baseUrl, modelId: "fixture-model" });
  assert.equal(getProviderStatus().hasKey, true);
  save("test-only-replaced-key");
  assert.equal(JSON.parse(fs.readFileSync(path.join(runtimeDir, "provider-config.json"), "utf8")).apiKey, "test-only-replaced-key");
  assert.equal(clearProviderConfig().hasKey, false); assert.equal(fs.existsSync(path.join(runtimeDir, "provider-config.json")), false);
});
test("failed atomic persistence leaves the active configuration unchanged and removes temporary files", () => {
  save();
  const destination = path.join(runtimeDir, "provider-config.json");
  fs.renameSync(destination, path.join(runtimeDir, "prior-config.json"));
  fs.mkdirSync(destination); // Force a deterministic rename failure on every OS.
  assert.throws(() => saveProviderConfig({ providerLabel: "Must not activate", baseUrl, modelId: "new-model", apiKey: "test-only-new-key" }), /Could not save/);
  assert.equal(getProviderStatus().providerLabel, "Local test fixture");
  assert.equal(getProviderStatus().modelId, "fixture-model");
  assert.ok(!fs.readdirSync(runtimeDir).some(name => name.endsWith(".tmp")));
  assert.equal(requestCount, 0);
});
test("local config survives reload and a fresh Node process", () => {
  save(); configureProviderStorage(runtimeDir); assert.equal(getProviderStatus().configured, true);
  const source = path.join(__dirname, "index.ts");
  const modulePath = fs.existsSync(source) ? source : path.join(__dirname, "index.js");
  const child = spawnSync(process.execPath, [...(modulePath.endsWith(".ts") ? ["-r", "ts-node/register"] : []), "-e", "const p=require(process.argv[1]);p.configureProviderStorage(process.argv[2]);process.stdout.write(JSON.stringify(p.getProviderStatus()));", modulePath, runtimeDir], {
    cwd: path.resolve(__dirname, "../.."), encoding: "utf8", timeout: 20_000,
  });
  assert.equal(child.status, 0, "fresh process must load persisted configuration");
  const status = JSON.parse(child.stdout); assert.equal(status.configured, true); assert.equal(status.configSource, "local"); assert.equal(status.modelId, "fixture-model");
  assert.ok(!child.stdout.includes(fakeKey)); assert.equal(requestCount, 0);
});
test("environment overrides local config explicitly; deleting local does not delete environment", () => {
  save(); process.env.PROVIDER_BASE_URL = baseUrl; process.env.PROVIDER_MODEL_ID = "environment-model"; process.env.PROVIDER_API_KEY = "test-only-env-key";
  assert.equal(getProviderStatus().configSource, "environment"); assert.equal(getProviderStatus().modelId, "environment-model");
  assert.throws(() => save(), /environment variables/);
  const status = clearProviderConfig(); assert.equal(status.configured, true); assert.equal(status.keyStored, false); assert.equal(status.hasKey, true);
  assert.ok(!JSON.stringify(status).includes("test-only-env-key"));
});
test("rejects unsafe schemes, remote HTTP and URL secrets without echoing them", () => {
  for (const invalid of ["ftp://example.com", "http://example.com/v1", "file:///tmp/api", "data:text/plain,test", "https://example.com/v1?", "https://example.com/v1#", `https://name:${fakeKey}@example.com/v1`, `https://example.com/v1?key=${fakeKey}`, `https://example.com/v1#${fakeKey}`]) {
    assert.throws(() => saveProviderConfig({ providerLabel: "Fixture", baseUrl: invalid, modelId: "test", apiKey: fakeKey }), (error: unknown) => error instanceof Error && !error.message.includes(fakeKey));
  }
  assert.equal(validateProviderBaseUrl("https://example.com/compatible/v1/"), "https://example.com/compatible/v1");
  assert.equal(validateProviderBaseUrl("http://[::1]:11434/v1"), "http://[::1]:11434/v1");
  assert.equal(validateProviderBaseUrl("http://127.0.0.2:1234/v1"), "http://127.0.0.2:1234/v1");
  assert.throws(() => saveProviderConfig({ providerLabel: fakeKey, baseUrl, modelId: "test", apiKey: fakeKey }));
  assert.throws(() => saveProviderConfig({ providerLabel: "Fixture", baseUrl, modelId: "test", apiKey: "line1\nline2" }));
});
test("explicit connection test sends exactly one small request and persists real token counts", async () => {
  save(); assert.equal(requestCount, 0);
  const result = await testProviderConnection();
  assert.equal(result.ok, true); assert.equal(requestCount, 1); assert.equal(captured?.max_tokens, 8);
  assert.equal(result.inputTokens, 11); assert.equal(result.outputTokens, 2);
  const status = getProviderStatus(); assert.equal(status.lastTest?.ok, true); assert.equal(status.usageSummary.connectionTestCalls, 1);
  configureProviderStorage(runtimeDir); assert.equal(getProviderStatus().usageSummary.knownInputTokens, 11);
  assert.equal(getProviderStatus().lastTest?.ok, true); assert.equal(requestCount, 1);
  saveProviderConfig({ providerLabel: "Local test fixture", baseUrl, modelId: "changed-model" });
  assert.equal(getProviderStatus().lastTest, undefined);
});
test("provider errors are categorized; echoed secrets and raw responses are never returned or recorded", async () => {
  save(); responseMode = "auth";
  const failure = await testProviderConnection(); assert.equal(failure.ok, false); assert.equal(failure.category, "auth");
  assert.ok(!JSON.stringify(failure).includes(fakeKey)); assert.ok(!JSON.stringify(getProviderStatus()).includes(fakeKey));
  responseMode = "quota"; assert.equal((await testProviderConnection()).category, "quota");
  responseMode = "echo-secret"; const success = await testProviderConnection(); assert.equal(success.ok, true); assert.ok(!JSON.stringify(success).includes(fakeKey));
  assert.ok(!fs.readFileSync(path.join(runtimeDir, "provider-usage.json"), "utf8").includes(fakeKey));
});
test("the generation transport uses saved settings and redacts provider error key echoes", async () => {
  save(); responseMode = "auth";
  const result = await createLiveTransport()!.generate({ requirement: "Create a task", pageContext: null, projectId: "local-test", requirementId: "local-requirement" });
  assert.equal(result.ok, false); assert.equal(result.usage.errorCategory, "auth");
  assert.ok(!JSON.stringify(result).includes(fakeKey)); assert.equal(requestCount, 1);
  assert.equal(captured?.model, "fixture-model");
});
test("invalid outputs, response cap, redirect rejection and absent usage remain honest", async () => {
  save(); responseMode = "invalid"; assert.equal((await testProviderConnection()).category, "invalid_output");
  responseMode = "oversize"; assert.equal((await testProviderConnection()).ok, false);
  responseMode = "redirect"; assert.equal((await testProviderConnection()).ok, false); assert.equal(requestCount, 3);
  responseMode = "no-usage"; const result = await testProviderConnection(); assert.equal(result.ok, true); assert.equal(result.inputTokens, null);
  assert.equal(getProviderStatus().usageSummary.callsWithUnreportedTokens, 4);
});
test("hard connection-test deadline and concurrent-click guard prevent unbounded requests", async () => {
  save(); responseMode = "timeout";
  const pending = testProviderConnection(); await assert.rejects(testProviderConnection(), /already running/);
  const result = await pending; assert.equal(result.category, "timeout"); assert.ok(result.durationMs >= 9000 && result.durationMs < 14000); assert.equal(requestCount, 1);
});
test("generation usage excludes test transport and bounds retained actual-call metadata", () => {
  const usage = { providerLabel: "Fixture", modelId: "model", invokedAt: new Date().toISOString(), durationMs: 1, isLive: false, status: "success" as const, inputTokens: 2, outputTokens: 3 };
  recordProviderUsage(usage); assert.equal(getProviderStatus().usageSummary.retainedCalls, 0);
  for (let i = 0; i < 202; i++) recordProviderUsage({ ...usage, isLive: true });
  const summary = getProviderStatus().usageSummary; assert.equal(summary.retainedCalls, 200); assert.equal(summary.generationCalls, 200); assert.equal(summary.knownOutputTokens, 600);
});
test("provider HTTP routes omit secrets and public mode blocks config/testing even without the parent guard", async () => {
  const app = express(); app.use(express.json()); mountProviderRoutes(app, runtimeDir);
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const address = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const saved = await fetch(`${address}/api/provider/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerLabel: "Fixture", baseUrl, modelId: "fixture", apiKey: fakeKey }) });
    assert.equal(saved.status, 200); assert.ok(!(await saved.text()).includes(fakeKey)); assert.equal(requestCount, 0);
    process.env.MING_PUBLIC_DEMO = "1";
    const publicStatus = await fetch(`${address}/api/provider/status`); const data = await publicStatus.json() as { status: { readOnly: boolean; baseUrl: string; modelId: string } };
    assert.equal(publicStatus.headers.get("cache-control"), "no-store"); assert.equal(data.status.readOnly, true); assert.equal(data.status.baseUrl, ""); assert.equal(data.status.modelId, "");
    for (const [method, route] of [["PUT", "config"], ["DELETE", "config"], ["POST", "test"]]) assert.equal((await fetch(`${address}/api/provider/${route}`, { method })).status, 403);
    assert.equal(requestCount, 0);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
