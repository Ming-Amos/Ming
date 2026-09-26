/** Real browser + local HTTP fixture only. Never uses external provider credentials. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import http from "node:http";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const serverRequire = createRequire(path.join(root, "apps/server/package.json"));
const webRequire = createRequire(path.join(root, "apps/web/package.json"));
const { chromium } = serverRequire("playwright");
const express = serverRequire("express");
const { createServer } = await import(pathToFileURL(path.join(path.dirname(webRequire.resolve("vite/package.json")), "dist/node/index.js")).href);
const previous = Object.fromEntries(["PROVIDER_BASE_URL", "PROVIDER_API_KEY", "PROVIDER_MODEL_ID", "PROVIDER_LABEL", "MING_PUBLIC_DEMO"].map(key => [key, process.env[key]]));
// Load first so optional dotenv parsing is also neutralized for this isolated fixture.
const { mountProviderRoutes } = serverRequire("./dist/provider-routes.js");
for (const key of Object.keys(previous)) delete process.env[key];
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "ming-provider-ui-"));
const fakeKey = "test-only-ui-fixture-secret";
let calls = 0, failure = false, captured;
const model = http.createServer((req, res) => {
  calls++; let body = ""; req.on("data", chunk => { body += chunk; }); req.on("end", () => {
    captured = JSON.parse(body);
    if (failure) { res.writeHead(401).end(`Rejected ${fakeKey}`); return; }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { content: "OK" } }], usage: { prompt_tokens: 11, completion_tokens: 2 } }));
  });
});
const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const close = server => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); });
await listen(model);
const app = express(); app.use(express.json()); mountProviderRoutes(app, runtime);
const apiServer = http.createServer(app); await listen(apiServer);
const entry = `import React from 'react'; import { createRoot } from 'react-dom/client'; import ProviderSettings from '/src/components/ProviderSettings.tsx'; import '/src/index.css';
function Harness(){const [open,setOpen]=React.useState(false);return React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>setOpen(true)},'打开模型设置'),React.createElement(ProviderSettings,{open,onClose:()=>setOpen(false),readOnly:location.search.includes('readonly')}));} createRoot(document.getElementById('root')).render(React.createElement(Harness));`;
const vite = await createServer({ root: path.join(root, "apps/web"), configFile: false, server: { host: "127.0.0.1", port: 4462, strictPort: true,
  proxy: { "/api": `http://127.0.0.1:${apiServer.address().port}` } }, plugins: [
  { name: "provider-settings-fixture", configureServer(server) { server.middlewares.use((req, res, next) => {
    if (req.url?.startsWith("/provider-settings-smoke")) { res.setHeader("Content-Type", "text/html"); res.end('<html lang="zh"><div id="root"></div><script type="module" src="/@id/virtual:provider-settings-smoke"></script></html>'); } else next();
  }); }, resolveId(id) { if (id === "virtual:provider-settings-smoke") return "\0provider-settings-smoke.jsx"; }, load(id) { if (id === "\0provider-settings-smoke.jsx") return entry; } },
] });
let browser;
try {
  await vite.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
  const responseBodies = [], browserErrors = [];
  page.on("pageerror", error => { browserErrors.push(error.message); console.error("Settings fixture browser error:", error.message); });
  page.on("console", message => { if (message.type() === "error") console.error("Settings fixture console error:", message.text()); });
  page.on("response", async response => { if (response.url().includes("/api/provider/")) { try { responseBodies.push(await response.text()); } catch { /* Response was closed. */ } } });
  await page.goto("http://127.0.0.1:4462/provider-settings-smoke");
  await page.getByRole("button", { name: "打开模型设置" }).click();
  await page.getByRole("heading", { name: "连接你的模型" }).waitFor();
  await page.getByLabel("提供商名称", { exact: true }).waitFor({ state: "visible" });
  await page.waitForFunction(() => !document.querySelector('input[placeholder="例如：我的模型服务"]')?.disabled);
  assert.equal(await page.getByLabel("API Key", { exact: true }).inputValue(), "");
  assert.equal(await page.getByRole("button", { name: "测试连接", exact: true }).isDisabled(), true);
  await page.getByLabel("提供商名称", { exact: true }).fill("UI fixture");
  await page.getByLabel("API 地址", { exact: true }).fill(`http://127.0.0.1:${model.address().port}/v1`);
  await page.getByLabel("模型 ID", { exact: true }).fill("fixture-model");
  await page.getByLabel("API Key", { exact: true }).fill(fakeKey);
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await page.getByText("配置已保存在本机并立即生效。保存未调用模型。").waitFor();
  assert.equal(calls, 0); assert.equal(await page.getByLabel("API Key", { exact: true }).inputValue(), "");
  await page.getByRole("button", { name: "测试连接", exact: true }).click();
  await page.getByText("最近一次连接成功").waitFor();
  assert.equal(calls, 1); assert.equal(captured.max_tokens, 8);
  await page.getByRole("button", { name: "关闭模型设置" }).click();
  await page.getByRole("button", { name: "打开模型设置" }).click();
  await page.getByText("最近一次连接成功").waitFor();
  assert.equal(await page.getByLabel("API Key", { exact: true }).inputValue(), "");
  assert.equal(calls, 1);
  await page.getByLabel("模型 ID", { exact: true }).fill("fixture-model-two");
  assert.equal(await page.getByRole("button", { name: "测试连接", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await page.getByText("配置已保存在本机并立即生效。保存未调用模型。").waitFor();
  assert.equal(calls, 1);
  failure = true;
  await page.getByRole("button", { name: "测试连接", exact: true }).click();
  await page.getByText("最近一次连接失败").waitFor();
  assert.ok((await page.getByRole("alert").innerText()).includes("HTTP 401"));
  assert.ok(!(await page.locator("body").innerText()).includes(fakeKey));
  assert.equal(calls, 2);
  await page.getByRole("button", { name: "删除本地配置与密钥" }).click();
  await page.getByText("本地配置和保存的密钥已删除。").waitFor();
  assert.equal(await page.getByRole("button", { name: "测试连接", exact: true }).isDisabled(), true);
  assert.equal(fs.existsSync(path.join(runtime, "provider-config.json")), false);
  assert.ok(!responseBodies.join("\n").includes(fakeKey));
  assert.ok(!(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).includes(fakeKey));
  process.env.MING_PUBLIC_DEMO = "1";
  await page.goto("http://127.0.0.1:4462/provider-settings-smoke?readonly");
  await page.getByRole("button", { name: "打开模型设置" }).click();
  await page.getByText("这是只读演示，不能保存密钥或调用模型。请在本地运行 Ming 后配置。").waitFor();
  assert.equal(await page.locator("dialog input").count(), 0); assert.equal(calls, 2); assert.deepEqual(browserErrors, []);
  console.log("PASS ProviderSettings browser: saved/reopened without key readback, no calls on save/open, one explicit tiny test per click, masked error, clear, read-only, no browser errors.");
} finally {
  await browser?.close(); await vite.close(); await close(apiServer); await close(model);
  for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const resolved = path.resolve(runtime); assert.equal(path.dirname(resolved), path.resolve(os.tmpdir())); assert.ok(path.basename(resolved).startsWith("ming-provider-ui-"));
  fs.rmSync(resolved, { recursive: true, force: true });
}
