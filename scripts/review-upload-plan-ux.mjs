/** Screenshot-first review of the Shipboard plan flow. Saved provider response is replayed locally.
 * No provider calls, secrets, or changes to acceptance semantics. Existing source fixture runs in the browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const base = process.env.MING_UPLOAD_PLAN_REVIEW_URL || 'http://127.0.0.1:4001';
const origin = new URL(base).origin, mode = process.env.MING_UPLOAD_PLAN_REVIEW_MODE || 'before';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('This review only supports a local preview.');
if (!['before', 'after'].includes(mode)) throw Error('Review mode must be before or after.');
const id = randomUUID(), stamp = new Date().toISOString().replace(/[:.]/g, '-');
const work = path.join(root, 'runtime', `upload-plan-ux-${id}`), out = path.join(root, 'docs/evidence/upload-plan-ux', `${stamp}-${mode}-${id.slice(0, 8)}`);
fs.mkdirSync(work, { recursive: true });
const savedPath = path.join(root, 'docs/evidence/shipboard-doubao/2026-09-26T17-49-25-055Z-0db01f40/provider-draft.json');
const saved = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
const requirement = '1. Submit an empty task name. Show “Add a task name before continuing.” and keep the count at “0 tasks”.\n2. Add a task named “Ming acceptance test”. It must appear in the task list.\n3. Reload the application. “Ming acceptance test” must still appear in the task list.';
const report = { id, mode, startedAt: new Date().toISOString(), base, transport: 'Explicit replay of an already saved provider response. No paid model request in this review.', savedResponse: path.relative(root, savedPath), requests: [], outsideRequests: [], errors: [], checks: [], screenshots: [], metrics: {}, passed: false };
const check = (name, passed) => { report.checks.push({ name, passed: Boolean(passed) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); assert.ok(passed, name); };
const button = (page, name) => page.getByRole('button', { name, exact: true });
async function capture(page, name) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await page.screenshot({ path: path.join(work, name) }); report.screenshots.push(name); }
let browser, page;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true });
  context.on('page', current => current.on('pageerror', error => report.errors.push(error.message)));
  await context.route('**/*', route => {
    const req = route.request(), href = req.url(); if (/^(?:blob|data|about):/.test(href)) return route.continue();
    const url = new URL(href);
    if (url.origin !== origin) { report.outsideRequests.push({ origin: url.origin, path: url.pathname }); return route.abort(); }
    if (url.pathname === '/api/upload/planner/status') return route.fulfill({ json: { ok: true, configured: true, providerLabel: 'Doubao', modelId: saved.modelId } });
    if (url.pathname === '/api/upload/planner/draft') {
      report.requests.push({ method: req.method(), path: url.pathname, body: req.postDataJSON() });
      return route.fulfill({ json: saved });
    }
    if (!['GET', 'HEAD'].includes(req.method())) { report.requests.push({ method: req.method(), path: url.pathname, unexpected: true }); return route.abort(); }
    return route.continue();
  });
  page = await context.newPage(); page.setDefaultTimeout(20000); const response = await page.goto(base + '/#upload', { waitUntil: 'networkidle' });
  report.bundle = fs.readFileSync(path.join(root, 'apps/web/dist/index.html'), 'utf8').match(/\/assets\/[^"']+\.js/)?.[0];
  check('The reviewed page serves the current compiled application', Boolean(report.bundle) && response.ok() && (await response.text()).includes(report.bundle));
  await page.getByLabel('Upload HTML or ZIP', { exact: true }).setInputFiles(path.join(root, 'examples/shipboard/buggy/index.html'));
  await page.waitForFunction(() => document.querySelector('[data-testid="upload-studio"]')?.getAttribute('data-preview-ready') === 'true');
  await page.getByRole('textbox', { name: 'Requirements', exact: true }).fill(requirement);
  check('Loading the sample and requirements does not call a model', report.requests.length === 0);
  await page.getByRole('textbox', { name: 'Requirements', exact: true }).scrollIntoViewIfNeeded(); await capture(page, '01-requirements-desktop.png');
  await button(page, 'Generate draft with Doubao').click(); await page.getByTestId('ai-plan-draft').waitFor();
  check('One explicit generation replays exactly the saved nine-step draft', report.requests.length === 1 && report.requests[0].body.confirmedUserAction === true && saved.draft.steps.length === 9);
  await page.getByTestId('ai-plan-draft').scrollIntoViewIfNeeded(); await capture(page, '02-draft-desktop.png');
  await button(page, mode === 'before' ? 'Apply draft to plan' : 'Use this checklist').click();
  const plan = page.locator('section.upload-card').filter({ has: page.getByRole('heading', { name: /Executable acceptance plan|Review your checks|Your acceptance plan|Your check plan|What Ming will check/i }) }).first();
  await plan.waitFor(); await plan.scrollIntoViewIfNeeded();
  await capture(page, '03-plan-desktop.png');
  report.metrics.desktop = await plan.evaluate(node => {
    // Chromium retains descendant layout rectangles inside a closed details element.
    // Count rendered controls, explicitly excluding its hidden content rather than its layout cache.
    const visible = field => !field.closest('details:not([open])') && field.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    return { planHeight: Math.round(node.getBoundingClientRect().height), pageHeight: document.documentElement.scrollHeight, controls: node.querySelectorAll('input,select,textarea,button').length, visibleControls: [...node.querySelectorAll('input,select,textarea,button')].filter(visible).length, visibleTechnicalFields: [...node.querySelectorAll('input[aria-label="CSS selector"]')].filter(visible).length };
  });
  const confirmation = page.getByRole('checkbox', { name: mode === 'before' ? 'I reviewed these requirements and steps for this project.' : 'These checks match my requirements.', exact: true });
  check('Applying a draft requires an explicit review confirmation', !(await confirmation.isChecked()) && await button(page, 'Run acceptance checks').isDisabled());
  if (mode === 'after') {
    check('Technical fields are hidden until the user chooses to edit them', report.metrics.desktop.visibleTechnicalFields === 0 && !(await page.locator('[data-testid="upload-step"]').first().getByLabel('CSS selector', { exact: true }).isVisible()));
    check('Nine generated operations are presented as three readable action-and-result cards', await plan.locator('.upload-check-card').count() === 3 && (await plan.innerText()).includes('Ming acceptance test') && (await plan.innerText()).includes('0 tasks'));
    const checklistText = await plan.locator('.upload-checklist').innerText();
    check('The checklist uses the actual Task name label and readable expected text', checklistText.includes('Task name') && checklistText.includes('Visible text includes') && !checklistText.includes('e.g. Ship the release notes') && !checklistText.includes('target element'));
    const disclosure = page.getByTestId('plan-technical-editor'), summary = disclosure.locator('summary');
    await summary.focus(); await summary.press('Enter');
    check('Keyboard users can explicitly open the technical editor', await disclosure.evaluate(node => node.open) && await page.locator('[data-testid="upload-step"]').first().getByLabel('CSS selector', { exact: true }).isVisible());
    await summary.press('Enter');
    check('Keyboard users can return to the plain checklist without changing the plan', !(await disclosure.evaluate(node => node.open)) && !(await confirmation.isChecked()));
  }
  await page.setViewportSize({ width: 390, height: 844 }); await plan.scrollIntoViewIfNeeded(); await capture(page, '04-plan-mobile.png');
  report.metrics.mobile = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight }));
  check('The mobile plan fits the viewport without horizontal overflow', report.metrics.mobile.documentWidth <= report.metrics.mobile.viewport + 1);
  if (mode === 'after') {
    await confirmation.check(); await button(page, 'Run acceptance checks').click(); await button(page, 'Cancel checks').waitFor(); await button(page, 'Cancel checks').waitFor({ state: 'hidden', timeout: 90000 });
    const transfer = page.waitForEvent('download'); await button(page, 'Export evidence report').click(); const exportedPath = path.join(work, 'actual-browser-run.json'); await (await transfer).saveAs(exportedPath);
    const exported = JSON.parse(fs.readFileSync(exportedPath, 'utf8')), run = exported.currentRun;
    assert.deepEqual(run.steps.map(({ id, action, selector, value, description }) => ({ id, action, selector, value, description })), saved.draft.steps);
    check('The plain-language presentation executes the same nine-step plan and exposes the real persistence failure', run.status === 'failed' && run.steps.slice(0, 8).every(step => step.status === 'passed') && run.steps[8].status === 'failed' && run.steps[8].capture?.startsWith('data:image/png;base64,'));
    report.run = { id: run.id, status: run.status, planFingerprint: run.planFingerprint, stepStatuses: run.steps.map(step => step.status) };
    await page.setViewportSize({ width: 1484, height: 1060 }); await page.getByRole('heading', { name: 'The evidence found a gap.', exact: true }).scrollIntoViewIfNeeded(); await capture(page, '05-real-failure-desktop.png');
    const boundary = await context.newPage(); boundary.setDefaultTimeout(20000); await boundary.goto(base + '/#upload', { waitUntil: 'networkidle' });
    await boundary.getByLabel('Upload HTML or ZIP', { exact: true }).setInputFiles({ name: 'form-labels-collision.html', mimeType: 'text/html', buffer: Buffer.from('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Label inventory regression</title></head><body><form id="profile"><input name="labels" id="field"><label for="field">Display name</label></form></body></html>') });
    await boundary.waitForFunction(() => document.querySelector('[data-testid="upload-studio"]')?.getAttribute('data-preview-ready') === 'true');
    const labelInventory = await boundary.locator('[aria-label="Use selector #field"]').textContent();
    check('An input named labels does not break form inventory and keeps its associated Display name label', labelInventory.includes('Display name') && await boundary.frameLocator('iframe[sandbox]').getByLabel('Display name', { exact: true }).count() === 1 && report.requests.length === 1);
    await boundary.close();
  }
  check('Review, applying, confirmation, and browser checks do not generate another draft', report.requests.length === 1);
  check('No external requests or uncaught browser errors occurred', report.outsideRequests.length === 0 && report.errors.length === 0);
  report.passed = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; if (page && !page.isClosed()) fs.writeFileSync(path.join(work, 'stopped-dom.txt'), await page.locator('body').innerText().catch(() => '')); }
finally {
  await browser?.close(); report.finishedAt = new Date().toISOString(); const destination = report.passed ? out : work; fs.mkdirSync(destination, { recursive: true });
  if (report.passed) for (const file of fs.readdirSync(work)) fs.copyFileSync(path.join(work, file), path.join(destination, file));
  fs.writeFileSync(path.join(destination, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, report: path.join(destination, 'report.json') }));
}
