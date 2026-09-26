/** Independent QA of the actual compiled English Evidence Studio and immutable judge bundle.
 * Pass --evidence-only to check published responses and PNGs without repeating browser QA.
 * Recorded acceptance responses are exact; the three hosted-mode metadata routes follow
 * the Worker's explicit read-only policy instead of claiming live local capabilities.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const require = createRequire(new URL('../packages/runner/package.json', import.meta.url));
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'runtime', `english-studio-${randomUUID()}`);
fs.mkdirSync(out, { recursive: true });
const evidenceRoot = path.join(root, 'docs/judge-evidence');
const manifest = JSON.parse(fs.readFileSync(path.join(evidenceRoot, 'manifest.json'), 'utf8'));
const bundle = JSON.parse(fs.readFileSync(path.join(evidenceRoot, 'api-responses.json'), 'utf8'));
const port = Number(process.env.MING_PREVIEW_PORT || 4492);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port');
const base = `http://127.0.0.1:${port}`;
const evidenceOnly = process.argv.includes('--evidence-only');
const results = [], errors = [], requests = [], failedResources = [], outsideRequests = [], captures = [];
const hash = data => createHash('sha256').update(data).digest('hex');
function check(name, passed, detail) {
  results.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) throw new Error(name);
}
const compare = (name, actual, expected) => { assert.deepEqual(actual, expected, name); check(name, true); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function capture(page, name, fullPage = false) {
  const file = path.join(out, `${name}.png`); await page.screenshot({ path: file, fullPage, animations: 'disabled' }); captures.push(file);
}
async function verifyEnglish(page, where) {
  const text = await page.locator('body').innerText();
  check(`${where} contains English product and evidence copy`, !/\p{Script=Han}/u.test(text));
}
async function waitForImages(page, selector) {
  await page.waitForFunction(selector => [...document.querySelectorAll(selector)].length > 0 && [...document.querySelectorAll(selector)].every(image => image.complete && image.naturalWidth > 0), selector);
}
async function range(page, locator, value) {
  await locator.evaluate((element, next) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, String(next));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await delay(70);
}
let preview, browser, log;
try {
  let occupied = false;
  try { await fetch(base + '/api/capabilities', { signal: AbortSignal.timeout(300) }); occupied = true; } catch {}
  if (occupied) throw new Error('Review port already occupied; refusing to reuse it');
  preview = spawn(process.execPath, [path.join(root, 'scripts/public-demo/preview.mjs')], {
    cwd: root, env: { ...process.env, MING_PREVIEW_PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  log = fs.createWriteStream(path.join(out, 'preview.log'));
  preview.stdout.pipe(log); preview.stderr.pipe(log);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Owned preview did not start')), 12000);
    preview.once('exit', code => { clearTimeout(timeout); reject(new Error(`Owned preview exited: ${code}`)); });
    preview.once('error', error => { clearTimeout(timeout); reject(error); });
    preview.stdout.on('data', data => { if (String(data).includes(`127.0.0.1:${port}`)) { clearTimeout(timeout); resolve(); } });
  });
  let checkedFiles = 0;
  for (const [relative, expected] of Object.entries(manifest.files)) {
    assert.equal(hash(fs.readFileSync(path.join(evidenceRoot, relative))), expected, relative); checkedFiles++;
  }
  check('All 34 judge evidence files retain their exact manifest hashes', checkedFiles === 34);
  compare('Compiled history matches the English reviewed bundle', await (await fetch(base + '/api/history')).json(), bundle.responses['/api/history']);
  const metadataPolicies = {
    '/api/capabilities': { ok: true, readOnly: true, sourceBinding: 'self-contained-html-snapshot', demoMode: 'recorded-evidence', liveTrial: { available: true, path: '/#trial', execution: 'visitor-browser', scope: 'bundled-shipboard', captureKind: 'dom-render', modelCalls: false } },
    '/api/provider/status': { ok: true, status: { configured: false, providerLabel: 'Recorded evidence demo — model calls disabled', baseUrl: '(disabled)', modelId: '(disabled)', missingFields: ['LOCAL_MODEL_CONFIGURATION_REQUIRED'] } },
    '/api/projects': { ok: true, projects: [], readOnly: true },
  };
  const servedResponses = [], servedRecorded = [], servedMetadata = [], responseMismatches = [];
  for (const [route, expected] of Object.entries(bundle.responses)) {
    servedResponses.push(route);
    try {
      const response = await fetch(base + route, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      assert.equal(response.status, 200, route);
      const actual = await response.json();
      if (Object.hasOwn(metadataPolicies, route)) {
        assert.deepEqual(actual, metadataPolicies[route], `Read-only hosted metadata policy ${route}`);
        servedMetadata.push(route);
      } else {
        assert.deepEqual(actual, expected, `Recorded acceptance response ${route}`);
        servedRecorded.push(route);
      }
    } catch (error) { responseMismatches.push({ route, message: error.message }); }
  }
  const servedScreenshots = [];
  for (const [relative, expected] of Object.entries(manifest.files).filter(([name]) => name.startsWith('runtime/screenshots/'))) {
    const route = '/api/screenshots/' + path.basename(relative);
    const response = await fetch(base + route, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    assert.equal(response.status, 200, route);
    assert.ok(response.headers.get('content-type')?.startsWith('image/png'), route);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), expected, `Published PNG ${route}`);
    servedScreenshots.push(route);
  }
  check('All 12 served PNGs match their original evidence hashes exactly', servedScreenshots.length === 12, servedScreenshots);
  check('All 17 recorded acceptance API responses match the reviewed English bundle exactly', servedRecorded.length === 17, { routes: servedRecorded, responseMismatches: responseMismatches.filter(item => !Object.hasOwn(metadataPolicies, item.route)) });
  check('All 3 hosted metadata routes enforce read-only, no model connection and no private projects', servedMetadata.length === 3 && servedResponses.length === 20 && responseMismatches.length === 0, { routes: servedMetadata, policy: metadataPolicies, responseMismatches: responseMismatches.filter(item => Object.hasOwn(metadataPolicies, item.route)) });
  if (!evidenceOnly) {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true });
  page.setDefaultTimeout(12000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', request => {
    if (request.url().startsWith(base + '/api/')) requests.push({ method: request.method(), path: new URL(request.url()).pathname });
    else if (!request.url().startsWith(base) && !request.url().startsWith('data:')) outsideRequests.push(request.url());
  });
  page.on('response', response => { if (response.status() >= 400 && !response.url().includes('/favicon.ico')) failedResources.push({ url: response.url(), status: response.status() }); });
  await page.goto(base, { waitUntil: 'networkidle' });
  const start = page.getByRole('button', { name: 'Start', exact: true }).or(page.getByRole('link', { name: 'Start', exact: true }));
  await start.waitFor({ state: 'visible' });
  check('Fresh root visit shows the welcome page and Start action', await start.isVisible() && await page.getByRole('region', { name: 'Recorded acceptance timeline' }).count() === 0 && new URL(page.url()).hash === '');
  check('Welcome page makes no application API requests before Start', requests.length === 0, requests.slice());
  await capture(page, '00-welcome');
  await start.click();
  await page.getByRole('link', { name: 'Evidence Studio', exact: true }).waitFor();
  check('Start opens the fresh browser trial at #trial', new URL(page.url()).hash === '#trial' && !(await start.isVisible()));
  await page.getByRole('link', { name: 'Evidence Studio', exact: true }).click();
  await page.getByRole('region', { name: 'Recorded acceptance timeline' }).waitFor();
  check('Evidence Studio opens the preserved workspace at #studio', new URL(page.url()).hash === '#studio' && !(await start.isVisible()));
  await page.getByRole('button', { name: 'Compare before and after', exact: true }).waitFor();
  await waitForImages(page, '.evidence-link img');
  fs.writeFileSync(path.join(out, 'initial-dom.txt'), await page.locator('body').innerText());
  await capture(page, '01-featured-baseline');
  const storage = await page.evaluate(() => JSON.parse(localStorage.getItem('ming.workspace.v2')));
  check('Fresh entry selects the featured real English baseline', storage.runId === manifest.featuredBaselineRunId && storage.variant === 'shipboard-repair');
  check('Document language is English', /^en(?:-|$)/i.test(await page.locator('html').getAttribute('lang')));
  await verifyEnglish(page, 'Fresh baseline');
  check('Initial browser image belongs to the selected original baseline', (await page.locator('.evidence-link img').first().getAttribute('src')).includes(manifest.featuredBaselineRunId));
  const trace = page.getByRole('region', { name: 'Recorded acceptance timeline' });
  const initial = await trace.locator('[aria-current="step"]').getAttribute('aria-label');
  await trace.getByRole('button', { name: 'Step 1:', exact: false }).click();
  check('Clicking recorded step updates actual selected action and criterion', (await page.locator('.criterion-button[aria-pressed="true"]').innerText()).includes('SHIP-01') && (await trace.locator('[aria-current="step"]').getAttribute('aria-label')).startsWith('Step 1:'));
  await trace.getByRole('button', { name: 'Next recorded step' }).click();
  check('Next-step control follows the saved action order', (await trace.locator('[aria-current="step"]').getAttribute('aria-label')).startsWith('Step 2:'));
  await range(page, page.getByRole('slider', { name: 'Scrub recorded steps' }), 5);
  check('Timeline scrub selects the actual failed assertion', (await trace.locator('[aria-current="step"]').getAttribute('aria-label')).startsWith('Step 6:') && (await page.locator('.criterion-button[aria-pressed="true"]').innerText()).includes('SHIP-02'));
  check('Selected failure shows the stored observed result', (await page.locator('body').innerText()).includes('is not visible within'));
  await range(page, page.getByRole('slider', { name: 'Scrub recorded steps' }), 0);
  await trace.getByRole('button', { name: 'Play recorded steps' }).click();
  await page.waitForFunction(() => document.querySelector('.trace-step[aria-current="step"]')?.getAttribute('aria-label')?.startsWith('Step 2:'));
  await trace.getByRole('button', { name: 'Pause evidence replay' }).click();
  const paused = await trace.locator('[aria-current="step"]').getAttribute('aria-label');
  await delay(1650);
  check('Play advances genuine steps and pause holds the selected evidence', (await trace.locator('[aria-current="step"]').getAttribute('aria-label')) === paused);
  await page.getByRole('button', { name: 'Focus on evidence', exact: true }).click();
  check('Focus mode gives evidence the full workspace', await page.locator('.app-shell').evaluate(node => node.classList.contains('focus-mode')));
  await capture(page, '02-evidence-focus');
  await page.keyboard.press('Escape');
  check('Escape exits focus mode', await page.locator('.app-shell.focus-mode').count() === 0);
  await page.keyboard.press('Control+k');
  const search = page.getByRole('combobox', { name: 'Search workspace commands' });
  await search.waitFor();
  check('Command menu opens with the search field focused', await search.evaluate(input => document.activeElement === input));
  await search.press('ArrowDown');
  check('Command arrow navigation updates active option', await search.getAttribute('aria-activedescendant') === 'ming-command-1');
  await search.press('ArrowUp');
  check('Command up navigation returns to the first option', await search.getAttribute('aria-activedescendant') === 'ming-command-0');
  await search.fill('history');
  check('Command search filters the actual navigation options', await page.getByRole('dialog', { name: 'Jump to anything' }).getByRole('option').count() === 1);
  await search.press('Enter');
  await page.getByRole('dialog', { name: 'Run history' }).waitFor();
  check('Enter executes the filtered workspace command', true);
  await page.keyboard.press('Escape');
  check('Escape dismisses the dialog', await page.locator('dialog[open]').count() === 0);
  await page.keyboard.press('Control+k'); await search.waitFor(); await search.fill('nothing-matches-xyz');
  check('Empty command search has a useful English state', await page.getByText('No matching command.', { exact: false }).isVisible());
  await page.keyboard.press('Escape');
  check('Escape dismisses command search', await page.locator('dialog[open]').count() === 0);
  await page.getByRole('button', { name: 'Compare before and after', exact: true }).click();
  const comparison = page.getByRole('dialog', { name: 'A repair you can verify' });
  await comparison.waitFor(); await waitForImages(page, '.comparison-stage img');
  check('Comparison displays the strict verified repair result', await comparison.getByRole('heading', { name: 'Verified repair', exact: true }).isVisible());
  const screenshots = await comparison.locator('.comparison-stage img').evaluateAll(images => images.map(img => img.getAttribute('src')));
  check('Interactive comparison uses the original before and after PNGs', screenshots.some(url => url.includes(manifest.featuredBaselineRunId)) && screenshots.some(url => url.includes(manifest.featuredRerunId)));
  await range(page, page.getByRole('slider', { name: 'Compare before and after screenshots' }), 25);
  check('Comparison slider changes the original-image reveal', await page.locator('.comparison-before').evaluate(node => node.style.clipPath === 'inset(0px 75% 0px 0px)' || node.style.clipPath === 'inset(0 75% 0 0)'));
  check('Comparison slider describes its keyboard-accessible split', await page.getByRole('slider', { name: 'Compare before and after screenshots' }).getAttribute('aria-valuetext') === '25% before, 75% after');
  const stage = comparison.locator('.comparison-stage');
  const bounds = await stage.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .25, bounds.y + bounds.height * .45);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .72, bounds.y + bounds.height * .45, { steps: 8 });
  await page.mouse.up();
  const dragged = Number(await page.getByRole('slider', { name: 'Compare before and after screenshots' }).inputValue());
  check('Dragging the original image directly moves the comparison divider', dragged >= 70 && dragged <= 74, dragged);
  await page.getByRole('slider', { name: 'Compare before and after screenshots' }).focus();
  await page.keyboard.press('ArrowLeft');
  check('Comparison remains usable by keyboard after pointer dragging', Number(await page.getByRole('slider', { name: 'Compare before and after screenshots' }).inputValue()) === dragged - 1);
  const persistenceRow = comparison.locator('.comparison-row').filter({ hasText: 'SHIP-02' });
  check('Comparison table exposes the same criterion failing before and passing after', (await persistenceRow.innerText()).includes('Failed') && (await persistenceRow.innerText()).includes('Passed'));
  await verifyEnglish(page, 'Repair comparison');
  await capture(page, '03-repair-comparison');
  await comparison.getByRole('button', { name: 'View the complete follow-up run', exact: true }).click();
  await page.getByRole('button', { name: 'Compare before and after', exact: true }).waitFor();
  const followup = await page.evaluate(() => JSON.parse(localStorage.getItem('ming.workspace.v2')));
  check('Opening follow-up retains its real run identity', followup.runId === manifest.featuredRerunId);
  await page.reload(); await trace.waitFor();
  check('Refresh restores the selected recorded follow-up', (await page.evaluate(() => JSON.parse(localStorage.getItem('ming.workspace.v2')))).runId === manifest.featuredRerunId);
  check('Refreshing #studio stays in the workspace without another welcome screen', new URL(page.url()).hash === '#studio' && !(await start.isVisible()));
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export run', exact: true }).click();
  const download = await downloadPromise, exportPath = path.join(out, 'exported-followup.json'); await download.saveAs(exportPath);
  compare('JSON export equals the untouched recorded run', JSON.parse(fs.readFileSync(exportPath, 'utf8')), bundle.responses[`/api/run/${manifest.featuredRerunId}`].run);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('tab').filter({ hasText: 'Define' }).waitFor();
  await capture(page, '04-project-hub');
  await verifyEnglish(page, 'Project hub');
  const methodContrast = await page.locator('.method-explanation p').evaluate(element => {
    const rgb = text => (text.match(/[\d.]+/g) || []).slice(0,3).map(Number);
    const luminance = color => rgb(color).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum,c,i) => sum + c * [.2126,.7152,.0722][i], 0);
    let parent = element, background = 'rgb(255,255,255)';
    while (parent) { const candidate = getComputedStyle(parent).backgroundColor; if (candidate !== 'rgba(0, 0, 0, 0)' && candidate !== 'transparent') {background=candidate;break;} parent=parent.parentElement; }
    const foreground = getComputedStyle(element).color, a = luminance(foreground), b = luminance(background);
    return { ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05), foreground, background };
  });
  check('Workflow explanatory copy has readable normal-text contrast', methodContrast.ratio >= 4.5, methodContrast);
  await page.getByRole('tab').filter({ hasText: 'Inspect' }).click();
  check('Workflow tabs reveal meaningful process explanations', await page.getByRole('heading', { name: 'Watch what happens', exact: true }).isVisible());
  await page.getByRole('tab').filter({ hasText: 'Inspect' }).press('ArrowRight');
  check('Workflow tabs support arrow-key navigation', await page.getByRole('tab').filter({ hasText: 'Resolve' }).getAttribute('aria-selected') === 'true' && await page.getByRole('heading', { name: 'Close the loop', exact: true }).isVisible());
  await page.getByRole('button').filter({ hasText: 'Shipboard · Working example' }).click();
  await trace.waitFor();
  const normal = bundle.responses['/api/history'].runs.find(run => run.targetVariant === 'shipboard-normal');
  check('English sample navigation switches to its recorded passing run', (await page.evaluate(() => JSON.parse(localStorage.getItem('ming.workspace.v2')))).runId === normal.runId);
  await verifyEnglish(page, 'Working example');
  await page.setViewportSize({ width: 390, height: 844 }); await delay(100);
  check('390px workspace has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await capture(page, '05-mobile-workspace', true);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  check('390px project hub has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await capture(page, '06-mobile-project-hub', true);
  await page.getByRole('button', { name: 'Open command menu', exact: true }).click(); await search.waitFor();
  check('390px command menu remains within the viewport', await page.locator('dialog[open]').evaluate(el => el.getBoundingClientRect().left >= 0 && el.getBoundingClientRect().right <= innerWidth));
  await capture(page, '07-mobile-command-menu'); await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('tab').filter({ hasText: 'Inspect' }).click();
  check('Reduced-motion preference disables decorative transitions and animations', await page.locator('.method-explanation').evaluate(el => getComputedStyle(el).animationName === 'none' && getComputedStyle(el).transitionDuration.split(',').every(v => parseFloat(v) === 0)));
  check('Playback, navigation, comparison and export issue no mutation requests', requests.every(request => request.method === 'GET'));
  check('No requests leave the local packaged preview', outsideRequests.length === 0, outsideRequests);
  check('No broken frontend resources or API routes', failedResources.length === 0, failedResources);
  check('No browser JavaScript errors', errors.length === 0, errors);
  }
  for (const [relative, expected] of Object.entries(manifest.files)) assert.equal(hash(fs.readFileSync(path.join(evidenceRoot, relative))), expected, relative);
  check('Original judge evidence is unchanged after verification', true);
  console.log(JSON.stringify({passed:results.length,out,captures}));
} catch (error) {
  errors.push(`Review stopped: ${error.message}`); console.error(error);
  if (browser) { const page=browser.contexts()[0]?.pages()[0]; if (page) { fs.writeFileSync(path.join(out,'stopped-dom.txt'),await page.locator('body').innerText().catch(()=>'')); await capture(page,'stopped-state').catch(()=>{}); } }
  process.exitCode=1;
} finally {
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({reviewedAt:new Date().toISOString(),base,evidenceOnly,results,errors,requests,failedResources,outsideRequests,captures},null,2));
  await browser?.close();
  if (preview && preview.exitCode===null) {preview.kill();await new Promise(resolve=>{const t=setTimeout(resolve,5000);preview.once('exit',()=>{clearTimeout(t);resolve();});});}
  log?.end();
}
