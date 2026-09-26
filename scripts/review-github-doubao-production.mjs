/** Actual private-site GitHub + Doubao review. Run only after deployment. One paid draft, no retries or mocks.
 * Existing MING_SITE_REVIEW_TOKEN is used only for this site's origin and never persisted or logged.
 * MING_REVIEW_PLANNER_ONLY=1 skips the unchanged GitHub smoke and reviews only the real draft workflow. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)), { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const token = process.env.MING_SITE_REVIEW_TOKEN; delete process.env.MING_SITE_REVIEW_TOKEN;
if (!token) throw Error('The existing authorized private-site review credential is required.');
const origin = 'https://ming-acceptance-proof.amosming.chatgpt.site', repo = 'https://github.com/mdn/beginner-html-site';
const plannerOnly = process.env.MING_REVIEW_PLANNER_ONLY === '1';
const reviewId = randomUUID(), tag = reviewId.slice(0, 8), out = path.join(root, 'docs/evidence/github-doubao');
fs.mkdirSync(out, { recursive: true });
const bundle = fs.readFileSync(path.join(root, 'apps/web/dist/index.html'), 'utf8').match(/\/assets\/[^"']+\.js/)?.[0];
assert.ok(bundle, 'Build the frontend before checking the exact deployment.');
const redact = value => String(value).split(token).join('[REDACTED]'), save = (name, value) => fs.writeFileSync(path.join(out, name), redact(JSON.stringify(value, null, 2)));
const report = { reviewId, startedAt: new Date().toISOString(), origin, expectedBundle: bundle, mode: plannerOnly ? 'planner-only' : 'github-and-planner', passed: false, checks: [], runs: [], githubRequests: [], blockedRequests: [], errors: [], screenshots: [], draftRequests: 0,
  scope: `${plannerOnly ? 'Planner-only review; unchanged MDN GitHub smoke is intentionally skipped.' : 'Real public MDN import and manual heading visibility check;'} One actual Doubao Seed 2.0 Pro draft for an owned counter, reviewed then executed in the isolated visitor browser. No mocks, source repair, Bob usage, or retries.` };
const check = (name, passed) => { report.checks.push({ name, passed: Boolean(passed) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); if (!passed) throw Error(name); };
const button = (page, name) => page.getByRole('button', { name, exact: true }), confirm = page => page.getByRole('checkbox', { name: 'I reviewed these requirements and steps for this project.', exact: true });
const ready = page => page.waitForFunction(() => { const node = document.querySelector('[data-testid="upload-studio"]'); return node?.dataset.previewReady === 'true' && node.dataset.phase === 'idle'; }, null, { timeout: 45000 });
async function shot(page, name) { await page.evaluate(() => scrollTo(0, 0)); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const file = `${tag}-${name}.png`; await page.screenshot({ path: path.join(out, file), fullPage: true }); report.screenshots.push(file); }
async function run(page, name) {
  await confirm(page).check(); await button(page, 'Run acceptance checks').click(); await button(page, 'Cancel checks').waitFor(); await button(page, 'Cancel checks').waitFor({ state: 'hidden', timeout: 45000 });
  const transfer = page.waitForEvent('download'); await button(page, 'Export evidence report').click(); const file = `${tag}-${name}.json`; await (await transfer).saveAs(path.join(out, file));
  const exported = JSON.parse(fs.readFileSync(path.join(out, file), 'utf8')); assert.equal(exported.format, 'ming-upload-v1');
  const summary = { ...exported.currentRun, export: file, planOrigin: exported.currentPlanOrigin, steps: exported.currentRun.steps.map(({ capture, ...step }, index) => {
    if (!capture) return step; const bytes = Buffer.from(capture.split(',')[1], 'base64'); assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const captureFile = `${tag}-${name}-step-${index + 1}.png`; fs.writeFileSync(path.join(out, captureFile), bytes);
    return { ...step, capture: { file: captureFile, bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: createHash('sha256').update(bytes).digest('hex') } };
  }) }; report.runs.push(summary); return exported;
}
const requirement = 'Click Increment exactly once. The visible count must change from 0 to 1. Do not reload the page; persistence is not required.';
const source = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Proof counter</title><style>body{font:20px system-ui;background:#e4f3ed;color:#193a31;padding:35px}main{background:white;border-radius:18px;padding:32px}button{padding:14px 24px;background:#166c55;color:white;border:0;border-radius:8px}</style></head><body><main><h1>Proof counter</h1><p id="count">0</p><button id="increment">Increment</button></main><script>document.querySelector("#increment").onclick=()=>{document.querySelector("#count").textContent=String(Number(document.querySelector("#count").textContent)+1)}</script></body></html>';
let browser, page, permitDraft = false;
try {
  browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true });
  context.on('page', current => current.on('pageerror', error => report.errors.push(redact(error.message))));
  await context.route('**/*', route => {
    const request = route.request(), href = request.url(); if (/^(?:blob|data|about):/.test(href)) return route.continue(); const url = new URL(href), method = request.method();
    if (url.origin !== origin) {
      const approved = url.origin === 'https://api.github.com' && /^\/repos\/mdn\/beginner-html-site(?:\/|$)/.test(url.pathname) || url.origin === 'https://raw.githubusercontent.com' && /^\/mdn\/beginner-html-site\/[a-f\d]{40}\//i.test(url.pathname);
      const credentialsAbsent = !request.headers().authorization && !request.headers().cookie && !request.headers()['oai-sites-authorization'];
      report.githubRequests.push({ host: url.hostname, path: url.pathname, method, approved, credentialsAbsent });
      if (approved && credentialsAbsent && method === 'GET') return route.continue(); report.blockedRequests.push({ origin: url.origin, path: url.pathname, method }); return route.abort();
    }
    if (url.pathname === '/api/upload/planner/draft' && method === 'POST') {
      report.draftRequests++; const allowed = permitDraft && report.draftRequests === 1 && request.postDataJSON()?.confirmedUserAction === true; permitDraft = false;
      if (!allowed) { report.blockedRequests.push({ path: url.pathname, method }); return route.abort(); }
    } else if (!['GET', 'HEAD'].includes(method) && !url.pathname.startsWith('/cdn-cgi/challenge-platform/')) { report.blockedRequests.push({ path: url.pathname, method }); return route.abort(); }
    return route.continue({ headers: { ...request.headers(), 'OAI-Sites-Authorization': `Bearer ${token}` } });
  });
  page = await context.newPage(); page.setDefaultTimeout(30000); const response = await page.goto(origin + '/#upload', { waitUntil: 'networkidle' });
  check('Private deployment serves the exact compiled UI', response.ok() && (await response.text()).includes(bundle));
  if (!plannerOnly) {
  await page.getByRole('tab', { name: 'GitHub', exact: true }).click(); await page.getByRole('textbox', { name: 'Public repository URL', exact: true }).fill(repo); await button(page, 'Inspect repository').click();
  const folders = page.getByRole('combobox', { name: 'Static folder to import', exact: true }); await folders.waitFor();
  const options = await folders.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, disabled: node.disabled }))), chosen = options.find(option => !option.disabled && option.value === '') || options.find(option => !option.disabled); assert.ok(chosen, 'MDN has an importable static folder');
  await folders.selectOption(chosen.value); await button(page, 'Import selected folder').click(); await ready(page);
  const heading = await page.frameLocator('iframe[sandbox]').locator('h1').innerText(); check('Real imported MDN heading is visible', Boolean(heading.trim()));
  await page.getByRole('textbox', { name: 'Requirements', exact: true }).fill(`The imported public starter page displays the heading: ${heading}`);
  const step = page.locator('[data-testid="upload-step"]').first(); await step.getByLabel('CSS selector', { exact: true }).fill('h1'); await step.getByLabel('Expected text', { exact: true }).fill(heading);
  const mdn = (await run(page, 'mdn-manual')).currentRun;
  check('The real GitHub source passes its confirmed heading check with capture and pinned commit', mdn.status === 'passed' && mdn.source?.url === repo && /^[a-f\d]{40}$/i.test(mdn.source.commit) && mdn.steps[0].capture?.startsWith('data:image/png;base64,'));
  check('Import and manual checks do not invoke a model', report.draftRequests === 0); await shot(page, 'mdn-import-accepted');
  page = await context.newPage(); page.setDefaultTimeout(30000); await page.goto(origin + '/#upload', { waitUntil: 'networkidle' });
  }
  await page.getByLabel('Upload HTML or ZIP', { exact: true }).setInputFiles({ name: 'proof-counter.html', mimeType: 'text/html', buffer: Buffer.from(source) }); await ready(page);
  await page.getByRole('textbox', { name: 'Requirements', exact: true }).fill(requirement); check('No automatic generation occurs before the explicit click', report.draftRequests === 0);
  const modelResponse = page.waitForResponse(res => new URL(res.url()).origin === origin && new URL(res.url()).pathname === '/api/upload/planner/draft' && res.request().method() === 'POST', { timeout: 75000 });
  permitDraft = true; await button(page, 'Generate draft with Doubao').click(); const generated = await modelResponse, draft = await generated.json(); report.planner = { status: generated.status(), ...draft }; save(`${tag}-provider-draft.json`, report.planner);
  check('Exactly one real Doubao Seed 2.0 Pro request returns a reviewable draft', report.draftRequests === 1 && generated.ok() && draft.ok === true && /^doubao-seed-2-0-pro-/.test(draft.modelId));
  await page.locator('[data-testid="ai-plan-draft"]').waitFor(); await shot(page, 'doubao-draft-review'); check('The draft has no unresolved questions', Array.isArray(draft.draft.openQuestions) && draft.draft.openQuestions.length === 0);
  const proposed = draft.draft.steps, frame = page.frameLocator('iframe[sandbox]'); let clicks = 0, provesOne = false;
  for (const item of proposed) { assert.ok(['click', 'assertText', 'assertCount', 'assertValue'].includes(item.action), 'Review rejects unrelated or destructive operations'); const target = frame.locator(item.selector); assert.equal(await target.count(), 1, 'Reviewed selector resolves uniquely'); const id = await target.getAttribute('id'); if (item.action === 'click') { assert.equal(id, 'increment'); clicks++; } if (item.action === 'assertText' && id === 'count' && item.value === '1' && clicks === 1) provesOne = true; }
  check('Read-only review confirms one increment followed by a count-of-one assertion', clicks === 1 && provesOne && await frame.locator('#count').innerText() === '0');
  await button(page, 'Apply draft to plan').click(); check('Applying a draft requires separate confirmation and has not run it', !(await confirm(page).isChecked()) && await frame.locator('#count').innerText() === '0');
  const accepted = await run(page, 'doubao-counter'), counter = accepted.currentRun;
  check('The actual browser executes the generated plan and observes count one', counter.status === 'passed' && counter.steps.every(item => item.status === 'passed') && await frame.locator('#count').innerText() === '1' && counter.steps.some(item => item.capture?.startsWith('data:image/png;base64,')));
  assert.deepEqual(counter.steps.map(({ id, action, selector, value, description }) => ({ id, action, selector, value, description })), proposed);
  check('The exported provenance preserves actual model, tokens, and reviewed draft', accepted.currentPlanOrigin?.kind === 'ai-draft' && accepted.currentPlanOrigin.modelId === draft.modelId && JSON.stringify(accepted.currentPlanOrigin.usage) === JSON.stringify(draft.usage));
  await shot(page, 'doubao-real-acceptance'); check('No retries, unexpected network, or browser exceptions occurred', report.draftRequests === 1 && report.blockedRequests.length === 0 && report.errors.length === 0); report.passed = true;
} catch (error) { report.error = redact(error.stack || error); process.exitCode = 1; if (page && !page.isClosed()) { await shot(page, 'stopped-state').catch(() => {}); fs.writeFileSync(path.join(out, `${tag}-stopped-dom.txt`), redact(await page.locator('body').innerText().catch(() => ''))); } }
finally { await browser?.close(); report.finishedAt = new Date().toISOString(); save('production-report.json', report); console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, draftRequests: report.draftRequests, report: path.join(out, 'production-report.json') })); }
