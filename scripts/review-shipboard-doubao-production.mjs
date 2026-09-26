/** Real deployed Shipboard acceptance regression. Run only when explicitly authorized after deployment.
 * One real Doubao request, no mocks, no retries, no plan repair, and no source repair.
 * Existing MING_SITE_REVIEW_TOKEN is attached only to the exact private-site origin and never saved.
 * The second upload is the existing corrected fixture, not an AI-generated repair.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const token = process.env.MING_SITE_REVIEW_TOKEN;
delete process.env.MING_SITE_REVIEW_TOKEN;
if (!token) throw Error('The existing authorized private-site review credential is required. This script does not create credentials.');
const origin = 'https://ming-acceptance-proof.amosming.chatgpt.site';
const reviewId = randomUUID(), tag = reviewId.slice(0, 8), stamp = new Date().toISOString().replace(/[:.]/g, '-');
const work = path.join(root, 'runtime', `shipboard-doubao-production-${reviewId}`);
const out = path.join(root, 'docs/evidence/shipboard-doubao', `${stamp}-${tag}`);
fs.mkdirSync(work, { recursive: true });
const bundle = fs.readFileSync(path.join(root, 'apps/web/dist/index.html'), 'utf8').match(/\/assets\/[^"']+\.js/)?.[0];
assert.ok(bundle, 'Build the frontend before verifying the exact deployment.');
const buggy = path.join(root, 'examples/shipboard/buggy/index.html');
const normal = path.join(root, 'examples/shipboard/normal/index.html');
assert.ok(fs.existsSync(buggy) && fs.existsSync(normal), 'Both existing Shipboard fixtures must be available.');
assert.equal(path.basename(buggy), path.basename(normal), 'Revisions must use the same entry filename.');
const taskName = 'Ming acceptance test', emptyMessage = 'Add a task name before continuing.';
const requirement = [
  '1. Submit an empty task name. Show “Add a task name before continuing.” and keep the count at “0 tasks”.',
  '2. Add a task named “Ming acceptance test”. It must appear in the task list.',
  '3. Reload the application. “Ming acceptance test” must still appear in the task list.',
].join('\n');
const report = {
  reviewId, startedAt: new Date().toISOString(), origin, expectedBundle: bundle, passed: false,
  scope: 'One real Doubao Seed 2.0 Pro draft using the stated three requirements; read-only review; actual browser checks against existing buggy and corrected Shipboard uploads. Identical generated plan, immutable failing baseline, no automatic model retry or source repair.',
  requirement, fixtures: { buggy: path.relative(root, buggy), corrected: path.relative(root, normal) },
  checks: [], runs: [], blockedRequests: [], errors: [], screenshots: [], draftRequests: 0,
};
const redact = value => String(value).split(token).join('[REDACTED]');
const save = (name, value) => fs.writeFileSync(path.join(work, name), redact(JSON.stringify(value, null, 2)));
const check = (name, condition) => {
  report.checks.push({ name, passed: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`);
  if (!condition) throw Error(name);
};
const button = (page, name) => page.getByRole('button', { name, exact: true });
const confirm = page => page.getByRole('checkbox', { name: 'I reviewed these requirements and steps for this project.', exact: true });
const ready = page => page.waitForFunction(() => {
  const node = document.querySelector('[data-testid="upload-studio"]');
  return node?.dataset.previewReady === 'true' && node.dataset.phase === 'idle';
}, null, { timeout: 45000 });
const planFields = steps => steps.map(({ id, action, selector, value, description }) => ({ id, action, selector, value, description }));
async function editablePlan(page) {
  return page.locator('[data-testid="upload-step"]').evaluateAll(rows => rows.map(row => [...row.querySelectorAll('input,select')].map(field => ({ label: field.getAttribute('aria-label'), value: field.value }))));
}
async function shot(page, name) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const file = `${name}.png`; await page.screenshot({ path: path.join(work, file), fullPage: true }); report.screenshots.push(file);
}
async function exportEvidence(page, name) {
  const transfer = page.waitForEvent('download'); await button(page, 'Export evidence report').click();
  const file = `${name}.json`; await (await transfer).saveAs(path.join(work, file));
  const exported = JSON.parse(fs.readFileSync(path.join(work, file), 'utf8'));
  assert.equal(exported.format, 'ming-upload-v1');
  const current = exported.currentRun;
  report.runs.push({ ...current, export: file, planOrigin: exported.currentPlanOrigin, steps: current.steps.map(({ capture, ...step }, index) => {
    if (!capture) return step;
    assert.ok(capture.startsWith('data:image/png;base64,'), 'Capture is an actual PNG DOM render');
    const bytes = Buffer.from(capture.split(',')[1], 'base64');
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(bytes.length > 1000 && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0, 'DOM render has nonempty pixels and dimensions');
    const captureFile = `${name}-step-${index + 1}.png`; fs.writeFileSync(path.join(work, captureFile), bytes);
    return { ...step, capture: { file: captureFile, bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: createHash('sha256').update(bytes).digest('hex') } };
  }) });
  return exported;
}
async function run(page, name) {
  await confirm(page).check(); await button(page, 'Run acceptance checks').click();
  await button(page, 'Cancel checks').waitFor(); await button(page, 'Cancel checks').waitFor({ state: 'hidden', timeout: 90000 });
  return exportEvidence(page, name);
}
/** Read-only semantic review: inspect selectors and ordering, never execute or rewrite model steps. */
async function reviewPlan(page, proposed) {
  assert.ok(Array.isArray(proposed) && proposed.length > 0 && proposed.length <= 30);
  const frame = page.frameLocator('iframe[sandbox]');
  let inputValue = '', emptySubmissions = 0, taskSubmissions = 0, reloads = 0;
  let provesError = false, provesEmptyCount = false, provesAdded = false, provesPersisted = false, reloadIndex = -1;
  const details = [];
  for (let index = 0; index < proposed.length; index++) {
    const step = proposed[index];
    assert.ok(['fill', 'click', 'reload', 'assertText', 'assertCount', 'assertValue'].includes(step.action), 'Reject unrelated or destructive actions');
    if (step.action === 'reload') {
      assert.ok(taskSubmissions === 1 && provesAdded && reloads === 0, 'Reload occurs once, after a visible successful creation assertion');
      reloads++; reloadIndex = index; details.push({ index, action: step.action }); continue;
    }
    const target = await frame.locator('body').evaluate((body, selector) => {
      const nodes = [...body.ownerDocument.querySelectorAll(selector)];
      return { count: nodes.length, id: nodes[0]?.id, tag: nodes[0]?.tagName, form: nodes[0]?.form?.id, type: nodes[0]?.type,
        containsNotice: nodes.some(node => node.contains(body.ownerDocument.getElementById('notice'))),
        containsCount: nodes.some(node => node.contains(body.ownerDocument.getElementById('taskCount'))),
        containsList: nodes.some(node => node.contains(body.ownerDocument.getElementById('taskList'))) };
    }, step.selector);
    details.push({ index, action: step.action, selector: step.selector, target });
    if (step.action === 'fill') {
      assert.ok(target.count === 1 && target.id === 'taskName' && !taskSubmissions && !reloads, 'Only the known task-name input may be filled before creation');
      assert.ok(step.value === '' || step.value === taskName, 'Task value must match the stated requirement'); inputValue = step.value;
    } else if (step.action === 'click') {
      assert.ok(target.count === 1 && target.tag === 'BUTTON' && target.type === 'submit' && target.form === 'taskForm' && !reloads, 'Only the observed Add task submit button may be clicked');
      if (inputValue === '') { assert.ok(emptySubmissions === 0 && taskSubmissions === 0); emptySubmissions++; }
      else { assert.ok(inputValue === taskName && emptySubmissions === 1 && provesError && provesEmptyCount && taskSubmissions === 0, 'Creation follows both empty-input assertions'); taskSubmissions++; inputValue = ''; }
    } else if (step.action === 'assertText') {
      if (emptySubmissions === 1 && !taskSubmissions && target.containsNotice && step.value === emptyMessage) provesError = true;
      if (emptySubmissions === 1 && !taskSubmissions && target.containsCount && step.value === '0 tasks') provesEmptyCount = true;
      const checksList = target.containsList || /^#taskList(?:\s|>)/.test(step.selector);
      if (taskSubmissions === 1 && checksList && step.value === taskName) { if (reloads) provesPersisted = true; else provesAdded = true; }
    }
  }
  assert.ok(emptySubmissions === 1 && taskSubmissions === 1 && reloads === 1 && provesError && provesEmptyCount && provesAdded && provesPersisted, 'The unchanged generated plan must prove all three original requirements');
  assert.equal(await frame.locator('#taskCount').innerText(), '0 tasks');
  assert.equal(await frame.locator('#taskList').innerText(), '');
  report.semanticReview = { details, provesError, provesEmptyCount, provesAdded, provesPersisted, reloadIndex };
  return reloadIndex;
}

