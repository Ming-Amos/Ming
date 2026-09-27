/** Independent screenshot and real-browser review of the inner dark theme.
 * MING_DARK_REVIEW_MODE=before captures baseline only; default after checks the compiled change.
 * Model status is explicitly unavailable in this fixture. No POST/provider request is allowed. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)), { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const base = process.env.MING_DARK_REVIEW_URL || 'http://127.0.0.1:4001', origin = new URL(base).origin, mode = process.env.MING_DARK_REVIEW_MODE || 'after';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname)); assert.ok(['before', 'after'].includes(mode));
const id = randomUUID(), stamp = new Date().toISOString().replace(/[:.]/g, '-'), out = path.join(root, 'docs/evidence/dark-inner-ui', `${stamp}-${mode}-${id.slice(0, 8)}`);
fs.mkdirSync(out, { recursive: true });
const references = { homepage: 'docs/evidence/welcome-inspection/2026-09-26T19-40-23-800Z-6d10f73d/02-desktop-return-for-fix-final.png', previousUI: 'C:/Users/han20/AppData/Local/Temp/codex-clipboard-8eafab62-801c-44f2-801e-53908cc93eb1.png' };
const report = { id, mode, startedAt: new Date().toISOString(), base, references, passed: false, checks: [], screenshots: [], metrics: {}, runs: [], errors: [], blockedRequests: [], requests: [], browser: 'Standalone Playwright fallback: in-app Browser bootstrap failed because its browser-service.mjs is missing.', scope: 'Intentional dark-theme adaptation; normal readable controls, small pixel accents, manual five-step real browser acceptance. No paid generation, Bob, or external services.' };
const check = (name, pass, detail) => { report.checks.push({ name, passed: Boolean(pass), ...(detail === undefined ? {} : { detail }) }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); assert.ok(pass, name); };
const button = (page, name) => page.getByRole('button', { name, exact: true });
const fixture = fixed => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Field Notes</title><style>body{margin:0;padding:32px;background:rgb(248,249,251);color:#19362f;font:16px system-ui}main{max-width:620px;background:white;border:1px solid #d6e2dd;border-radius:12px;padding:26px}label{display:block;margin:20px 0 8px}input{padding:12px;border:1px solid #b4c8bf;border-radius:6px}button{padding:12px 18px;background:#176b52;border:0;border-radius:6px;color:white}li{padding:10px}</style></head><body><main><h1>Field Notes</h1><p>A light application under inspection.</p><form id="taskForm"><label for="taskName">Task name</label><input id="taskName"><button id="addTask">Add task</button></form><ul id="taskList"></ul></main><script>const key='ming-dark-review';let rows=${fixed ? "JSON.parse(localStorage.getItem(key)||'[]')" : '[]'};function render(){document.querySelector('#taskList').replaceChildren(...rows.map(text=>{const li=document.createElement('li');li.textContent=text;return li}))}document.querySelector('#taskForm').onsubmit=e=>{e.preventDefault();rows.push(document.querySelector('#taskName').value);${fixed ? 'localStorage.setItem(key,JSON.stringify(rows));' : ''}render()};render();</script></body></html>`;
async function shot(page, name) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const file = `${name}.png`; await page.screenshot({ path: path.join(out, file), animations: 'disabled' }); report.screenshots.push(file); }
async function metrics(page, key) {
  const value = await page.evaluate(() => {
    const visible = node => node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && !node.closest('details:not([open])');
    const sample = selector => [...document.querySelectorAll(selector)].filter(visible).slice(0, 25).map(node => { const css = getComputedStyle(node), box = node.getBoundingClientRect(); return { tag: node.tagName, text: (node.getAttribute('aria-label') || node.textContent || '').trim().slice(0, 65), background: css.backgroundColor, color: css.color, border: css.borderColor, font: css.fontFamily, size: css.fontSize, width: Math.round(box.width) }; });
    return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth, bodyBackground: getComputedStyle(document.body).backgroundColor, cards: sample('.upload-card,.trial-card,.card,.workspace-card,.modal'), controls: sample('input,textarea,select,button,a'), headings: sample('h1,h2'), visibleTechnicalFields: [...document.querySelectorAll('[aria-label="CSS selector"]')].filter(visible).length };
  }); report.metrics[key] = value;
  check(`${key} has no horizontal overflow`, value.documentWidth <= value.viewport.width + 1);
  if (mode === 'after') { const channels = value.bodyBackground.match(/[\d.]+/g)?.slice(0, 3).map(Number) || []; check(`${key} uses a dark application canvas`, channels.length === 3 && Math.max(...channels) < 65, value.bodyBackground); }
}
async function upload(page, fixed) {
  const previous = await page.getByTestId('upload-studio').getAttribute('data-project-fingerprint');
  await page.getByLabel(previous ? 'Upload revised HTML or ZIP' : 'Upload HTML or ZIP', { exact: true }).setInputFiles({ name: 'field-notes.html', mimeType: 'text/html', buffer: Buffer.from(fixture(fixed)) });
  await page.waitForFunction(before => { const node = document.querySelector('[data-testid="upload-studio"]'); return node?.dataset.previewReady === 'true' && node.dataset.projectFingerprint && node.dataset.projectFingerprint !== before && node.dataset.phase === 'idle'; }, previous);
}
async function buildManualPlan(page) {
  const task = `Dark theme proof ${id.slice(0, 8)}`;
  await page.getByRole('textbox', { name: 'Requirements', exact: true }).fill(`Add ${task}. The task appears in the list and remains after reloading.`);
  const editor = page.getByTestId('plan-technical-editor'); await editor.locator('summary').click();
  const plan = [{ action: 'fill', selector: '#taskName', value: task }, { action: 'click', selector: '#addTask' }, { action: 'assertText', selector: '#taskList', value: task }, { action: 'reload' }, { action: 'assertText', selector: '#taskList', value: task }];
  for (const [index, item] of plan.entries()) { if (index) await button(page, 'Add step').click(); const row = page.getByTestId('upload-step').nth(index); await row.getByLabel('Action', { exact: true }).selectOption(item.action); if (item.selector) await row.getByLabel('CSS selector', { exact: true }).fill(item.selector); if (item.value) await row.getByLabel(item.action === 'assertText' ? 'Expected text' : 'Value', { exact: true }).fill(item.value); }
  await editor.locator('summary').click(); return task;
}
async function run(page, label) {
  await page.getByRole('checkbox', { name: 'These checks match my requirements.', exact: true }).check(); await button(page, 'Run acceptance checks').click(); await button(page, 'Cancel checks').waitFor(); await button(page, 'Cancel checks').waitFor({ state: 'hidden', timeout: 60000 });
  const transfer = page.waitForEvent('download'); await button(page, 'Export evidence report').click(); const file = `${label}.json`; await (await transfer).saveAs(path.join(out, file)); const exported = JSON.parse(fs.readFileSync(path.join(out, file), 'utf8'));
  report.runs.push({ export: file, id: exported.currentRun.id, status: exported.currentRun.status, planFingerprint: exported.currentRun.planFingerprint, projectFingerprint: exported.currentRun.projectFingerprint, steps: exported.currentRun.steps.map(({ capture, ...step }) => ({ ...step, ...(capture ? { capture: { bytes: Buffer.from(capture.split(',')[1], 'base64').length, sha256: createHash('sha256').update(capture).digest('hex') } } : {}) })) }); return exported;
}
let browser, page;
try {
  browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true, reducedMotion: 'reduce' });
  context.on('page', current => current.on('pageerror', error => report.errors.push(error.message)));
  await context.route('**/*', route => { const request = route.request(), href = request.url(); if (/^(?:blob|data|about):/.test(href)) return route.continue(); const url = new URL(href); report.requests.push({ origin: url.origin, path: url.pathname, method: request.method() }); if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method())) { report.blockedRequests.push({ origin: url.origin, path: url.pathname, method: request.method() }); return route.abort(); } if (url.pathname === '/api/upload/planner/status') return route.fulfill({ json: { ok: true, configured: false, providerLabel: 'Doubao', modelId: null } }); return route.continue(); });
  page = await context.newPage(); page.setDefaultTimeout(20000); const response = await page.goto(base + '/#upload', { waitUntil: 'networkidle' });
  const html = await response.text(); report.bundle = html.match(/\/assets\/[^"']+\.js/)?.[0];
  if (mode === 'after') { const expected = fs.readFileSync(path.join(root, 'apps/web/dist/index.html'), 'utf8').match(/\/assets\/[^"']+\.js/)?.[0]; check('Final review serves the exact current compiled application', response.ok() && report.bundle === expected); }
  for (const [route, selector] of [['upload', '[data-testid="upload-studio"]'], ['trial', '[data-testid="live-trial"]'], ['studio', '.app-shell']]) {
    await page.goto(base + '/#' + route, { waitUntil: 'networkidle' }); await page.locator(selector).waitFor(); await page.evaluate(() => scrollTo(0, 0)); await shot(page, `01-${route}-desktop`); await metrics(page, `${route}-desktop`);
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => scrollTo(0, 0)); await shot(page, `02-${route}-mobile`); await metrics(page, `${route}-mobile`); await page.setViewportSize({ width: 1484, height: 1060 });
  }
  if (mode === 'after') {
    await page.goto(base + '/#upload', { waitUntil: 'networkidle' }); await upload(page, false); const task = await buildManualPlan(page);
    const editor = page.getByTestId('plan-technical-editor'); check('The manually defined checklist keeps technical fields collapsed', !(await editor.evaluate(node => node.open)) && !(await page.getByTestId('upload-step').first().getByLabel('CSS selector', { exact: true }).isVisible()));
    check('The uploaded application retains its own light background', await page.frameLocator('iframe[sandbox]').locator('body').evaluate(node => getComputedStyle(node).backgroundColor) === 'rgb(248, 249, 251)');
    await page.getByTestId('acceptance-checklist').scrollIntoViewIfNeeded(); await shot(page, '03-manual-checklist-desktop'); await metrics(page, 'manual-checklist-desktop');
    await editor.locator('summary').focus(); await editor.locator('summary').press('Enter'); await shot(page, '03b-technical-editor-focus'); check('The technical editor remains keyboard operable', await editor.evaluate(node => node.open)); await editor.locator('summary').press('Enter');
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByTestId('acceptance-checklist').scrollIntoViewIfNeeded(); await shot(page, '04-manual-checklist-mobile'); await metrics(page, 'manual-checklist-mobile'); await page.setViewportSize({ width: 1484, height: 1060 });
    const before = await run(page, 'manual-failure'); check('Real manual checks create the task and expose the reload defect', before.currentRun.status === 'failed' && before.currentRun.steps[2].status === 'passed' && before.currentRun.steps[4].status === 'failed' && before.currentRun.steps[2].observed.includes(task));
    await page.locator('.upload-result').last().click(); await page.locator('.upload-evidence').evaluate(node => scrollTo(0, node.getBoundingClientRect().top + scrollY - 24)); await shot(page, '05-real-failure-desktop');
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('.upload-observation').evaluate(node => scrollTo(0, node.getBoundingClientRect().top + scrollY - 24)); await shot(page, '05b-real-failure-mobile'); await metrics(page, 'real-failure-mobile'); await page.setViewportSize({ width: 1484, height: 1060 });
    await upload(page, true); const after = await run(page, 'manual-fixed'); check('The revised app passes the same actual five-step plan', after.currentRun.status === 'passed' && after.currentRun.steps.length === 5 && after.currentRun.steps.every(step => step.status === 'passed') && before.currentRun.planFingerprint === after.currentRun.planFingerprint);
    assert.deepEqual(after.baseline, before.currentRun); check('The original failed baseline remains immutable', true); await page.locator('.upload-result').last().click(); await page.locator('.upload-comparison').scrollIntoViewIfNeeded(); await shot(page, '06-real-comparison-desktop');
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('.upload-comparison').evaluate(node => scrollTo(0, node.getBoundingClientRect().top + scrollY - 24)); await shot(page, '06b-real-comparison-mobile'); await metrics(page, 'real-comparison-mobile'); await page.setViewportSize({ width: 1484, height: 1060 });
    const expand = button(page, 'Expand DOM snapshot'); if (await expand.count()) { await expand.first().click(); await page.locator('dialog[open]').waitFor(); await shot(page, '07-capture-dialog-desktop'); await page.keyboard.press('Escape'); }
    await page.goto(base + '/#studio', { waitUntil: 'networkidle' }); await page.locator('.app-shell').waitFor();
    await page.keyboard.press('Control+k'); await page.getByRole('dialog', { name: 'Jump to anything', exact: true }).waitFor(); await shot(page, '08-studio-command-dialog'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^(Connect model|Model connected)$/ }).click(); await page.getByRole('dialog').waitFor(); await shot(page, '09-studio-model-dialog'); await page.setViewportSize({ width: 390, height: 844 }); await shot(page, '10-studio-model-dialog-mobile'); await metrics(page, 'studio-model-dialog-mobile'); await page.keyboard.press('Escape'); await page.setViewportSize({ width: 1484, height: 1060 });
    await page.goto(base + '/#upload', { waitUntil: 'networkidle' }); await page.getByRole('link', { name: 'Cover', exact: true }).click(); check('Own-project checks retain a working Cover link', new URL(page.url()).hash === '' || new URL(page.url()).hash === '#');
    await page.goto(base, { waitUntil: 'networkidle' }); await page.getByRole('link', { name: 'Start', exact: true }).click(); check('The original Start entry still opens own-project checks', new URL(page.url()).hash === '#upload');
    await page.goto(base, { waitUntil: 'networkidle' }); await page.getByRole('link', { name: 'Try a guided sample', exact: true }).click(); check('The original guided sample entry still opens the live trial', new URL(page.url()).hash === '#trial');
    await page.getByRole('link', { name: 'Cover', exact: true }).click(); check('The live trial retains a working Cover link', new URL(page.url()).hash === '' || new URL(page.url()).hash === '#');
    const comparison = await context.newPage(); await comparison.setViewportSize({ width: 1560, height: 1300 });
    const panels = [['Homepage reference', path.join(root, references.homepage)], ['Previous light inner page', references.previousUI], ['Dark own-project checks', path.join(out, '01-upload-desktop.png')], ['Dark live sample', path.join(out, '01-trial-desktop.png')], ['Dark Evidence Studio', path.join(out, '01-studio-desktop.png')], ['Real checks — original light app', path.join(out, '03-manual-checklist-desktop.png')]];
    await comparison.setContent(`<html><body style="margin:0;padding:16px;background:#171923;color:#fff;font:16px Arial"><h1 style="font-size:22px;margin:0 0 14px">Source and implementation — intentional theme adaptation</h1><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">${panels.map(([title,file]) => `<figure style="margin:0"><figcaption style="margin-bottom:8px">${title}</figcaption><img style="display:block;width:100%;height:570px;object-fit:contain;object-position:top;border:1px solid #445" src="data:image/png;base64,${fs.readFileSync(file).toString('base64')}"></figure>`).join('')}</div></body></html>`);
    await comparison.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode()))); await shot(comparison, '11-source-and-implementation-contact-sheet'); await comparison.close();
  }
  check('No uncaught browser exceptions occurred', report.errors.length === 0, report.errors); check('No external or mutation/model requests were attempted', report.blockedRequests.length === 0, report.blockedRequests); report.passed = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; if (page && !page.isClosed()) { await shot(page, 'stopped-state').catch(() => {}); fs.writeFileSync(path.join(out, 'stopped-dom.txt'), await page.locator('body').innerText().catch(() => '')); } }
finally { await browser?.close(); report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ mode, passed: report.passed, checks: report.checks.length, report: path.join(out, 'report.json') })); }
