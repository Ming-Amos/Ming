/** Review the exact existing private deployment using generated, harmless upload fixtures.
 * Authentication is supplied once through MING_SITE_REVIEW_TOKEN, used only for the pinned
 * site origin, never persisted, logged, minted, or sent to an uploaded application.
 * Run only after the authorized deployment has completed. This script does not deploy.
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
if (!token) throw Error('Private deployment review needs the existing authorized review credential.');
const origin = 'https://ming-acceptance-proof.amosming.chatgpt.site';
const reviewId = randomUUID(), tag = reviewId.slice(0, 8);
const work = path.join(root, 'runtime', `upload-production-review-${reviewId}`);
const out = path.join(root, 'docs/evidence/upload-studio');
fs.mkdirSync(work, { recursive: true });
const expectedBundle = fs.readFileSync(path.join(root, 'apps/web/dist/index.html'), 'utf8').match(/\/assets\/[^"']+\.js/)?.[0];
if (!expectedBundle) throw Error('A compiled local bundle is required for an exact deployment comparison.');
const report = { reviewId, startedAt: new Date().toISOString(), origin, expectedBundle,
  scope: 'Actual generated HTML and static ZIP files checked inside the visitor browser on the existing private site. No model, Bob, source repair, or server mutation.',
  checks: [], runs: [], errors: [], outsideRequests: [], mutations: [], apiRequests: [], platformRequests: [], passed: false };
const redact = value => String(value).split(token).join('[REDACTED]');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function check(name, passed) { report.checks.push({ name, passed: Boolean(passed) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); if (!passed) throw Error(name); }
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
function zip(entries) {
  const local = [], records = []; let offset = 0;
  for (const [nameText, content] of entries) {
    const name = Buffer.from(nameText), data = Buffer.from(content), crc = crc32(data);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
    const record = Buffer.alloc(46); record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt32LE(crc, 16); record.writeUInt32LE(data.length, 20); record.writeUInt32LE(data.length, 24); record.writeUInt16LE(name.length, 28); record.writeUInt32LE(offset, 42);
    local.push(header, name, data); records.push(record, name); offset += header.length + name.length + data.length;
  }
  const central = Buffer.concat(records), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, central, end]);
}
// Same known-safe Field Notes application as the successful local upload review.
const css = 'body{margin:0;background:rgb(223,244,238);color:#183831;font:16px system-ui}main{max-width:700px;margin:40px auto;padding:28px;background:white;border:1px solid #bbd7cc;border-radius:16px}h1{font-size:30px}label{display:block;margin:24px 0 10px}input{padding:12px;border:1px solid #a9beb5;border-radius:7px}button{padding:12px 18px;background:#166c55;color:white;border:0;border-radius:7px}li{padding:12px}#fixture-logo{width:72px;height:40px}#fixtureMarker{color:#166c55}';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="40"><rect width="72" height="40" rx="9" fill="#166c55"/><path d="M19 21l10 9 24-20" stroke="white" stroke-width="5" fill="none"/></svg>';
const appBody = '<main><img id="fixture-logo" alt="Uploaded logo" src="./assets/logo.svg"><h1>Field Notes</h1><p id="fixtureMarker">JavaScript is loading</p><form id="taskForm"><label for="taskName">Task name</label><input id="taskName"><button id="addTask">Add task</button></form><p id="notice" role="status"></p><p>Tasks: <span id="count">0</span></p><ul id="taskList"></ul></main>';
function appJs(fixed) { return `const key='upload-review-board';let rows=${fixed ? "JSON.parse(localStorage.getItem(key)||'[]')" : '[]'};const list=document.querySelector('#taskList');function render(){list.replaceChildren(...rows.map(text=>{const li=document.createElement('li');li.textContent=text;return li}));document.querySelector('#count').textContent=String(rows.length)}document.querySelector('#taskForm').onsubmit=e=>{e.preventDefault();const input=document.querySelector('#taskName');if(!input.value.trim()){document.querySelector('#notice').textContent='Enter a task name';return}rows.push(input.value.trim());${fixed ? 'localStorage.setItem(key,JSON.stringify(rows));' : ''}render();input.value='';document.querySelector('#notice').textContent='Task saved'};document.querySelector('#fixtureMarker').textContent='Application JavaScript executed';render();`; }
function html(fixed) { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Field Notes</title><style>${css}</style></head><body>${appBody.replace('./assets/logo.svg', 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'))}<script>${appJs(fixed)}</script></body></html>`; }
const payloads = {
  broken: { name: 'field-notes.html', mimeType: 'text/html', buffer: Buffer.from(html(false)) },
  fixed: { name: 'field-notes.html', mimeType: 'text/html', buffer: Buffer.from(html(true)) },
  zip: { name: 'field-notes-static.zip', mimeType: 'application/zip', buffer: zip([
    ['release/dist/index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Field Notes ZIP</title><link rel="stylesheet" href="/assets/styles.css"></head><body>${appBody}<script src="./assets/app.js"></script></body></html>`],
    ['release/dist/assets/styles.css', css], ['release/dist/assets/app.js', appJs(true)], ['release/dist/assets/logo.svg', svg],
  ]) },
};
const ui = {
  root: page => page.locator('[data-testid="upload-studio"]'),
  requirements: page => page.getByRole('textbox', { name: 'Requirements', exact: true }),
  confirm: page => page.getByRole('checkbox', { name: 'These checks match my requirements.', exact: true }),
  run: page => page.getByRole('button', { name: 'Run acceptance checks', exact: true }),
  cancel: page => page.getByRole('button', { name: 'Cancel checks', exact: true }),
  steps: page => page.locator('[data-testid="upload-step"]'),
};
async function upload(page, payload, revised = false) {
  const previous = await ui.root(page).getAttribute('data-project-fingerprint');
  await page.getByLabel(revised ? 'Upload revised HTML or ZIP' : 'Upload HTML or ZIP', { exact: true }).setInputFiles(payload);
  await page.waitForFunction(before => { const node = document.querySelector('[data-testid="upload-studio"]'); return node?.dataset.projectFingerprint && node.dataset.projectFingerprint !== before && node.dataset.previewReady === 'true' && node.dataset.phase === 'idle'; }, previous);
}
async function plan(page, requirement, task) {
  await ui.requirements(page).fill(requirement);
  const editor = page.getByTestId('plan-technical-editor'); if (!(await editor.evaluate(node => node.open))) await editor.locator('summary').click();
  const steps = [{ action: 'fill', selector: '#taskName', value: task }, { action: 'click', selector: '#addTask' }, { action: 'assertText', selector: '#taskList', value: task }, { action: 'reload' }, { action: 'assertText', selector: '#taskList', value: task }];
  for (let index = 0; index < steps.length; index++) {
    if (index) await page.getByRole('button', { name: 'Add step', exact: true }).click();
    const row = ui.steps(page).nth(index), step = steps[index];
    await row.getByLabel('Action', { exact: true }).selectOption(step.action);
    if (step.selector) await row.getByLabel('CSS selector', { exact: true }).fill(step.selector);
    if (step.value) await row.getByLabel(step.action === 'assertText' ? 'Expected text' : 'Value', { exact: true }).fill(step.value);
  }
  await ui.confirm(page).check();
}
function summarize(run) {
  const copy = { ...run, steps: run.steps.map(({ capture, ...step }) => {
    if (!capture) return step;
    const bytes = Buffer.from(capture.split(',')[1], 'base64');
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    return { ...step, capture: { bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: hash(bytes) } };
  }) };
  report.runs.push(copy);
}
async function run(page, name) {
  await ui.run(page).click(); await ui.cancel(page).waitFor({ state: 'visible' }); await ui.cancel(page).waitFor({ state: 'hidden', timeout: 45000 });
  const transfer = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export evidence report', exact: true }).click();
  const file = path.join(work, name + '.json'); await (await transfer).saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, 'utf8')); assert.equal(exported.format, 'ming-upload-v1'); summarize(exported.currentRun); return exported;
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  // Playwright's serviceWorkers:'block' injects code into every frame that reads
  // navigator.serviceWorker. That getter throws in a correctly opaque sandbox,
  // even for an empty srcdoc. Use a fresh default context; do not inject that probe.
  const context = await browser.newContext({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true });
  context.on('page', page => page.on('pageerror', error => report.errors.push(redact(error.message))));
  await context.route('**/*', route => {
    const request = route.request(), href = request.url();
    if (/^(?:data|blob|about):/.test(href)) return route.continue();
    const url = new URL(href);
    if (url.origin !== origin) { report.outsideRequests.push({ origin: url.origin, method: request.method() }); return route.abort(); }
    if (url.pathname.startsWith('/api/')) report.apiRequests.push({ path: url.pathname, method: request.method() });
    if (!['GET', 'HEAD'].includes(request.method())) {
      if (url.pathname.startsWith('/cdn-cgi/challenge-platform/')) report.platformRequests.push({ method: request.method(), path: '/cdn-cgi/challenge-platform/…', owner: 'hosting-edge' });
      else { report.mutations.push({ method: request.method(), path: url.pathname }); return route.abort(); }
    }
    return route.continue({ headers: { ...request.headers(), 'OAI-Sites-Authorization': `Bearer ${token}` } });
  });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  const response = await page.goto(origin, { waitUntil: 'networkidle' });
  check('The deployed page serves the exact current compiled bundle', response.ok() && (await response.text()).includes(expectedBundle));
  const capabilities = await page.evaluate(async () => { const response = await fetch('/api/capabilities'); if (!response.ok) throw Error('Capabilities unavailable'); return response.json(); });
  report.capabilities = capabilities;
  const uploadCapability = capabilities.uploadedProjects;
  check('Deployed capabilities require human confirmation and keep model drafts behind explicit server-side actions', capabilities.readOnly === true && uploadCapability?.available === true && uploadCapability.path === '/#upload' && uploadCapability.execution === 'isolated-visitor-browser' && uploadCapability.planning === 'human-confirmed' && uploadCapability.captureKind === 'dom-render' && uploadCapability.modelCalls === 'explicit-draft-only' && uploadCapability.planner?.confirmedUserActionRequired === true && uploadCapability.planner?.serverSide === true && uploadCapability.formats?.includes('html') && uploadCapability.formats?.includes('static-zip'));
  check('The original welcome provides a Start entry', await page.getByRole('link', { name: 'Start', exact: true }).isVisible());
  await page.getByRole('link', { name: 'Start', exact: true }).click(); await ui.root(page).waitFor();
  check('Start now opens real project upload', new URL(page.url()).hash === '#upload');
  const task = `Production upload proof ${tag}`, requirement = `After adding ${task}, it appears in the list and remains after a reload.`;
  await upload(page, payloads.broken); await plan(page, requirement, task);
  const before = await run(page, 'broken-html'), baseline = before.currentRun;
  check('A real uploaded HTML file adds the task but fails after reloading', baseline.status === 'failed' && baseline.steps[2].status === 'passed' && baseline.steps[4].status === 'failed');
  check('The failure is bound to this unique task, requirement, source, and execution mode', baseline.requirement === requirement && baseline.steps[2].observed.includes(task) && baseline.projectFingerprint && baseline.planFingerprint && baseline.runner === 'isolated-browser-dom' && baseline.storage === 'isolated-session-adapter');
  check('Actual uploaded failure has a non-empty DOM-render PNG', baseline.captureKind === 'dom-render' && baseline.steps[4].capture?.startsWith('data:image/png;base64,') && baseline.steps[4].capture.length > 1000);
  await upload(page, payloads.fixed, true);
  check('The revised file requires confirmation while preserving the plan', !(await ui.confirm(page).isChecked()) && await ui.requirements(page).inputValue() === requirement && await ui.steps(page).count() === 5);
  await ui.confirm(page).check(); const after = await run(page, 'fixed-html'), fixed = after.currentRun;
  check('The uploaded revision passes the same five actual browser operations', fixed.status === 'passed' && fixed.steps.length === 5 && fixed.steps.every(step => step.status === 'passed'));
  check('Run and source identities change while the entry and acceptance standard remain fixed', baseline.id !== fixed.id && baseline.projectFingerprint !== fixed.projectFingerprint && baseline.entry === fixed.entry && baseline.planFingerprint === fixed.planFingerprint && Date.parse(fixed.startedAt) > Date.parse(baseline.startedAt));
  assert.deepEqual(after.baseline, baseline); check('The original failing baseline is unchanged', true);
  check('The exported comparison verifies a revised source against the same standard', after.comparison.samePlan && after.comparison.sameEntry && after.comparison.sourceChanged && after.comparison.revisedSourcePassed);
  await page.locator('.upload-comparison').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(work, 'production-comparison.png') });

  const zipPage = await context.newPage(); zipPage.setDefaultTimeout(20000);
  await zipPage.goto(origin + '/#upload', { waitUntil: 'networkidle' }); await ui.root(zipPage).waitFor();
  await upload(zipPage, payloads.zip); const frame = zipPage.frameLocator('iframe[sandbox]');
  check('Hosted ZIP upload resolves local JavaScript and root-relative CSS', await frame.locator('#fixtureMarker').innerText() === 'Application JavaScript executed' && await frame.locator('body').evaluate(node => getComputedStyle(node).backgroundColor) === 'rgb(223, 244, 238)');
  check('Hosted ZIP upload decodes its local image', await frame.locator('#fixture-logo').evaluate(async image => { await image.decode().catch(() => {}); return image.complete && image.naturalWidth > 0; }));
  await plan(zipPage, requirement, task); const zipped = (await run(zipPage, 'static-zip')).currentRun;
  check('The uploaded multi-file ZIP actually passes interaction and persistence', zipped.status === 'passed' && zipped.entry === 'release/dist/index.html' && zipped.steps.every(step => step.status === 'passed') && await frame.locator('#taskList').innerText() === task);
  check('ZIP acceptance is a fresh independent run with observed DOM evidence', zipped.id !== fixed.id && zipped.id !== baseline.id && zipped.steps.every(step => step.capture?.startsWith('data:image/png;base64,')));
  check('No application JavaScript exceptions were observed', report.errors.length === 0);
  check('Uploads and acceptance invoke no remote model or server mutation', report.mutations.length === 0 && report.apiRequests.every(request => ['GET', 'HEAD'].includes(request.method) && !/\/(?:generate|run|repair|provider\/test)(?:\/|$)/.test(request.path)));
  check('The browser contacted only the existing private site origin', report.outsideRequests.length === 0);
  report.passed = true;
} catch (error) { report.error = redact(error.stack || error); process.exitCode = 1; }
finally {
  await browser?.close(); report.finishedAt = new Date().toISOString();
  const reportFile = report.passed ? path.join(out, 'production-report.json') : path.join(work, 'failed-report.json');
  if (report.passed) { fs.mkdirSync(out, { recursive: true }); fs.copyFileSync(path.join(work, 'production-comparison.png'), path.join(out, 'production-comparison.png')); }
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, runs: report.runs.length, errors: report.errors.length, report: reportFile }));
}
