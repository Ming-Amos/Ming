/** Focused regression for browser-ready ES modules in the compiled upload UI.
 * Uses generated static fixtures and local Chromium only. No paid model calls.
 * Build the web app and start its local preview before running this script.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const { zipSync } = createRequire(path.join(root, 'apps/web/package.json'))('fflate');
const base = process.env.MING_MODULE_REVIEW_URL || 'http://127.0.0.1:4001';
const origin = new URL(base).origin;
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use a local compiled preview.');
const destination = path.join(root, 'runtime', `upload-module-review-${randomUUID()}`);
const report = { startedAt: new Date().toISOString(), base, checks: [], outsideRequests: [], plannerCalls: 0, passed: false };
function check(name, passed, detail) {
  report.checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  assert.ok(passed, name);
}
const documentFor = scripts => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Module loading regression</title></head><body><p id="ready"></p>${scripts}</body></html>`;
const moduleScript = code => `<script type="module">${code}</script>`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.route('**/*', route => {
    const href = route.request().url();
    if (/^(?:about|blob|data):/.test(href)) return route.continue();
    const url = new URL(href);
    if (url.origin !== origin) { report.outsideRequests.push(url.origin + url.pathname); return route.abort(); }
    if (url.pathname === '/api/upload/planner/status') return route.fulfill({ json: { ok: true, configured: false } });
    if (url.pathname === '/api/upload/planner/draft') { report.plannerCalls++; return route.abort(); }
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.abort();
    return route.continue();
  });
  async function upload(name, buffer) {
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const response = await page.goto(base + '/#upload');
    assert.ok(response?.ok(), 'The local preview is available.');
    const entry = fs.readFileSync(path.join(root, 'apps/web/dist/index.html'), 'utf8');
    const bundle = entry.match(/\/assets\/[^"']+\.js/)?.[0];
    assert.ok(bundle && (await response.text()).includes(bundle), 'The page serves the current compiled bundle.');
    const started = Date.now();
    await page.getByLabel('Upload HTML or ZIP', { exact: true }).setInputFiles({ name, mimeType: name.endsWith('.zip') ? 'application/zip' : 'text/html', buffer });
    return { page, started };
  }
  async function ready(page) {
    await page.waitForFunction(() => document.querySelector('[data-testid="upload-studio"]')?.getAttribute('data-preview-ready') === 'true');
  }

  const three = await upload('three-modules.html', Buffer.from(documentFor([
    moduleScript('export const first = "A"; document.querySelector("#ready").textContent += first;'),
    moduleScript('export const second = "B"; document.querySelector("#ready").textContent += second;'),
    moduleScript('export const third = "C — 检查"; document.querySelector("#ready").textContent += third;'),
  ].join(''))));
  await ready(three.page);
  const elapsed = Date.now() - three.started;
  check('Three inline modules initialize without waiting for three timeout windows', elapsed < 3500, { elapsedMs: elapsed });
  check('Module exports, source order, and Unicode execute unchanged', await three.page.frameLocator('iframe').locator('#ready').innerText() === 'ABC — 检查');
  check('A fast module preview has no false timeout diagnostic', (await three.page.locator('.upload-preview-warnings').allTextContents()).length === 0);
  await three.page.close();

  const repeatedCode = 'document.querySelector("#ready").textContent += "once ";';
  const repeated = await upload('repeated-inline-modules.html', Buffer.from(documentFor(moduleScript(repeatedCode) + moduleScript(repeatedCode))));
  await ready(repeated.page);
  check('Identical inline module blocks each execute instead of sharing a cached entry module', (await repeated.page.frameLocator('iframe').locator('#ready').innerText()).trim() === 'once once');
  await repeated.page.close();

  const zip = zipSync({
    'index.html': Buffer.from(documentFor('<script type="module" src="./assets/main.js"></script>')),
    'assets/main.js': Buffer.from('import prefix, { suffix } from "./message.js"; export const result = prefix + suffix; document.querySelector("#ready").textContent = result;'),
    'assets/message.js': Buffer.from('export default "Local "; export const suffix = "dependency ready";'),
  });
  const dependency = await upload('local-module-dependency.zip', Buffer.from(zip));
  await ready(dependency.page);
  check('A ZIP entry loads a local module with default and named dependency exports', await dependency.page.frameLocator('iframe').locator('#ready').innerText() === 'Local dependency ready');
  check('Local dependency loading needs no network exception or CSP relaxation', (await dependency.page.locator('.upload-preview-warnings').allTextContents()).length === 0);
  await dependency.page.close();

  const syntax = await upload('module-syntax-error.html', Buffer.from(documentFor(moduleScript('export const broken = ;'))));
  await syntax.page.getByRole('alert').waitFor();
  check('A genuine module syntax error is reported instead of starting a preview', (await syntax.page.getByRole('alert').innerText()).includes('Cannot parse') && await syntax.page.getByTestId('upload-studio').getAttribute('data-preview-ready') === 'false');
  await syntax.page.close();

  const evaluation = await upload('module-evaluation-error.html', Buffer.from(documentFor(moduleScript('throw new Error("Module evaluation fixture failed");'))));
  await ready(evaluation.page);
  check('A genuine module evaluation error remains visible in preview diagnostics', (await evaluation.page.locator('.upload-preview-warnings').innerText()).includes('Module evaluation fixture failed'));
  await evaluation.page.close();

  // Exercise the bridge's retained diagnostics after the old four-second timer.
  // This isolated harness executes the source bridge with its real message port;
  // the preceding UI cases independently cover importer and compiled integration.
  const probe = await context.newPage(); await probe.goto(base);
  const bridgeSource = fs.readFileSync(path.join(root, 'apps/web/src/upload/bridge.js'), 'utf8');
  const delayed = await probe.evaluate(async source => {
    const iframe = document.createElement('iframe'); iframe.setAttribute('sandbox', 'allow-scripts'); document.body.append(iframe);
    const pending = new Map(); let port;
    const reply = id => new Promise(resolve => pending.set(id, resolve));
    const ready = reply('ready');
    const listener = event => {
      if (event.source !== iframe.contentWindow || event.data?.type !== 'ming-upload-ready') return;
      window.removeEventListener('message', listener);
      const channel = new MessageChannel(); port = channel.port1;
      port.onmessage = event => pending.get(event.data.id)?.(event.data);
      iframe.contentWindow.postMessage({ type: 'ming-upload-init', boot: event.data.boot, storage: {}, scripts: [{ module: true, code: 'export const loaded = true; document.querySelector("#ready").textContent="Loaded";' }] }, '*', [channel.port2]);
    };
    window.addEventListener('message', listener);
    iframe.srcdoc = '<!doctype html><html><head><script data-boot="module-timer-probe">' + source.replace(/<\/script/gi, '<\\/script') + '</script></head><body><p id="ready"></p></body></html>';
    const initial = await ready;
    await new Promise(resolve => setTimeout(resolve, 4250));
    const inventory = reply('inventory'); port.postMessage({ id: 'inventory', command: 'inventory' });
    const later = await inventory; port.close(); iframe.remove();
    return { initial: initial.result, later: later.result };
  }, bridgeSource);
  check('A completed module does not acquire a false timeout warning four seconds later', delayed.initial.warnings.length === 0 && delayed.later.warnings.length === 0, delayed);
  await probe.close();
  check('The regression makes no external or paid model requests', report.outsideRequests.length === 0 && report.plannerCalls === 0);
  report.passed = true;
} catch (error) {
  report.error = String(error.stack || error); process.exitCode = 1;
} finally {
  await browser?.close(); report.finishedAt = new Date().toISOString();
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, report: path.join(destination, 'report.json') }));
}
