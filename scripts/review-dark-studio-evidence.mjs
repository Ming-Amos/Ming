/** Read-only review of historical Evidence Studio records after the dark-theme change. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createWorker } from './public-demo/worker.mjs';
const root = fileURLToPath(new URL('..', import.meta.url)), { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const base = process.env.MING_DARK_REVIEW_URL || 'http://127.0.0.1:4001', origin = new URL(base).origin;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const id = randomUUID(), out = path.join(root, 'docs/evidence/dark-inner-ui', new Date().toISOString().replace(/[:.]/g, '-') + '-studio-' + id.slice(0, 8));
fs.mkdirSync(out, { recursive: true });
const replay = process.env.MING_STUDIO_REVIEW_REPLAY === '1';
const bundle = replay ? JSON.parse(fs.readFileSync(path.join(root, 'docs/judge-evidence/api-responses.json'), 'utf8')) : null;
if (bundle) bundle.screenshots = fs.readdirSync(path.join(root, 'docs/judge-evidence/runtime/screenshots')).filter(file => file.endsWith('.png'));
const worker = replay ? createWorker(bundle) : null;
const report = { id, base, passed: false, scope: replay ? 'Exact saved judge-evidence response/screenshot replay through the existing read-only Worker policy, with the current compiled UI. No new acceptance run, provider call, or mutation.' : 'Existing actual run records loaded through the local API. Only same-origin GET/HEAD requests; no replay, new run, provider call, or mutation.', checks: [], requests: [], blockedRequests: [], errors: [], screenshots: [] };
function check(name, passed, detail) { report.checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); assert.ok(passed, name); }
async function shot(page, name) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); }
let browser, page;
try {
  browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 1484, height: 1060 }, reducedMotion: 'reduce' });
  context.on('page', current => current.on('pageerror', error => report.errors.push(error.message)));
  await context.route('**/*', async route => { const req = route.request(), href = req.url(); if (/^(blob|about|data):/.test(href)) return route.continue(); const url = new URL(href); const item = { origin: url.origin, path: url.pathname, method: req.method() }; report.requests.push(item); if (url.origin !== origin || !['GET', 'HEAD'].includes(req.method())) { report.blockedRequests.push(item); return route.abort(); } if (worker && url.pathname.startsWith('/api/')) { const response = await worker.fetch(new Request(href, { method: req.method() }), { ASSETS: { fetch: async request => { const file = path.basename(new URL(request.url).pathname); assert.ok(bundle.screenshots.includes(file)); return new Response(fs.readFileSync(path.join(root, 'docs/judge-evidence/runtime/screenshots', file)), { headers: { 'content-type': 'image/png' } }); } } }); return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) }); } return route.continue(); });
  page = await context.newPage(); page.setDefaultTimeout(15000); const response = await page.goto(base + '/#studio', { waitUntil: 'networkidle' });
  report.bundle = (await response.text()).match(/\/assets\/[^"']+\.js/)?.[0]; check('Evidence review uses the current compiled bundle', report.bundle === fs.readFileSync(path.join(root, 'apps/web/dist/index.html'), 'utf8').match(/\/assets\/[^"']+\.js/)?.[0]);
  await page.getByRole('button', { name: 'Run history', exact: true }).click(); await page.getByRole('dialog', { name: 'Run history', exact: true }).waitFor();
  await page.getByLabel('Filter by result', { exact: true }).selectOption('failed');
  await page.getByLabel('Search run history', { exact: true }).fill('Shipboard');
  const history = page.locator('.history-item'); check('Existing failed Shipboard records are available without running anything', await history.count() > 0);
  report.selectedHistoryText = await history.first().innerText(); await shot(page, '01-failed-history-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await shot(page, '02-failed-history-mobile'); check('History dialog fits mobile', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.setViewportSize({ width: 1484, height: 1060 });
  await history.first().click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); await page.locator('.workspace-intro').waitFor();
  await page.waitForLoadState('networkidle'); await page.evaluate(() => scrollTo(0, 0)); await shot(page, '03-recorded-workspace-desktop');
  report.workspaceText = (await page.locator('.workspace-intro').innerText()).trim();
  check('Historical workspace presents failed and passed criterion states', await page.locator('.criterion-button .status-failed').count() > 0 && await page.locator('.criterion-button .status-passed').count() > 0);
  await page.locator('.criterion-button').filter({ has: page.locator('.status-failed') }).first().click();
  await page.locator('.column-heading').last().evaluate(node => scrollTo(0, node.getBoundingClientRect().top + scrollY - 20)); await shot(page, '04-failed-observation-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('.column-heading').last().evaluate(node => scrollTo(0, node.getBoundingClientRect().top + scrollY - 20)); await shot(page, '05-failed-observation-mobile'); check('Historical evidence fits mobile', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1484, height: 1060 }); await page.locator('.criterion-button').filter({ has: page.locator('.status-passed') }).first().click(); await page.locator('.column-heading').last().evaluate(node => scrollTo(0, node.getBoundingClientRect().top + scrollY - 20)); await shot(page, '06-passed-observation-desktop');
  check('No model, new-run, external, or mutation request was attempted', report.blockedRequests.length === 0, report.blockedRequests); check('No browser exception occurred', report.errors.length === 0, report.errors); report.passed = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; if (page && !page.isClosed()) { await shot(page, 'stopped-state').catch(() => {}); fs.writeFileSync(path.join(out, 'stopped-dom.txt'), await page.locator('body').innerText().catch(() => '')); } }
finally { await browser?.close(); report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, report: path.join(out, 'report.json') })); }
