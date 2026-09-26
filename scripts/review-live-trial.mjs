/** Black-box review of Ming's compiled, browser-local trial.
 * Run the packaged Worker preview first (default http://127.0.0.1:4182).
 * This review never calls a model, edits an application, or changes recorded proof.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const base = process.env.MING_TRIAL_REVIEW_URL || 'http://127.0.0.1:4182';
const origin = new URL(base).origin;
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('This review requires a local compiled preview.');
const reviewId = randomUUID();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
let out = path.join(root, 'docs', 'evidence', 'live-trial', `${stamp}-${reviewId.slice(0, 8)}`);
const working = path.join(root, 'runtime', `live-trial-review-${reviewId}`);
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(working, { recursive: true });
const report = { reviewId, startedAt: new Date().toISOString(), base, checks: [], pageErrors: [], outsideRequests: [], requests: [], fixtureRequests: [], failedResources: [], screenshots: [], runs: [], passed: false };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sentinelKey = 'ming.review.storage-sentinel';
const sentinelValue = `preserve-${reviewId}`;
let browser, context, page;

function check(name, passed, detail) {
  report.checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) throw Error(name);
}
async function screenshot(current, name, fullPage = false) {
  const file = path.join(out, `${name}.png`);
  await current.screenshot({ path: file, fullPage, animations: 'disabled' });
  report.screenshots.push({ file: path.relative(out, file).replaceAll('\\', '/'), sha256: hash(fs.readFileSync(file)) });
}
async function noOverflow(current, label) {
  const widths = await current.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  check(label, widths.page <= widths.viewport + 1, widths);
}
async function download(current, button, filename) {
  const pending = current.waitForEvent('download');
  await button.click();
  const transfer = await pending;
  const destination = path.join(working, filename);
  await transfer.saveAs(destination);
  return { text: fs.readFileSync(destination, 'utf8'), suggestedFilename: transfer.suggestedFilename() };
}
function exportedRuns(value) {
  const found = new Map();
  const visit = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 5) return;
    if (typeof node.id === 'string' && Array.isArray(node.criteria) && Array.isArray(node.steps) && node.runner === 'in-browser-dom') { found.set(node.id, node); return; }
    for (const item of Object.values(node)) visit(item, depth + 1);
  };
  visit(value);
  return [...found.values()].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}
async function exportRuns(current, filename) {
  const transfer = await download(current, ui.report(current), filename);
  const exported = JSON.parse(transfer.text);
  const runs = exportedRuns(exported);
  assert.ok(runs.length > 0, 'Export must contain actual trial records');
  return { exported, runs, latest: runs[0] };
}
async function completed(current, filename) {
  await ui.cancel(current).waitFor({ state: 'hidden', timeout: 30000 });
  await ui.report(current).waitFor({ state: 'visible' });
  return exportRuns(current, filename);
}
function summarizeRun(run) {
  const captures = run.criteria.filter(item => item.capture).map(item => ({ criterion: item.id, ...pngFacts(item.capture) }));
  const summary = { id: run.id, variant: run.variant, taskName: run.taskName, startedAt: run.startedAt, finishedAt: run.finishedAt, planFingerprint: run.planFingerprint, status: run.status, runner: run.runner, captureKind: run.captureKind, criteria: run.criteria.map(({ capture, ...item }) => item), stepCount: run.steps.length, captures };
  report.runs.push(summary);
  return summary;
}
async function storageClean(current, label) {
  const values = await current.evaluate(key => ({ sentinel: localStorage.getItem(key), ownedKeys: Object.keys(localStorage).filter(name => name.startsWith('ming.online-trial.shipboard.')) }), sentinelKey);
  check(label, values.sentinel === sentinelValue && values.ownedKeys.length === 0, values);
}
function pngFacts(dataUrl) {
  assert.match(dataUrl, /^data:image\/png;base64,/);
  const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(bytes.length > 1000, 'Captured DOM evidence must contain actual image content');
  return { bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: hash(bytes) };
}
function observeContext(current) {
  current.on('page', next => next.on('pageerror', error => report.pageErrors.push({ url: next.url(), message: error.message })));
  current.on('request', request => {
    const url = request.url();
    if (/^(?:data|blob|about):/.test(url)) return;
    if (new URL(url).origin !== origin) report.outsideRequests.push(url);
    else {
      const parsed = new URL(url);
      report.requests.push({ method: request.method(), path: parsed.pathname, resource: request.resourceType() });
      if (/\/trial\/shipboard(?:\.html)?$/.test(parsed.pathname)) report.fixtureRequests.push({ variant: parsed.searchParams.get('variant'), session: parsed.searchParams.get('session') });
    }
  });
  current.on('response', response => {
    if (response.status() >= 400 && !response.url().includes('/favicon.ico')) report.failedResources.push({ url: response.url(), status: response.status() });
  });
}

// Product selectors and exported-run assertions are deliberately collected here.
// They follow the rendered public workflow, not private component state.
const ui = {
  trial: current => current.locator('[data-testid="live-trial"]'),
  start: current => current.getByRole('button', { name: /^Run (?:live checks|a fresh check)$/ }),
  cancel: current => current.getByRole('button', { name: 'Cancel checks', exact: true }),
  fixed: current => current.getByRole('button', { name: 'Apply prepared fix & rerun', exact: true }),
  report: current => current.getByRole('button', { name: 'Export evidence report', exact: true }),
  brief: current => current.getByRole('button', { name: 'Copy repair brief', exact: true }),
  task: current => current.getByRole('textbox', { name: 'Make the test yours', exact: true }),
};

try {
  const response = await fetch(base, { signal: AbortSignal.timeout(5000) });
  const capabilities = await (await fetch(base + '/api/capabilities', { signal: AbortSignal.timeout(5000) })).json();
  check('Compiled preview is available with a read-only server', response.ok && capabilities.readOnly === true);
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true });
  observeContext(context);
  page = await context.newPage(); page.setDefaultTimeout(20000);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: sentinelKey, value: sentinelValue });
  const start = page.getByRole('link', { name: 'Start', exact: true }).or(page.getByRole('button', { name: 'Start', exact: true }));
  check('Welcome presents Start before mounting an application workspace', await start.isVisible() && !new URL(page.url()).hash);
  await start.click(); await page.getByTestId('upload-studio').waitFor();
  check('Start opens the own-project upload workspace', new URL(page.url()).hash === '#upload');
  await page.getByRole('link', { name: 'Try a sample', exact: true }).click();
  await ui.trial(page).waitFor();
  check('The guided live trial remains accessible', new URL(page.url()).hash === '#trial');
  await screenshot(page, '01-live-trial-ready');

  const trialRequestStart = report.requests.length;
  const fixtureStart = report.fixtureRequests.length;
  const customTask = `Review the release ${reviewId.slice(0, 8)}`;
  await ui.task(page).fill(customTask);
  // Observe actual rendered DOM before the run starts. The successful task exists
  // briefly before the real reload; a backoff-based locator can miss that moment.
  await page.evaluate(() => {
    window.__mingReviewTasks = [];
    window.__mingReviewTaskTimer = setInterval(() => {
      const doc = document.querySelector('iframe[title="Live Shipboard sample application"]')?.contentDocument;
      for (const element of doc?.querySelectorAll('.task-name') || []) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && !window.__mingReviewTasks.includes(element.textContent)) window.__mingReviewTasks.push(element.textContent);
      }
    }, 16);
  });
  const runStartedAfter = Date.now();
  await ui.start(page).click(); await ui.cancel(page).waitFor({ state: 'visible' });
  await page.waitForFunction(prefix => window.__mingReviewTasks?.some(name => name.startsWith(prefix)), customTask);
  const observedTask = await page.evaluate(prefix => { clearInterval(window.__mingReviewTaskTimer); return window.__mingReviewTasks.find(name => name.startsWith(prefix)); }, customTask);
  check('The custom task appears in the actual sample DOM during execution', observedTask.startsWith(customTask + ' · '));
  const first = await completed(page, 'buggy-report.json');
  const baseline = first.latest;
  const baselineBytes = JSON.stringify(baseline);
  check('Original buggy app produces two passes and one real persistence failure', baseline.variant === 'buggy' && baseline.status === 'completed' && baseline.criteria.map(item => item.status).join(',') === 'passed,failed,passed');
  check('Exported task exactly matches the observed sample DOM', baseline.taskName === observedTask);
  check('Run identity and timestamps are created by this visit', /^[0-9a-f-]{36}$/i.test(baseline.id) && Date.parse(baseline.startedAt) >= runStartedAfter && Date.parse(baseline.finishedAt) > Date.parse(baseline.startedAt));
  check('Report describes its real in-browser runner and DOM-render evidence', baseline.runner === 'in-browser-dom' && baseline.captureKind === 'dom-render' && baseline.steps.length === 16 && /^[0-9a-f]{64}$/.test(baseline.planFingerprint));
  const baselineSummary = summarizeRun(baseline);
  check('Each criterion includes a non-empty PNG rendered from the inspected DOM', baselineSummary.captures.length === 3 && baselineSummary.captures.every(item => item.width >= 300 && item.height >= 100));
  check('All four planned capture points preserve actual DOM render images', baseline.steps.filter(step => step.capture).length === 4 && baseline.steps.filter(step => step.capture).every(step => pngFacts(step.capture).width >= 300));
  check('Creation and post-reload captures differ with the observed app state', baselineSummary.captures[0].sha256 !== baselineSummary.captures[1].sha256);
  const baselineRequests = report.fixtureRequests.slice(fixtureStart);
  const sessions = [...new Set(baselineRequests.map(item => item.session))];
  check('The actual sample reloads its first session and validates blanks in a separate session', sessions.length === 2 && baselineRequests.filter(item => item.session === sessions[0]).length >= 2 && baselineRequests.every(item => item.variant === 'buggy'));
  check('Persistence assertion reports the exact missing task, not a canned diagnosis', baseline.criteria[1].observed.includes(baseline.taskName) && /absent/i.test(baseline.criteria[1].observed));
  check('Blank-name acceptance inspects both empty and whitespace submissions', baseline.steps.some(item => item.id === 'SHIP-03-S3' && item.status === 'passed') && baseline.steps.some(item => item.id === 'SHIP-03-S7' && item.status === 'passed') && baseline.criteria[2].status === 'passed');
  await screenshot(page, '02-buggy-app-observed', true);
  await storageClean(page, 'Finishing a trial removes its own sample keys and preserves unrelated storage');

  await ui.brief(page).click();
  const repair = await page.getByRole('textbox', { name: 'Repair brief', exact: true }).inputValue();
  fs.writeFileSync(path.join(working, 'repair-brief.md'), repair);
  check('Repair brief contains this run, failed requirement, exact task, and honest execution scope', repair.includes(baseline.id) && repair.includes('SHIP-02') && repair.includes(baseline.taskName) && repair.includes(baseline.planFingerprint) && /No AI was called/i.test(repair) && /DOM renders/i.test(repair));
  await ui.fixed(page).click(); await ui.cancel(page).waitFor({ state: 'visible' });
  const followup = await completed(page, 'prepared-fix-report.json');
  const fixed = followup.latest;
  check('Prepared fixed version genuinely passes all three original criteria', fixed.variant === 'fixed' && fixed.status === 'completed' && fixed.criteria.length === 3 && fixed.criteria.every(item => item.status === 'passed'));
  check('Prepared fix uses the same plan with a new run, task, and timestamp', fixed.planFingerprint === baseline.planFingerprint && fixed.id !== baseline.id && fixed.taskName !== baseline.taskName && Date.parse(fixed.startedAt) > Date.parse(baseline.startedAt));
  const retainedBaseline = followup.runs.find(run => run.id === baseline.id);
  check('The original failing baseline stays unchanged beside its follow-up', retainedBaseline && JSON.stringify(retainedBaseline) === baselineBytes);
  summarizeRun(fixed);
  await screenshot(page, '03-prepared-fix-compared', true);
  await storageClean(page, 'Prepared fixed trial also removes only its own storage');

  await ui.fixed(page).click(); await ui.cancel(page).waitFor({ state: 'visible' });
  check('Starting another prepared rerun clears the previous verified banner and comparison', await page.locator('.trial-repair-verified').count() === 0 && await page.locator('.trial-comparison').count() === 0 && !(await page.getByText('The fix holds up.', { exact: true }).isVisible()));
  await ui.cancel(page).click();
  const stoppedFixed = await completed(page, 'cancelled-prepared-rerun.json');
  check('Cancelling that rerun cannot inherit its earlier verified result', stoppedFixed.latest.status === 'cancelled' && stoppedFixed.latest.variant === 'fixed' && stoppedFixed.exported.comparison?.allRerunCriteriaPassed === false && await page.locator('.trial-repair-verified').count() === 0);
  check('A cancelled prepared rerun still preserves the exact original baseline', JSON.stringify(stoppedFixed.runs.find(run => run.id === baseline.id)) === baselineBytes);
  summarizeRun(stoppedFixed.latest);

  await ui.start(page).click(); await ui.cancel(page).waitFor({ state: 'visible' });
  await ui.cancel(page).click();
  const cancelledExport = await completed(page, 'cancelled-report.json');
  const cancelled = cancelledExport.latest;
  check('Cancel keeps an incomplete run instead of declaring unchecked criteria passed', cancelled.status === 'cancelled' && cancelled.criteria.some(item => item.status === 'unchecked') && cancelled.steps.length < 16);
  summarizeRun(cancelled);
  await storageClean(page, 'Cancelling preserves unrelated storage and removes the cancelled session');

  await ui.start(page).click(); await ui.cancel(page).waitFor({ state: 'visible' });
  const retriedExport = await completed(page, 'retry-report.json');
  const retried = retriedExport.latest;
  check('Retry executes fresh checks after cancellation', retried.status === 'completed' && retried.id !== cancelled.id && retried.taskName !== cancelled.taskName && retried.criteria.map(item => item.status).join(',') === 'passed,failed,passed');
  summarizeRun(retried);

  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page, 'Live trial and result remain within a 390px viewport');
  await screenshot(page, '04-live-trial-mobile', true);
  await page.setViewportSize({ width: 1484, height: 1060 });

  // Two independent iframes run concurrently in tabs sharing the same origin.
  const secondTab = await context.newPage(); secondTab.setDefaultTimeout(20000);
  await secondTab.goto(base + '/#trial', { waitUntil: 'networkidle' }); await ui.trial(secondTab).waitFor();
  await ui.task(secondTab).fill(`Second tab ${reviewId.slice(0, 8)}`);
  await ui.task(page).fill(`First tab ${reviewId.slice(0, 8)}`);
  await Promise.all([ui.start(page).click(), ui.start(secondTab).click()]);
  await Promise.all([ui.cancel(page).waitFor({ state: 'visible' }), ui.cancel(secondTab).waitFor({ state: 'visible' })]);
  const [tabOne, tabTwo] = await Promise.all([completed(page, 'first-tab-report.json'), completed(secondTab, 'second-tab-report.json')]);
  check('Concurrent tabs retain independent run IDs and task names', tabOne.latest.id !== tabTwo.latest.id && tabOne.latest.taskName.startsWith('First tab ') && tabTwo.latest.taskName.startsWith('Second tab '));
  check('Concurrent tabs each inspect their own board and complete the same real outcomes', [tabOne.latest, tabTwo.latest].every(run => run.status === 'completed' && run.criteria.map(item => item.status).join(',') === 'passed,failed,passed'));
  summarizeRun(tabOne.latest); summarizeRun(tabTwo.latest);
  await secondTab.close();
  await storageClean(page, 'Concurrent trial cleanup leaves no cross-tab sample data');

  // A counterfactual fixture proves results are computed from actual DOM behavior.
  const altered = await context.newPage(); altered.setDefaultTimeout(20000);
  await altered.route('**/trial/shipboard.html?*', async route => {
    const fixture = await route.fetch();
    const original = await fixture.text();
    assert.ok(original.includes('id="taskForm"'), 'Only the controlled bundled fixture may be altered');
    await route.fulfill({ response: fixture, body: original.replace('</body>', '<script>document.querySelector("#taskForm button[type=submit]").disabled=true;</script></body>') });
  });
  await altered.goto(base + '/#trial', { waitUntil: 'networkidle' }); await ui.trial(altered).waitFor();
  await ui.start(altered).click(); await ui.cancel(altered).waitFor({ state: 'visible' });
  const alteredExport = await completed(altered, 'disabled-submit-report.json');
  check('Disabling actual submission changes the result: creation fails and dependent reload remains unchecked', alteredExport.latest.criteria.find(item => item.id === 'SHIP-01')?.status === 'failed' && alteredExport.latest.criteria.find(item => item.id === 'SHIP-02')?.status === 'unchecked');
  check('The altered application cannot reuse the normal predetermined outcome', alteredExport.latest.criteria.map(item => item.status).join(',') !== 'passed,failed,passed');
  summarizeRun(alteredExport.latest); await altered.close();

  // Leaving the live route must dispose its running iframe and abort further work.
  await ui.start(page).click(); await ui.cancel(page).waitFor({ state: 'visible' });
  await page.evaluate(() => { location.hash = ''; });
  await page.getByRole('link', { name: 'Start', exact: true }).waitFor();
  await delay(800);
  const requestsAfterLeave = report.fixtureRequests.length;
  await delay(1000);
  check('Leaving #trial removes its iframe and stops further fixture execution', await page.locator('iframe').count() === 0 && report.fixtureRequests.length === requestsAfterLeave);
  await storageClean(page, 'Leaving the route aborts and cleans only its own trial session');
  check('Live execution makes no server mutations or model API requests', report.requests.slice(trialRequestStart).every(request => request.method === 'GET') && !report.requests.slice(trialRequestStart).some(request => /\/api\/(?:generate|provider|run|repair)/.test(request.path)));

  await page.goto(base + '/#studio', { waitUntil: 'networkidle' });
  await page.getByRole('region', { name: 'Recorded acceptance timeline' }).waitFor();
  check('The existing recorded Evidence Studio remains available at #studio', new URL(page.url()).hash === '#studio' && await page.getByRole('button', { name: 'Compare before and after', exact: true }).isVisible());
  check('Product language remains English', /^en(?:-|$)/i.test(await page.locator('html').getAttribute('lang')) && !/\p{Script=Han}/u.test(await page.locator('body').innerText()));
  check('No requests leave the local compiled preview', report.outsideRequests.length === 0, report.outsideRequests);
  check('No broken product or sample resources', report.failedResources.length === 0, report.failedResources);
  check('No uncaught browser exceptions across live, cancellation, and recorded flows', report.pageErrors.length === 0, report.pageErrors);
  report.passed = true;
} catch (error) {
  report.error = String(error.stack || error); console.error(report.error); process.exitCode = 1;
  if (page && !page.isClosed()) {
    fs.writeFileSync(path.join(working, 'stopped-dom.txt'), await page.locator('body').innerText().catch(() => ''));
    await screenshot(page, 'stopped-state').catch(() => {});
  }
} finally {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  if (!report.passed) {
    const failedOut = path.resolve(working, 'incomplete-review');
    assert.ok(failedOut.startsWith(path.resolve(root, 'runtime') + path.sep));
    assert.ok(path.resolve(out).startsWith(path.resolve(root, 'docs', 'evidence', 'live-trial') + path.sep));
    fs.renameSync(out, failedOut);
    out = failedOut;
  }
  fs.writeFileSync(path.join(root, 'runtime', 'live-trial-review-latest.json'), JSON.stringify({ out, report: path.join(out, 'report.json'), working }, null, 2));
  await browser?.close();
  console.log(`REPORT ${path.join(out, 'report.json')}`);
}
