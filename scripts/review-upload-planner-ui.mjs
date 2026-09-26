/** Explicitly mocked planner transport; real UI review/apply/confirm and browser checks.
 * Never contacts a provider, uses a key, invokes Bob, or fabricates a successful browser run.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const base = process.env.MING_PLANNER_REVIEW_URL || 'http://127.0.0.1:4192', origin = new URL(base).origin;
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Planner mock review only supports the local compiled preview.');
const reviewId = randomUUID(), stamp = new Date().toISOString().replace(/[:.]/g, '-');
const work = path.join(root, 'runtime', `upload-planner-ui-${reviewId}`), out = path.join(root, 'docs/evidence/upload-planner-ui', `${stamp}-${reviewId.slice(0, 8)}`);
fs.mkdirSync(work, { recursive: true });
const report = { reviewId, startedAt: new Date().toISOString(), base, transport: 'Explicit local Playwright route fixtures. No real provider request or token accounting.', checks: [], requests: [], errors: [], outsideRequests: [], passed: false };
const check = (name, passed) => { report.checks.push({ name, passed: Boolean(passed) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); if (!passed) throw Error(name); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const requirement = 'Click Increment once. The visible count becomes 1.';
const source = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Proof counter</title><style>body{font:20px system-ui;background:#e4f3ed;color:#193a31;padding:35px}main{background:white;border-radius:18px;padding:32px}button{padding:14px 24px;background:#166c55;color:white;border:0;border-radius:8px}</style></head><body><main><h1>Proof counter</h1><p id="count">0</p><button id="increment">Increment</button></main><script>document.querySelector("#increment").onclick=()=>{document.querySelector("#count").textContent=String(Number(document.querySelector("#count").textContent)+1)}</script></body></html>';
const draftSteps = [{ id: 'draft-click', action: 'click', selector: '#increment', value: '', description: 'Increment the visible counter' }, { id: 'draft-count', action: 'assertText', selector: '#count', value: '1', description: 'Confirm the increment is visible' }];
const ui = {
  root: page => page.locator('[data-testid="upload-studio"]'),
  requirements: page => page.getByRole('textbox', { name: 'Requirements', exact: true }),
  steps: page => page.locator('[data-testid="upload-step"]'),
  confirm: page => page.getByRole('checkbox', { name: 'I reviewed these requirements and steps for this project.', exact: true }),
  generate: page => page.getByRole('button', { name: 'Generate draft with Doubao', exact: true }),
  candidate: page => page.locator('[data-testid="ai-plan-draft"]'),
  apply: page => page.getByRole('button', { name: 'Apply draft to plan', exact: true }),
  discard: page => page.getByRole('button', { name: 'Discard draft', exact: true }),
  run: page => page.getByRole('button', { name: 'Run acceptance checks', exact: true }),
};
let browser, page, configured = true, mode = 'questions';
try {
  const response = await fetch(base), html = await response.text();
  const expected = fs.readFileSync(path.join(root, 'apps/web/dist/index.html'), 'utf8').match(/\/assets\/[^"']+\.js/)?.[0];
  check('Planner review uses the current compiled application', response.ok && Boolean(expected) && html.includes(expected));
  browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true });
  context.on('page', current => current.on('pageerror', error => report.errors.push(error.message)));
  await context.route('**/*', async route => {
    const request = route.request(), href = request.url(); if (/^(?:data|blob|about):/.test(href)) return route.continue();
    const url = new URL(href); if (url.origin !== origin) { report.outsideRequests.push(url.origin); return route.abort(); }
    if (url.pathname === '/api/upload/planner/status') return route.fulfill({ json: { ok: true, configured, providerLabel: 'Doubao', modelId: configured ? 'mock-review-model' : null } });
    if (url.pathname === '/api/upload/planner/draft') {
      const body = request.postDataJSON(); report.requests.push({ path: url.pathname, method: request.method(), body, origin: request.headers().origin });
      await sleep(250);
      if (mode === 'error') return route.fulfill({ status: 502, json: { ok: false, error: 'Mock provider temporarily unavailable. Please retry.' } });
      return route.fulfill({ json: { ok: true, draft: { steps: draftSteps, openQuestions: mode.startsWith('questions') ? ['Should the count remain after reloading?'] : [] }, usage: mode === 'questions-unknown' ? { inputTokens: null, outputTokens: null } : { inputTokens: 120, outputTokens: 70 }, modelId: 'mock-review-model' } });
    }
    if (!['GET', 'HEAD'].includes(request.method())) { report.requests.push({ path: url.pathname, method: request.method(), unexpected: true }); return route.abort(); }
    return route.continue();
  });
  page = await context.newPage(); page.setDefaultTimeout(20000); await page.goto(base + '/#upload', { waitUntil: 'networkidle' }); await ui.root(page).waitFor();
  await page.getByLabel('Upload HTML or ZIP', { exact: true }).setInputFiles({ name: 'proof-counter.html', mimeType: 'text/html', buffer: Buffer.from(source) });
  await page.waitForFunction(() => document.querySelector('[data-testid="upload-studio"]')?.getAttribute('data-preview-ready') === 'true');
  await ui.requirements(page).fill(requirement);
  await ui.steps(page).first().getByLabel('CSS selector', { exact: true }).fill('h1'); await ui.steps(page).first().getByLabel('Expected text', { exact: true }).fill('Proof counter'); await ui.confirm(page).check();
  await sleep(350); check('Opening a project and editing requirements never calls the model automatically', report.requests.length === 0);
  check('A configured provider offers explicit draft generation', await ui.generate(page).isEnabled());
  await ui.generate(page).click(); await ui.candidate(page).waitFor();
  check('One explicit generation sends exactly one approved request', report.requests.length === 1 && report.requests[0].method === 'POST' && report.requests[0].body.confirmedUserAction === true && report.requests[0].body.requirement === requirement);
  check('The draft request contains actual observed elements and project context', report.requests[0].body.entry === 'proof-counter.html' && report.requests[0].body.elements.some(element => element.selector === '#increment') && report.requests[0].body.elements.some(element => element.selector === '#count'));
  check('Questions remain visible and block applying the candidate', await page.getByRole('list', { name: 'Unresolved questions', exact: true }).innerText().then(text => text.includes('Should the count remain')) && await ui.apply(page).isDisabled());
  check('Generating a draft does not overwrite or execute the existing plan', await ui.steps(page).count() === 1 && await ui.steps(page).first().getByLabel('CSS selector', { exact: true }).inputValue() === 'h1' && await page.frameLocator('iframe[sandbox]').locator('#count').innerText() === '0');
  check('A pending draft also prevents accidentally running the old plan', await ui.run(page).isDisabled());
  await ui.discard(page).click(); check('Discard removes the candidate and preserves the manual plan', await ui.candidate(page).count() === 0 && await ui.steps(page).count() === 1);
  mode = 'valid'; await ui.generate(page).click(); await ui.candidate(page).waitFor();
  check('A resolved candidate remains a review draft until explicitly applied', await ui.apply(page).isEnabled() && await ui.steps(page).count() === 1 && report.requests.length === 2);
  await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(work, 'planner-review.png'), fullPage: true });
  await ui.requirements(page).fill(requirement + ' Requirements changed after generation.');
  check('Changing requirements invalidates the pending generated draft', await ui.apply(page).isDisabled());
  await ui.requirements(page).fill(requirement);
  await ui.apply(page).click();
  check('Applying the reviewed draft changes the plan and invalidates previous confirmation', await ui.steps(page).count() === 2 && !(await ui.confirm(page).isChecked()) && await ui.run(page).isDisabled());
  check('Applying the draft still does not execute the application', await page.frameLocator('iframe[sandbox]').locator('#count').innerText() === '0');
  await ui.confirm(page).check(); await ui.run(page).click(); await page.getByRole('button', { name: 'Cancel checks', exact: true }).waitFor(); await page.getByRole('button', { name: 'Cancel checks', exact: true }).waitFor({ state: 'hidden', timeout: 45000 });
  const transfer = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export evidence report', exact: true }).click(); const runFile = path.join(work, 'actual-browser-run.json'); await (await transfer).saveAs(runFile);
  const run = JSON.parse(fs.readFileSync(runFile, 'utf8')).currentRun;
  check('Confirmed draft steps perform real browser operations and pass on observed output', run.status === 'passed' && run.steps.length === 2 && run.steps[1].observed === '1' && await page.frameLocator('iframe[sandbox]').locator('#count').innerText() === '1');
  check('Acceptance still produces a real DOM-render capture without another model call', run.steps[1].capture?.startsWith('data:image/png;base64,') && report.requests.length === 2);
  report.run = { id: run.id, status: run.status, planFingerprint: run.planFingerprint, projectFingerprint: run.projectFingerprint, steps: run.steps.map(({ capture, ...step }) => ({ ...step, captureBytes: capture ? Buffer.from(capture.split(',')[1], 'base64').length : 0 })) };
  mode = 'questions-unknown'; await ui.generate(page).click(); await ui.candidate(page).waitFor();
  check('Missing token usage is displayed as unknown rather than zero', (await ui.candidate(page).innerText()).includes('Unknown input / Unknown output tokens'));
  await page.getByRole('button', { name: 'Restore original plan', exact: true }).click();
  check('Restoring the baseline does not bypass an unresolved draft review', await ui.candidate(page).count() === 1 && await ui.apply(page).isDisabled() && await ui.run(page).isDisabled());
  await ui.discard(page).click();
  mode = 'error'; await ui.generate(page).click(); await page.getByRole('alert').filter({ hasText: 'Mock provider temporarily unavailable' }).waitFor();
  check('A provider failure leaves the active acceptance plan intact', await ui.steps(page).count() === 2 && report.requests.length === 4);
  configured = false; const unavailable = await context.newPage(); await unavailable.goto(base + '/#upload', { waitUntil: 'networkidle' }); await ui.root(unavailable).waitFor();
  await unavailable.getByLabel('Upload HTML or ZIP', { exact: true }).setInputFiles({ name: 'proof-counter.html', mimeType: 'text/html', buffer: Buffer.from(source) });
  await unavailable.waitForFunction(() => document.querySelector('[data-testid="upload-studio"]')?.getAttribute('data-preview-ready') === 'true'); await ui.requirements(unavailable).fill(requirement);
  check('Unconfigured provider cannot trigger a paid request', await ui.generate(unavailable).isDisabled() && report.requests.length === 4);
  check('All draft calls were explicit same-origin actions', report.requests.every(request => request.method === 'POST' && request.path === '/api/upload/planner/draft' && request.body?.confirmedUserAction === true && request.origin === origin));
  check('No provider or other external network was contacted', report.outsideRequests.length === 0);
  check('No uncaught JavaScript errors occurred', report.errors.length === 0);
  report.passed = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; console.error(report.error); if (page && !page.isClosed()) fs.writeFileSync(path.join(work, 'stopped-dom.txt'), await page.locator('body').innerText().catch(() => '')); }
finally {
  await browser?.close(); report.finishedAt = new Date().toISOString(); const destination = report.passed ? out : work; fs.mkdirSync(destination, { recursive: true });
  if (report.passed) fs.copyFileSync(path.join(work, 'planner-review.png'), path.join(destination, 'planner-review.png'));
  fs.writeFileSync(path.join(destination, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, report: path.join(destination, 'report.json') }));
}