let browser, page, permitDraft = false;
try {
  browser = await chromium.launch({ headless: true });
  // Default service-worker setting avoids Playwright injecting code incompatible with an opaque sandbox.
  const context = await browser.newContext({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true });
  context.on('page', current => current.on('pageerror', error => report.errors.push(redact(error.message))));
  await context.route('**/*', route => {
    const request = route.request(), href = request.url(); if (/^(?:blob|data|about):/.test(href)) return route.continue();
    const url = new URL(href), method = request.method();
    if (url.origin !== origin) { report.blockedRequests.push({ origin: url.origin, path: url.pathname, method }); return route.abort(); }
    if (url.pathname === '/api/upload/planner/draft' && method === 'POST') {
      report.draftRequests++;
      const body = request.postDataJSON(), allowed = permitDraft && report.draftRequests === 1 && body?.confirmedUserAction === true && body?.requirement === requirement;
      permitDraft = false;
      if (!allowed) { report.blockedRequests.push({ path: url.pathname, method }); return route.abort(); }
      report.requestContext = { projectName: body.projectName, entry: body.entry, requirement: body.requirement, elements: body.elements };
    } else if (!['GET', 'HEAD'].includes(method) && !url.pathname.startsWith('/cdn-cgi/challenge-platform/')) {
      report.blockedRequests.push({ path: url.pathname, method }); return route.abort();
    }
    return route.continue({ headers: { ...request.headers(), 'OAI-Sites-Authorization': `Bearer ${token}` } });
  });
  page = await context.newPage(); page.setDefaultTimeout(30000);
  const response = await page.goto(origin + '/#upload', { waitUntil: 'networkidle' });
  check('Private deployment serves the exact compiled application', response.ok() && (await response.text()).includes(bundle));
  await page.getByLabel('Upload HTML or ZIP', { exact: true }).setInputFiles(buggy); await ready(page);
  const firstFingerprint = await page.getByTestId('upload-studio').getAttribute('data-project-fingerprint');
  await page.getByRole('textbox', { name: 'Requirements', exact: true }).fill(requirement);
  check('Opening Shipboard and entering the requirements makes no automatic model request', report.draftRequests === 0);
  const modelResponse = page.waitForResponse(res => new URL(res.url()).origin === origin && new URL(res.url()).pathname === '/api/upload/planner/draft' && res.request().method() === 'POST', { timeout: 75000 });
  permitDraft = true; await button(page, 'Generate draft with Doubao').click();
  const generated = await modelResponse, draft = await generated.json(); report.planner = { status: generated.status(), ...draft }; save('provider-draft.json', report.planner);
  check('One real Doubao Seed 2.0 Pro request returns a valid review draft', report.draftRequests === 1 && generated.ok() && draft.ok === true && /^doubao-seed-2-0-pro-/.test(draft.modelId));
  await page.getByTestId('ai-plan-draft').waitFor();
  check('The generated draft has no unresolved questions', Array.isArray(draft.draft.openQuestions) && draft.draft.openQuestions.length === 0);
  const proposed = structuredClone(draft.draft.steps), reloadIndex = await reviewPlan(page, proposed);
  check('Read-only review confirms empty-input validation, task creation, and persistence without executing them', reloadIndex >= 0 && await page.locator('[data-testid="upload-step"]').count() === 1);
  await shot(page, '01-shipboard-draft-review');
  await button(page, 'Apply draft to plan').click();
  const appliedFields = await editablePlan(page);
  check('Applying the reviewed draft requires separate confirmation', !(await confirm(page).isChecked()) && await button(page, 'Run acceptance checks').isDisabled());
  const first = await run(page, 'buggy-evidence'), failure = first.currentRun;
  assert.deepEqual(planFields(failure.steps), proposed);
  const failedIndex = failure.steps.findIndex(step => step.status === 'failed');
  check('The actual buggy application passes the validation and creation steps before failing after reload', failure.status === 'failed' && failedIndex > reloadIndex && failure.steps.slice(0, failedIndex).every(step => step.status === 'passed') && failure.steps[failedIndex].action === 'assertText' && failure.steps[failedIndex].value === taskName);
  check('The failed persistence assertion includes an actual DOM-render capture', failure.runner === 'isolated-browser-dom' && failure.captureKind === 'dom-render' && failure.steps[failedIndex].capture?.startsWith('data:image/png;base64,') && failure.projectFingerprint === firstFingerprint);
  check('The exported draft provenance retains actual provider and token usage', first.currentPlanOrigin?.kind === 'ai-draft' && first.currentPlanOrigin.modelId === draft.modelId && JSON.stringify(first.currentPlanOrigin.usage) === JSON.stringify(draft.usage));
  assert.deepEqual(first.baseline, failure); const preservedBaseline = structuredClone(first.baseline);
  await button(page, 'Copy repair brief').click(); const brief = await page.getByRole('textbox', { name: 'Repair brief', exact: true }).inputValue();
  check('The repair brief retains the requirement and observed persistence failure', brief.includes(requirement) && brief.includes(taskName) && brief.includes(failure.id));
  fs.writeFileSync(path.join(work, 'repair-brief.txt'), redact(brief)); await shot(page, '02-shipboard-persistence-failure');
  await page.getByLabel('Upload revised HTML or ZIP', { exact: true }).setInputFiles(normal); await ready(page);
  const revisedFingerprint = await page.getByTestId('upload-studio').getAttribute('data-project-fingerprint');
  assert.deepEqual(await editablePlan(page), appliedFields);
  check('Uploading the corrected source changes the fingerprint while preserving the requirements and exact plan', revisedFingerprint !== firstFingerprint && await page.getByRole('textbox', { name: 'Requirements', exact: true }).inputValue() === requirement && !(await confirm(page).isChecked()));
  const second = await run(page, 'corrected-evidence'), success = second.currentRun;
  assert.deepEqual(planFields(success.steps), proposed); assert.deepEqual(second.baseline, preservedBaseline);
  check('The corrected application passes every unchanged generated step, including persistence', success.status === 'passed' && success.steps.every(step => step.status === 'passed') && (await page.frameLocator('iframe[sandbox]').locator('#taskList').innerText()).includes(taskName));
  check('Comparison records the same plan and entry, a different source, and the preserved failing baseline', second.comparison.samePlan && second.comparison.sameEntry && second.comparison.sameSourceTarget && second.comparison.sourceChanged && second.comparison.revisedSourcePassed && second.baseline.status === 'failed' && second.rerun.id === success.id);
  check('Both checks have distinct run IDs and timestamps with identical acceptance criteria', failure.id !== success.id && failure.startedAt !== success.startedAt && failure.planFingerprint === success.planFingerprint && failure.entry === success.entry && success.projectFingerprint === revisedFingerprint);
  await shot(page, '03-shipboard-revision-accepted');
  check('Exactly one paid draft was used without retries, unexpected network, or browser errors', report.draftRequests === 1 && report.blockedRequests.length === 0 && report.errors.length === 0);
  report.passed = true;
} catch (error) {
  report.error = redact(error.stack || error); process.exitCode = 1;
  if (page && !page.isClosed()) {
    await shot(page, 'stopped-state').catch(() => {});
    fs.writeFileSync(path.join(work, 'stopped-dom.txt'), redact(await page.locator('body').innerText().catch(() => '')));
  }
} finally {
  await browser?.close(); report.finishedAt = new Date().toISOString(); save('production-report.json', report);
  const destination = report.passed ? out : work;
  if (report.passed) { fs.mkdirSync(out, { recursive: true }); for (const file of fs.readdirSync(work)) fs.copyFileSync(path.join(work, file), path.join(out, file)); }
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, draftRequests: report.draftRequests, report: path.join(destination, 'production-report.json') }));
}
