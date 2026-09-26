/** Black-box review of user-uploaded HTML/static ZIP acceptance in the compiled UI.
 * All inputs are generated review fixtures. No user files, credentials, Bob, or model APIs.
 * Start the compiled Worker preview first; MING_UPLOAD_REVIEW_URL defaults to port 4192.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { deflateRawSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const base = process.env.MING_UPLOAD_REVIEW_URL || 'http://127.0.0.1:4192';
const origin = new URL(base).origin;
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Review requires a local compiled preview.');
const reviewId = randomUUID(), tag = reviewId.slice(0, 8), stamp = new Date().toISOString().replace(/[:.]/g, '-');
const working = path.join(root, 'runtime', `upload-studio-review-${reviewId}`);
let out = path.join(root, 'docs', 'evidence', 'upload-studio', `${stamp}-${tag}`);
fs.mkdirSync(working, { recursive: true }); fs.mkdirSync(out, { recursive: true });
const report = { reviewId, startedAt: new Date().toISOString(), base, checks: [], runs: [], screenshots: [], pageErrors: [], outsideRequests: [], blockedRequestEvents: [], requests: [], trapHits: [], passed: false };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sentinelKey = 'ming.review.upload-sentinel', sentinelValue = `parent-only-${tag}`;
const cookieName = 'MING_UPLOAD_REVIEW_COOKIE', cookieValue = `cookie-${tag}`;
let browser, context, page, trap, trapBase;

function check(name, passed, detail) {
  report.checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); if (!passed) throw Error(name);
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const local = [], central = []; let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), bytes = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || '');
    const compressed = entry.deflate ? deflateRawSync(bytes) : bytes, method = entry.deflate ? 8 : 0, flags = entry.flags || 0, checksum = crc32(bytes);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(flags, 6); header.writeUInt16LE(method, 8); header.writeUInt32LE(checksum, 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);
    const record = Buffer.alloc(46); record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(flags, 8); record.writeUInt16LE(method, 10); record.writeUInt32LE(checksum, 16); record.writeUInt32LE(compressed.length, 20); record.writeUInt32LE(bytes.length, 24); record.writeUInt16LE(name.length, 28); record.writeUInt32LE(offset, 42);
    central.push(record, name); offset += header.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
const css = `body{margin:0;background:rgb(223,244,238);color:#183831;font:16px system-ui}main{max-width:700px;margin:40px auto;padding:28px;background:white;border:1px solid #bbd7cc;border-radius:16px}h1{font-size:30px}label{display:block;margin:24px 0 10px}input{padding:12px;border:1px solid #a9beb5;border-radius:7px}button{padding:12px 18px;background:#166c55;color:white;border:0;border-radius:7px}li{padding:12px}#fixture-logo{width:72px;height:40px}#fixtureMarker{color:#166c55}`;
function appJs(fixed) { return `const key='upload-review-board';let rows=${fixed ? "JSON.parse(localStorage.getItem(key)||'[]')" : '[]'};const list=document.querySelector('#taskList');function render(){list.replaceChildren(...rows.map(text=>{const li=document.createElement('li');li.textContent=text;return li}));document.querySelector('#count').textContent=String(rows.length)}document.querySelector('#taskForm').onsubmit=e=>{e.preventDefault();const input=document.querySelector('#taskName');if(!input.value.trim()){document.querySelector('#notice').textContent='Enter a task name';return}rows.push(input.value.trim());${fixed ? 'localStorage.setItem(key,JSON.stringify(rows));' : ''}render();input.value='';document.querySelector('#notice').textContent='Task saved'};document.querySelector('#fixtureMarker').textContent='Application JavaScript executed';render();`; }
const appBody = `<main><img id="fixture-logo" alt="Uploaded logo" src="./assets/logo.svg"><h1>Field Notes</h1><p id="fixtureMarker">JavaScript is loading</p><form id="taskForm"><label for="taskName">Task name</label><input id="taskName"><button id="addTask">Add task</button></form><p id="notice" role="status"></p><p>Tasks: <span id="count">0</span></p><ul id="taskList"></ul></main>`;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="40"><rect width="72" height="40" rx="9" fill="#166c55"/><path d="M19 21l10 9 24-20" stroke="white" stroke-width="5" fill="none"/></svg>';
const longEvidence = 'Visible acceptance evidence. '.repeat(45) + 'Full text ends here.';
function html(fixed) { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Field Notes · ${fixed ? 'Fixed' : 'Broken'}</title><style>${css}</style></head><body>${appBody.replace('./assets/logo.svg', 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'))}<script>${appJs(fixed)}</script></body></html>`; }
function fixture(name, bytes) { const file = path.join(working, name); fs.writeFileSync(file, bytes); return file; }
const fixtures = {
  broken: fixture('field-notes-broken.html', html(false)),
  fixed: fixture('field-notes-fixed.html', html(true)),
  boundaries: fixture('html-parser-and-assertions.html', html(true).replace('<html lang="en"><head>', '<html lang="en"><!-- <head> is comment text, not the real head. --><head>').replace('<main>', `<main><p id="long-evidence">${longEvidence}</p><div id="not-a-form-control"></div>`)),
  project: fixture('field-notes-static.zip', zip([
    { name: 'release/dist/index.html', data: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Field Notes · ZIP</title><link rel="stylesheet" href="/assets/styles.css"></head><body>${appBody}<script src="./assets/app.js"></script></body></html>` },
    { name: 'release/dist/assets/styles.css', data: css }, { name: 'release/dist/assets/app.js', data: appJs(true) }, { name: 'release/dist/assets/logo.svg', data: svg },
  ])),
  traversal: fixture('unsafe-path.zip', zip([{ name: '../outside.html', data: html(false) }])),
  duplicate: fixture('duplicate-path.zip', zip([{ name: 'index.html', data: html(false) }, { name: 'INDEX.html', data: html(true) }])),
  encrypted: fixture('encrypted-flag.zip', zip([{ name: 'index.html', data: html(false), flags: 1 }])),
  malformed: fixture('not-a-zip.zip', Buffer.from('This is deliberately not a ZIP archive.')),
  oversized: fixture('oversized.html', Buffer.alloc(10 * 1024 * 1024 + 1, 32)),
  expanded: fixture('expanded-too-large.zip', zip([{ name: 'index.html', data: html(false) }, { name: 'assets/oversized.txt', data: Buffer.alloc(21 * 1024 * 1024, 97), deflate: true }])),
  sourceOnly: fixture('source-only.zip', zip([{ name: 'package.json', data: '{"scripts":{"build":"vite build"}}' }, { name: 'src/App.tsx', data: 'export default function App(){return <h1>Build me first</h1>}' }])),
};
const ui = {
  root: current => current.locator('[data-testid="upload-studio"]'),
  upload: current => current.getByLabel('Upload HTML or ZIP', { exact: true }),
  revised: current => current.getByLabel('Upload revised HTML or ZIP', { exact: true }),
  requirements: current => current.getByRole('textbox', { name: 'Requirements', exact: true }),
  confirm: current => current.getByRole('checkbox', { name: 'I reviewed these requirements and steps for this project.', exact: true }),
  run: current => current.getByRole('button', { name: 'Run acceptance checks', exact: true }),
  cancel: current => current.getByRole('button', { name: 'Cancel checks', exact: true }),
  export: current => current.getByRole('button', { name: 'Export evidence report', exact: true }),
  brief: current => current.getByRole('button', { name: 'Copy repair brief', exact: true }),
  steps: current => current.locator('[data-testid="upload-step"]'),
};
async function screenshot(current, name, fullPage = false) {
  await current.evaluate(() => scrollTo(0, 0)); await current.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const file = path.join(out, `${name}.png`); await current.screenshot({ path: file, fullPage, animations: 'disabled' });
  report.screenshots.push({ file: path.relative(out, file), sha256: hash(fs.readFileSync(file)) });
}
function pngFacts(dataUrl) {
  assert.match(dataUrl, /^data:image\/png;base64,/); const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a'); assert.ok(bytes.length > 1000);
  return { bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: hash(bytes) };
}
function summarizeRun(run) {
  report.runs.push({ ...run, steps: run.steps.map(({ capture, ...step }) => ({ ...step, ...(capture ? { capture: pngFacts(capture) } : {}) })) });
}
function exportedRuns(value) {
  const runs = new Map();
  function visit(node, depth = 0) { if (!node || typeof node !== 'object' || depth > 4) return; if (node.runner === 'isolated-browser-dom' && node.id && Array.isArray(node.steps)) { runs.set(node.id, node); return; } for (const item of Object.values(node)) visit(item, depth + 1); }
  visit(value); return [...runs.values()].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}
async function exportRun(current, name) {
  const transfer = current.waitForEvent('download'); await ui.export(current).click(); const downloaded = await transfer;
  const file = path.join(working, `${name}.json`); await downloaded.saveAs(file); const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  const runs = exportedRuns(exported); assert.ok(runs.length); return { exported, runs, current: exported.currentRun || runs[0] };
}
async function run(current, name) { await ui.run(current).click(); await ui.cancel(current).waitFor({ state: 'visible' }); await ui.cancel(current).waitFor({ state: 'hidden', timeout: 45000 }); return exportRun(current, name); }
async function upload(current, file, revised = false) {
  const before = await ui.root(current).getAttribute('data-project-fingerprint');
  const payload = file === fixtures.broken || file === fixtures.fixed ? { name: 'field-notes.html', mimeType: 'text/html', buffer: fs.readFileSync(file) } : file;
  await (revised || !(await ui.upload(current).count()) ? ui.revised(current) : ui.upload(current)).setInputFiles(payload);
  await current.waitForFunction(previous => {
    const next = document.querySelector('[data-testid="upload-studio"]')?.getAttribute('data-project-fingerprint');
    return next && next !== previous;
  }, before);
  await current.waitForFunction(() => { const node = document.querySelector('[data-testid="upload-studio"]'); return node?.getAttribute('data-preview-ready') === 'true' && node?.getAttribute('data-phase') === 'idle'; });
  await ui.requirements(current).waitFor();
}
async function configurePlan(current, requirement, steps) {
  await ui.requirements(current).fill(requirement);
  while (await ui.steps(current).count() > 1) await ui.steps(current).last().getByRole('button', { name: 'Remove step', exact: true }).click();
  for (let index = 0; index < steps.length; index++) {
    if (index > 0) await current.getByRole('button', { name: 'Add step', exact: true }).click();
    const row = ui.steps(current).nth(index), step = steps[index];
    await row.getByLabel('Action', { exact: true }).selectOption(step.action);
    if (step.action !== 'reload') await row.getByLabel('CSS selector', { exact: true }).fill(step.selector || '');
    if (step.value !== undefined) {
      const valueInput = row.getByLabel(step.action === 'assertText' ? 'Expected text' : step.action === 'assertCount' ? 'Expected count' : step.action === 'assertValue' ? 'Expected value' : 'Value', { exact: true });
      await valueInput.fill(step.value);
    }
  }
}
function observe(current) {
  current.on('page', item => item.on('pageerror', error => report.pageErrors.push({ page: item.url(), error: error.message, stack: error.stack, at: new Date().toISOString(), afterCheck: report.checks.at(-1)?.name })));
  current.on('request', request => { if (/^(?:blob|data|about):/.test(request.url())) return; const url = new URL(request.url()); if (trapBase && url.origin === trapBase) report.blockedRequestEvents.push(request.url()); else if (url.origin !== origin) report.outsideRequests.push(request.url()); else report.requests.push({ path: url.pathname, method: request.method() }); });
}
async function newUploadPage() {
  const current = await context.newPage(); current.setDefaultTimeout(20000);
  await current.goto(base + '/#upload', { waitUntil: 'networkidle' }); await ui.root(current).waitFor(); return current;
}
async function confirm(current) { await ui.confirm(current).check(); }
async function rejected(current, file, pattern, name) {
  await ui.upload(current).setInputFiles(file);
  await current.getByRole('alert').filter({ hasText: pattern }).waitFor();
  check(name, true, await current.getByRole('alert').filter({ hasText: pattern }).innerText());
}
async function parentUntouched(current, label) {
  const state = await current.evaluate(key => ({ value: localStorage.getItem(key), marker: document.documentElement.dataset.reviewParent, text: document.getElementById('review-parent-private')?.textContent, cookie: document.cookie }), sentinelKey);
  check(label, state.value === sentinelValue && state.marker === sentinelValue && state.text === sentinelValue && state.cookie.includes(`${cookieName}=${cookieValue}`));
}
function securityHtml() {
  const js = `const result=document.querySelector('#securityResults');document.querySelector('#probe').onclick=async()=>{const rows=[];try{parent.document.documentElement.dataset.reviewParent='overwritten';rows.push('PARENT_REACHED')}catch{rows.push('PARENT_BLOCKED')}try{const value=document.cookie;rows.push(value.includes('${cookieValue}')?'COOKIE_REACHED':'COOKIE_BLOCKED')}catch{rows.push('COOKIE_BLOCKED')}try{parent.localStorage.setItem('${sentinelKey}','overwritten');rows.push('PARENT_STORAGE_REACHED')}catch{rows.push('PARENT_STORAGE_BLOCKED')}try{localStorage.setItem('${sentinelKey}','child-only');rows.push(localStorage.getItem('${sentinelKey}')==='child-only'?'CHILD_STORAGE_OWN':'CHILD_STORAGE_FAILED')}catch{rows.push('CHILD_STORAGE_UNAVAILABLE')}try{top.location.href='${trapBase}/top-navigation';rows.push('TOP_REQUESTED')}catch{rows.push('TOP_BLOCKED')}try{await fetch('${trapBase}/fetch');rows.push('NETWORK_REACHED')}catch{rows.push('NETWORK_BLOCKED')}const image=new Image();image.src='${trapBase}/image';document.body.append(image);result.textContent=rows.join(' | ')};document.querySelector('#selfNavigate').onclick=()=>{location.href='${trapBase}/self-navigation'};`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body><main><h1>Sandbox boundary review fixture</h1><p>This file intentionally tests isolation using synthetic values.</p><button id="probe">Probe isolation</button><p id="securityResults">Not checked</p><button id="selfNavigate">Attempt frame navigation</button></main><script>${js}</script></body></html>`;
}
try {
  check('Compiled upload preview is available', (await fetch(base, { signal: AbortSignal.timeout(5000) })).ok);
  trap = http.createServer((req, res) => { report.trapHits.push({ url: req.url, method: req.method }); res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Content-Type', 'text/plain'); res.end('The request reached the review trap.'); });
  await new Promise(resolve => trap.listen(0, '127.0.0.1', resolve)); trapBase = `http://127.0.0.1:${trap.address().port}`;
  browser = await chromium.launch({ headless: true }); context = await browser.newContext({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true }); observe(context);
  await context.addCookies([{ name: cookieName, value: cookieValue, url: base, sameSite: 'Strict' }]);
  page = await newUploadPage();
  await page.evaluate(({ key, value }) => { localStorage.setItem(key, value); document.documentElement.dataset.reviewParent = value; const marker = document.createElement('span'); marker.id = 'review-parent-private'; marker.textContent = value; marker.hidden = true; document.body.append(marker); }, { key: sentinelKey, value: sentinelValue });
  check('Upload studio mounts its real project input', await ui.upload(page).count() === 1 && new URL(page.url()).hash === '#upload');
  await upload(page, fixtures.broken);
  check('A user-selected self-contained HTML file opens for inspection', Boolean(await ui.root(page).getAttribute('data-project-fingerprint')));
  const taskName = `Uploaded proof ${tag}`;
  const requirement = `After adding ${taskName}, it appears in the list and remains after a reload.`;
  await page.getByLabel('Import requirements file', { exact: true }).setInputFiles({ name: 'acceptance.md', mimeType: 'text/markdown', buffer: Buffer.from(requirement) });
  check('Requirements file import uses the supplied Markdown text', await ui.requirements(page).inputValue() === requirement);
  const persistencePlan = [
    { action: 'fill', selector: '#taskName', value: taskName },
    { action: 'click', selector: '#addTask' },
    { action: 'assertText', selector: '#taskList', value: taskName },
    { action: 'reload' },
    { action: 'assertText', selector: '#taskList', value: taskName },
  ];
  await configurePlan(page, requirement, persistencePlan);
  check('Execution requires explicit review of the uploaded project and manual plan', await ui.run(page).isDisabled());
  await confirm(page); check('Human confirmation enables the configured check', await ui.run(page).isEnabled());
  await ui.requirements(page).fill(requirement + ' This wording changed.');
  check('Changing the requirements invalidates confirmation', !(await ui.confirm(page).isChecked()) && await ui.run(page).isDisabled());
  await ui.requirements(page).fill(requirement); await confirm(page);
  const first = await run(page, 'broken-html'); const broken = first.current; summarizeRun(broken);
  check('Actual uploaded HTML adds the task, then fails its real persistence check', broken.status === 'failed' && broken.steps[2].status === 'passed' && broken.steps[4].status === 'failed');
  check('Run export binds the original requirement, source, entry, and plan', broken.requirement === requirement && broken.entry.endsWith('.html') && Boolean(broken.projectFingerprint) && Boolean(broken.planFingerprint) && broken.runner === 'isolated-browser-dom' && broken.storage === 'isolated-session-adapter');
  check('Failure evidence includes a non-empty DOM-render PNG', broken.captureKind === 'dom-render' && Boolean(broken.steps[4].capture) && pngFacts(broken.steps[4].capture).width >= 300);
  check('The failed observation reports the uploaded task requirement', JSON.stringify(broken.steps[4]).includes(taskName));
  const brokenBytes = JSON.stringify(broken); await screenshot(page, '01-uploaded-html-failure', true);
  await ui.brief(page).click(); const brief = await page.getByRole('textbox', { name: 'Repair brief', exact: true }).inputValue(); fs.writeFileSync(path.join(working, 'repair-brief.md'), brief);
  check('Repair brief exports this actual failure and its unchanged standard', brief.includes(broken.id) && brief.includes(broken.planFingerprint) && brief.includes(taskName));
  await parentUntouched(page, 'Uploaded application cannot overwrite unrelated parent storage or markup');

  await upload(page, fixtures.fixed, true);
  check('Uploading revised code preserves the editable requirement and same plan', await ui.requirements(page).inputValue() === requirement && await ui.steps(page).count() === persistencePlan.length);
  await confirm(page); const followup = await run(page, 'fixed-html'); const fixed = followup.current; summarizeRun(fixed);
  check('Uploaded fixed source passes the same real operations after reloading', fixed.status === 'passed' && fixed.steps.every(step => step.status === 'passed'));
  check('Fixed upload has a new source and run but the identical acceptance plan', fixed.projectFingerprint !== broken.projectFingerprint && fixed.id !== broken.id && fixed.planFingerprint === broken.planFingerprint && Date.parse(fixed.startedAt) > Date.parse(broken.startedAt));
  check('Original failing run is unchanged in the comparison export', JSON.stringify(followup.runs.find(item => item.id === broken.id)) === brokenBytes);
  check('Revision comparison requires the same entry and plan plus changed source and a fresh passing result', followup.exported.comparison?.samePlan === true && followup.exported.comparison?.sameEntry === true && followup.exported.comparison?.sourceChanged === true && followup.exported.comparison?.revisedSourcePassed === true);
  await screenshot(page, '02-uploaded-revision-passed', true);

  const last = ui.steps(page).last(); await last.getByLabel('Expected text', { exact: true }).fill('This exact phrase never appears');
  check('Changing a check also invalidates prior human confirmation', !(await ui.confirm(page).isChecked()) && await ui.run(page).isDisabled());
  await confirm(page); const mismatch = await run(page, 'non-matching-expectation'); summarizeRun(mismatch.current);
  check('A non-matching user expectation fails even against the fixed app', mismatch.current.status === 'failed' && mismatch.current.steps[4].status === 'failed' && mismatch.current.planFingerprint !== fixed.planFingerprint);
  await last.getByLabel('Expected text', { exact: true }).fill(taskName); await confirm(page);
  await ui.run(page).click(); await ui.cancel(page).waitFor({ state: 'visible' }); await ui.cancel(page).click(); await ui.cancel(page).waitFor({ state: 'hidden' });
  const cancelled = await exportRun(page, 'cancelled'); summarizeRun(cancelled.current);
  check('Cancellation records incomplete checks without claiming a pass', cancelled.current.status === 'cancelled' && cancelled.current.steps.some(step => step.status === 'unchecked'));
  const retried = await run(page, 'retried'); summarizeRun(retried.current);
  check('Retry runs a fresh acceptance after cancellation', retried.current.status === 'passed' && retried.current.id !== cancelled.current.id);

  const zipped = await newUploadPage(); await upload(zipped, fixtures.project);
  const frame = zipped.frameLocator('iframe[sandbox]').first();
  await frame.locator('#fixtureMarker').filter({ hasText: 'Application JavaScript executed' }).waitFor();
  check('Uploaded ZIP JavaScript really runs inside the preview', await frame.locator('#fixtureMarker').innerText() === 'Application JavaScript executed');
  check('Nested ZIP root-relative CSS is loaded', await frame.locator('body').evaluate(element => getComputedStyle(element).backgroundColor) === 'rgb(223, 244, 238)');
  check('Uploaded ZIP image asset is resolved and decoded', await frame.locator('#fixture-logo').evaluate(async image => { await image.decode().catch(() => {}); return image.complete && image.naturalWidth > 0; }));
  await configurePlan(zipped, requirement, persistencePlan); await confirm(zipped); const zipRun = await run(zipped, 'static-zip'); summarizeRun(zipRun.current);
  check('A real multi-file static ZIP passes interaction and reload checks', zipRun.current.status === 'passed' && zipRun.current.entry === 'release/dist/index.html');
  await screenshot(zipped, '03-static-zip-accepted', true);
  await zipped.setViewportSize({ width: 390, height: 844 });
  check('390px upload workflow has no horizontal overflow', await zipped.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  check('Uploaded ZIP application remains present after the mobile resize', await frame.locator('#taskList').innerText() === taskName && await frame.locator('#fixtureMarker').innerText() === 'Application JavaScript executed');
  await screenshot(zipped, '04-upload-studio-mobile', true); await zipped.close();

  const boundaries = await newUploadPage(); await upload(boundaries, fixtures.boundaries);
  check('HTML with a head-like comment still initializes the isolated project', await boundaries.frameLocator('iframe[sandbox]').locator('#fixtureMarker').innerText() === 'Application JavaScript executed');
  await configurePlan(boundaries, 'All expected visible text must be checked even beyond the observation display limit.', [{ action: 'assertText', selector: '#long-evidence', value: longEvidence }]); await confirm(boundaries);
  const longText = await run(boundaries, 'long-text-assertion'); summarizeRun(longText.current);
  check('Visible text assertions compare the full expectation beyond 1000 characters', longEvidence.length > 1000 && longText.current.status === 'passed');
  await configurePlan(boundaries, 'Value assertions must target form controls.', [{ action: 'assertValue', selector: '#not-a-form-control', value: '' }]); await confirm(boundaries);
  const wrongTarget = await run(boundaries, 'non-form-value-assertion'); summarizeRun(wrongTarget.current);
  check('An empty value assertion against a non-form element produces an explicit error', wrongTarget.current.status === 'error' && /input|textarea|select|form/i.test(wrongTarget.current.error || ''));
  await boundaries.close();

  const validation = await newUploadPage();
  await rejected(validation, fixtures.traversal, /path|traversal|unsafe|relative/i, 'Archive path traversal is rejected before execution');
  await rejected(validation, fixtures.duplicate, /duplicate|same path/i, 'Duplicate archive paths including case collisions are rejected');
  await rejected(validation, fixtures.encrypted, /encrypt/i, 'Encrypted archive entries are rejected explicitly');
  await rejected(validation, fixtures.malformed, /ZIP|archive|invalid/i, 'Malformed archives produce a readable import error');
  await rejected(validation, fixtures.oversized, /10|large|limit|size/i, 'Oversized input is rejected without mounting an application');
  await rejected(validation, fixtures.expanded, /20|unpack|expand|large|limit|size/i, 'Compressed content exceeding the unpacked size limit is rejected');
  await rejected(validation, fixtures.sourceOnly, /build|dist|compiled|source/i, 'Source-only project uploads explain that a built static output is required');
  check('Rejected files never become the active project', !(await ui.root(validation).getAttribute('data-project-fingerprint')));
  await validation.close();

  const security = fixture('sandbox-boundary-review.html', securityHtml()); await upload(page, security);
  const securityPlan = [
    { action: 'click', selector: '#probe' },
    { action: 'assertText', selector: '#securityResults', value: 'PARENT_BLOCKED' },
    { action: 'assertText', selector: '#securityResults', value: 'COOKIE_BLOCKED' },
    { action: 'assertText', selector: '#securityResults', value: 'PARENT_STORAGE_BLOCKED' },
    { action: 'assertText', selector: '#securityResults', value: 'CHILD_STORAGE_OWN' },
    { action: 'assertText', selector: '#securityResults', value: 'NETWORK_BLOCKED' },
  ];
  await configurePlan(page, 'Synthetic boundary fixture cannot access its parent, cookies, or the network.', securityPlan); await confirm(page);
  const isolated = await run(page, 'sandbox-isolation'); summarizeRun(isolated.current);
  check('Opaque sandbox blocks parent DOM, cookies, parent storage, and network access while supporting isolated app storage', isolated.current.status === 'passed');
  await parentUntouched(page, 'Parent DOM, cookie, and local storage remain unchanged after explicit hostile attempts');
  check('Uploaded top-navigation attempt cannot leave the Ming route', new URL(page.url()).origin === origin && new URL(page.url()).hash === '#upload');
  await configurePlan(page, 'A user-uploaded application must not navigate its frame to the network.', [{ action: 'click', selector: '#selfNavigate' }, { action: 'assertText', selector: '#securityResults', value: 'Not checked' }]); await confirm(page);
  const navigation = await run(page, 'sandbox-navigation'); summarizeRun(navigation.current); await delay(300);
  check('Fetch, image, top-navigation and frame-navigation attempts never reach the actual HTTP trap', report.trapHits.length === 0, report.trapHits);
  check('Frame-navigation attempts preserve the host route and parent data', new URL(page.url()).hash === '#upload' && await page.evaluate(key => localStorage.getItem(key), sentinelKey) === sentinelValue);
  check('Uploads and checks make no server mutation or model request', report.requests.every(item => item.method === 'GET') && !report.requests.some(item => /\/api\/(?:generate|provider\/test|run|repair)/.test(item.path)));
  check('No unexpected requests leave the compiled local preview', report.outsideRequests.length === 0, report.outsideRequests);
  check('No uncaught application or parent JavaScript errors', report.pageErrors.length === 0, report.pageErrors);
  report.passed = true;
} catch (error) {
  report.error = String(error.stack || error); console.error(report.error); process.exitCode = 1;
  if (page && !page.isClosed()) { fs.writeFileSync(path.join(working, 'stopped-dom.txt'), await page.locator('body').innerText().catch(() => '')); await screenshot(page, 'stopped-state').catch(() => {}); }
} finally {
  report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  if (!report.passed) { const failed = path.resolve(working, 'incomplete-review'); assert.ok(failed.startsWith(path.resolve(root, 'runtime') + path.sep)); assert.ok(path.resolve(out).startsWith(path.resolve(root, 'docs/evidence/upload-studio') + path.sep)); fs.renameSync(out, failed); out = failed; }
  fs.writeFileSync(path.join(root, 'runtime', 'upload-studio-review-latest.json'), JSON.stringify({ out, working, report: path.join(out, 'report.json') }, null, 2));
  await browser?.close(); if (trap) await new Promise(resolve => trap.close(resolve)); console.log('REPORT ' + path.join(out, 'report.json'));
}
