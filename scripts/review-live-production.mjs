/** Authenticated smoke of the exact existing private deployment; never changes access. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const token = process.env.MING_SITE_REVIEW_TOKEN;
delete process.env.MING_SITE_REVIEW_TOKEN;
if (!token) throw Error('Private deployment review needs the existing authorized review credential.');
const origin = 'https://ming-acceptance-proof.amosming.chatgpt.site';
const out = path.join(root, 'docs/evidence/live-trial');
const work = path.join(root, 'runtime/live-production-review');
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(work, { recursive: true });
const report = { checkedAt: new Date().toISOString(), checks: [], errors: [], outsideRequests: [], mutations: [], passed: false };
const check = (name, passed) => { report.checks.push({ name, passed: !!passed }); if (!passed) throw Error(name); };
const bundle = fs.readFileSync(path.join(root, 'apps/web/dist/index.html'), 'utf8').match(/\/assets\/[^"']+\.js/)[0];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true });
  await context.route('**/*', route => {
    const req = route.request(), url = req.url();
    if (/^(?:data|blob|about):/.test(url)) return route.continue();
    if (new URL(url).origin !== origin) { report.outsideRequests.push(new URL(url).origin); return route.abort(); }
    if (!['GET', 'HEAD'].includes(req.method())) report.mutations.push({ method: req.method(), path: new URL(url).pathname });
    return route.continue({ headers: { ...req.headers(), 'OAI-Sites-Authorization': `Bearer ${token}` } });
  });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  const response = await page.goto(origin, { waitUntil: 'networkidle' });
  check('Production serves the current compiled application', (await response.text()).includes(bundle));
  check('Original welcome remains the entry point', await page.getByRole('link', { name: 'Start', exact: true }).isVisible());
  await page.getByRole('link', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Run live checks', exact: true }).waitFor();
  check('Start enters the live trial', page.url().endsWith('#trial'));
  await page.locator('#trial-task-name').fill('Review a live acceptance check');
  await page.getByRole('button', { name: 'Run live checks', exact: true }).click();
  await page.getByText('2 passed · 1 failed', { exact: true }).waitFor();
  const exported = async name => {
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export evidence report', exact: true }).click();
    const transfer = await promise, file = path.join(work, name);
    await transfer.saveAs(file); return JSON.parse(fs.readFileSync(file, 'utf8'));
  };
  const before = await exported('baseline.json'), baseline = before.currentRun;
  check('Hosted sample produced a fresh actual failed check', baseline.status === 'completed' && baseline.criteria.map(c => c.status).join(',') === 'passed,failed,passed' && baseline.steps.length === 16);
  check('Failure came from this run\'s unique task', baseline.criteria[1].observed.includes(baseline.taskName));
  check('Current DOM captures are available', baseline.criteria.every(c => c.capture?.startsWith('data:image/png;base64,') && c.capture.length > 1000));
  await page.getByRole('button', { name: 'Apply prepared fix & rerun', exact: true }).click();
  await page.getByText('3 passed · 0 failed', { exact: true }).waitFor();
  const after = await exported('followup.json'), rerun = after.currentRun;
  check('Prepared fix passes fresh hosted checks', rerun.status === 'completed' && rerun.criteria.every(c => c.status === 'passed') && rerun.steps.length === 16);
  check('Two runs have distinct identities and unchanged acceptance standard', baseline.id !== rerun.id && baseline.taskName !== rerun.taskName && baseline.planFingerprint === rerun.planFingerprint);
  assert.deepEqual(after.baseline, baseline);
  check('Original failed observations remain unchanged', true);
  await page.locator('.trial-comparison').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, 'production-comparison.png') });
  await page.getByRole('link', { name: 'Evidence Studio', exact: true }).click();
  await page.getByRole('region', { name: 'Recorded acceptance timeline' }).waitFor();
  check('Original recorded evidence remains accessible', page.url().endsWith('#studio'));
  check('No application JavaScript exceptions', report.errors.length === 0);
  check('Trial makes no remote or mutation requests', report.outsideRequests.length === 0 && report.mutations.length === 0);
  report.passed = true;
} catch (error) { report.error = String(error); process.exitCode = 1; }
finally { await browser.close(); fs.writeFileSync(path.join(out, 'production-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); }
