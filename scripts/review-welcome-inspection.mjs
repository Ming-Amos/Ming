/** Local, real-browser review of the illustrated welcome inspection scene.
 * No model/provider requests, credentials, fixture outcomes, or source mutations.
 * Visibility coverage uses a labelled synthetic document visibility event because
 * headless Chromium does not reproduce an operating-system tab switch reliably.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const base = process.env.MING_WELCOME_REVIEW_URL || 'http://127.0.0.1:4001', origin = new URL(base).origin;
const focusedFollowup = process.env.MING_WELCOME_FOLLOWUP === '1';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Welcome review requires a local compiled preview.');
const id = randomUUID(), stamp = new Date().toISOString().replace(/[:.]/g, '-');
const work = path.join(root, 'runtime', `welcome-inspection-${id}`), out = path.join(root, 'docs/evidence/welcome-inspection', `${stamp}-${id.slice(0, 8)}`);
fs.mkdirSync(work, { recursive: true });
const report = { id, startedAt: new Date().toISOString(), base, passed: false, checks: [], screenshots: [], measurements: {}, requests: [], errors: [], outsideRequests: [], mutationRequests: [], failedResources: [], visibilityMode: 'Synthetic document.visibilityState override and visibilitychange event. This verifies the application handler, not native OS tab switching.' };
report.scope = focusedFollowup ? 'Targeted mobile Start width/entry/layout and late return-route capture after the CSS-only revision. Original animation review is preserved separately.' : 'Full welcome inspection animation review.';
if (focusedFollowup) report.visibilityMode = 'Not repeated in the focused CSS follow-up.';
const selectedReference = 'C:/Users/han20/AppData/Local/Temp/codex-clipboard-f9b81df8-ca1e-4cef-b0ec-d9c147653e89.png';
fs.copyFileSync(selectedReference, path.join(work, 'source-reference.png'));
const referenceBytes = fs.readFileSync(selectedReference);
report.reference = { file: 'source-reference.png', width: referenceBytes.readUInt32BE(16), height: referenceBytes.readUInt32BE(20), sha256: createHash('sha256').update(referenceBytes).digest('hex') };
const check = (name, condition, detail) => { report.checks.push({ name, passed: Boolean(condition), ...(detail === undefined ? {} : { detail }) }); console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`); assert.ok(condition, name); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const main = page => page.locator('.welcome-page');
const pause = page => page.getByRole('button', { name: 'Pause background animation', exact: true });
const play = page => page.getByRole('button', { name: 'Play background animation', exact: true });
const start = page => page.getByRole('link', { name: 'Start', exact: true });
async function ready(page) {
  await main(page).waitFor(); await page.locator('.welcome-stage.is-ready').waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.welcome-environment img,.welcome-atlas-loader')].every(image => image.complete && image.naturalWidth > 0));
  await wait(450);
}
async function shot(page, name) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const file = name + '.png'; await page.screenshot({ path: path.join(work, file) }); report.screenshots.push(file);
}
async function sceneState(page) {
  return main(page).evaluate(node => {
    const rect = element => { const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    return { elapsed: Number(node.dataset.sceneElapsed), phase: node.dataset.scenePhase, visitor: node.dataset.sceneVisitor, verdict: node.dataset.sceneVerdict, writing: node.dataset.sceneWriting, paused: node.dataset.scenePaused,
      inspectorFrame: node.querySelector('.welcome-inspector').getAttribute('data-sprite-frame'),
      sprites: [...node.querySelectorAll('.welcome-sprite')].map(sprite => ({ transform: getComputedStyle(sprite).transform, position: getComputedStyle(sprite).backgroundPosition, size: getComputedStyle(sprite).backgroundSize })),
      actors: [...node.querySelectorAll('.welcome-visitor')].map(actor => ({ name: actor.getAttribute('data-visitor'), left: actor.style.left, bottom: actor.style.bottom, opacity: actor.style.opacity, rect: rect(actor) })),
      animations: node.querySelector('.welcome-stage').getAnimations({ subtree: true }).map(animation => ({ playState: animation.playState, currentTime: Number(animation.currentTime), name: animation.animationName || 'transition' })) };
  });
}
function frozen(a, b) {
  const state = value => ({ elapsed: value.elapsed, phase: value.phase, visitor: value.visitor, writing: value.writing, inspectorFrame: value.inspectorFrame, sprites: value.sprites, actors: value.actors });
  assert.deepEqual(state(a), state(b));
  assert.equal(a.animations.length, b.animations.length);
  for (let index = 0; index < a.animations.length; index++) assert.ok(Math.abs(a.animations[index].currentTime - b.animations[index].currentTime) <= 1, 'CSS animation time must remain frozen');
}
async function freezeCheck(page, label) {
  await pause(page).click(); await page.waitForFunction(() => document.querySelector('.welcome-page')?.dataset.scenePaused === 'true');
  await wait(70); const before = await sceneState(page); await wait(430); const after = await sceneState(page); frozen(before, after);
  check(label, before.paused === 'true' && after.paused === 'true', { phase: before.phase, elapsed: before.elapsed, inspectorFrame: before.inspectorFrame, cssAnimations: before.animations.length });
  await play(page).click(); await wait(320); const resumed = await sceneState(page);
  check('Resuming continues the existing timeline instead of restarting or jumping', resumed.elapsed > after.elapsed + 100 && resumed.elapsed < after.elapsed + 850, { before: after.elapsed, after: resumed.elapsed });
}
async function waitPhase(page, visitor, phase, writing) {
  await page.waitForFunction(({ visitor, phase, writing }) => { const node = document.querySelector('.welcome-page'); return node?.dataset.sceneVisitor === visitor && node.dataset.scenePhase === phase && (writing === undefined || node.dataset.sceneWriting === String(writing)); }, { visitor, phase, writing }, { timeout: 30000 });
}
async function layout(page, name) {
  const metrics = await page.evaluate(() => {
    const box = selector => { const element = document.querySelector(selector), b = element.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    const inside = b => b.x >= -1 && b.y >= -1 && b.x + b.width <= innerWidth + 1 && b.y + b.height <= innerHeight + 1;
    const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    const start = box('.welcome-start'), inspector = box('.welcome-inspector'), active = box('.welcome-visitor.is-active'), content = box('.welcome-content');
    return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight, start, inspector, active, content,
      startInside: inside(start), inspectorInside: inside(inspector), activeInside: inside(active), contentCollidesWithInspector: overlaps(content, inspector), contentCollidesWithActive: overlaps(content, active),
      scenePhase: document.querySelector('.welcome-page').dataset.scenePhase };
  });
  report.measurements[name] = metrics;
  check(`${name}: Start is visible, touch sized, and the page has no horizontal overflow`, metrics.startInside && metrics.start.height >= 44 && metrics.start.width >= 44 && metrics.documentWidth <= metrics.width + 1);
  check(`${name}: the active visitor and inspector fit without colliding with the entry controls`, metrics.inspectorInside && metrics.activeInside && !metrics.contentCollidesWithInspector && !metrics.contentCollidesWithActive);
  if (name === 'mobile-390') check('Mobile Start retains the intended 280-pixel width', Math.abs(metrics.start.width - 280) <= 1, metrics.start);
}
let browser, page;
try {
  const expectedBundle = fs.readFileSync(path.join(root, 'apps/web/dist/index.html'), 'utf8').match(/\/assets\/[^"']+\.js/)?.[0];
  browser = await chromium.launch({ headless: true });
  async function context(options = {}) {
    const created = await browser.newContext({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 1, ...options });
    created.on('page', current => { current.on('pageerror', error => report.errors.push(error.message)); current.on('requestfailed', request => { if (!request.failure()?.errorText?.includes('ERR_ABORTED')) report.failedResources.push({ url: request.url(), error: request.failure()?.errorText }); }); });
    await created.route('**/*', route => {
      const request = route.request(), href = request.url(); if (/^(?:data|blob|about):/.test(href)) return route.continue();
      const url = new URL(href), method = request.method();
      if (url.origin !== origin) { report.outsideRequests.push({ origin: url.origin, path: url.pathname }); return route.abort(); }
      report.requests.push({ path: url.pathname, method });
      if (!['GET', 'HEAD'].includes(method)) { report.mutationRequests.push({ path: url.pathname, method }); return route.abort(); }
      return route.continue();
    });
    return created;
  }
  const desktop = await context(); page = await desktop.newPage(); page.setDefaultTimeout(20000);
  const response = await page.goto(base, { waitUntil: 'networkidle' }); await ready(page);
  report.bundle = expectedBundle;
  check('The welcome review uses the exact current compiled application', response.ok() && Boolean(expectedBundle) && (await response.text()).includes(expectedBundle));
  const imageFacts = await page.locator('.welcome-environment img,.welcome-atlas-loader').evaluateAll(images => images.map(image => ({ source: new URL(image.src).pathname, width: image.naturalWidth, height: image.naturalHeight, complete: image.complete })));
  check('The clean room and cast atlas load without the old crowd GIF', imageFacts.length === 2 && imageFacts.some(image => image.source === '/welcome/inspection-room.png' && image.width === 1536 && image.height === 1024) && imageFacts.some(image => image.source === '/welcome/inspection-cast.png' && image.complete) && !report.requests.some(request => request.path.endsWith('pixel-door-original.gif')), imageFacts);
  check('All seven visitors and one inspector belong to the illustrative stage', await page.locator('.welcome-visitor').count() === 7 && await page.locator('.welcome-inspector').count() === 1 && (await page.locator('.welcome-footer').innerText()).includes('Illustrated scene.'));
  if (focusedFollowup) {
    await page.setViewportSize({ width: 390, height: 844 }); await waitPhase(page, 'Duck', 'inspect', true); await pause(page).click(); await layout(page, 'mobile-390'); await shot(page, '01-mobile-start-final');
    await start(page).click(); await page.getByTestId('upload-studio').waitFor(); check('Mobile Start opens the actual upload workflow', new URL(page.url()).hash === '#upload');
    await page.goBack(); await ready(page); await page.getByRole('link', { name: 'Try a guided sample', exact: true }).click(); await page.getByTestId('live-trial').waitFor(); check('The guided sample link opens the working sample route', new URL(page.url()).hash === '#trial');
    const routePage = await desktop.newPage(); await routePage.goto(base, { waitUntil: 'networkidle' }); await ready(routePage);
    await routePage.waitForFunction(() => { const scene = document.querySelector('.welcome-page'); return scene?.dataset.sceneVisitor === 'Flame' && Number(scene.dataset.sceneElapsed) % 8500 >= 6900 && Number(scene.dataset.sceneElapsed) % 8500 < 7200; }, undefined, { timeout: 22000 });
    await pause(routePage).click(); await shot(routePage, '02-desktop-return-for-fix-final');
    const returned = await sceneState(routePage); report.returnedState = { elapsed: returned.elapsed, phase: returned.phase, visitor: returned.visitor, actor: returned.actors.find(actor => actor.name === 'Flame') };
    check('Late return-route capture shows the failed visitor moving down and left', returned.visitor === 'Flame' && returned.phase === 'exit' && Number.parseFloat(report.returnedState.actor.left) < 60 && await routePage.locator('.welcome-fix-area.is-active').count() === 1);
  } else {
  await waitPhase(page, 'Duck', 'inspect', true); await layout(page, 'desktop-1536'); await shot(page, '01-desktop-writing');
  const writingSamples = [await sceneState(page)]; for (let sample = 0; sample < 4; sample++) { await wait(80); writingSamples.push(await sceneState(page)); }
  check('The inspector actually changes its writing frame while the visitor is inspected', writingSamples.every(sample => sample.writing === 'true') && new Set(writingSamples.map(sample => sample.inspectorFrame)).size === 2 && writingSamples.at(-1).elapsed > writingSamples[0].elapsed);
  await freezeCheck(page, 'Pause freezes the inspector pen, elapsed timeline, and all visitor transforms');
  await waitPhase(page, 'Duck', 'verdict'); await shot(page, '02-desktop-pass');
  check('The passing visitor receives a visible PASS verdict', (await page.locator('.welcome-inspection-state').innerText()) === 'PASS');
  await waitPhase(page, 'Duck', 'exit'); await wait(180);
  check('The passing visitor walks toward the doorway rather than the repair area', Number.parseFloat(await page.locator('.welcome-visitor.is-active').evaluate(node => node.style.left)) > 67);
  await freezeCheck(page, 'Pause also freezes a walking visitor and its CSS stepping animation');
  await waitPhase(page, 'Flame', 'verdict'); await shot(page, '03-desktop-needs-fix');
  check('The next visitor receives a distinct NEEDS FIX verdict', (await page.locator('.welcome-inspection-state').innerText()) === 'NEEDS FIX');
  await waitPhase(page, 'Flame', 'exit');
  await page.waitForFunction(() => { const scene = document.querySelector('.welcome-page'); return scene?.dataset.sceneVisitor === 'Flame' && Number(scene.dataset.sceneElapsed) % 8500 >= 6900 && Number(scene.dataset.sceneElapsed) % 8500 < 7200; });
  await shot(page, '04-desktop-return-for-fix');
  check('The failed visitor moves into the visible return-for-fix area', await page.locator('.welcome-fix-area.is-active').count() === 1 && Number.parseFloat(await page.locator('.welcome-visitor.is-active').evaluate(node => node.style.left)) < 67);

  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => document.querySelector('.welcome-page')?.dataset.scenePaused === 'true'); await wait(70);
  const hiddenBefore = await sceneState(page); await wait(350); frozen(hiddenBefore, await sceneState(page));
  check('The visibility-change handler freezes the timeline and CSS motion while hidden', true);
  await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); }); await wait(260);
  const visibleAgain = await sceneState(page); check('Returning to visible resumes from the same elapsed position', visibleAgain.elapsed > hiddenBefore.elapsed && visibleAgain.elapsed < hiddenBefore.elapsed + 700);
  await pause(page).click();
  check('Before entering a workflow the scene has made no application API request', !report.requests.some(request => request.path.startsWith('/api/')));

  const widePage = await desktop.newPage(); await widePage.setViewportSize({ width: 1856, height: 900 }); await widePage.goto(base, { waitUntil: 'networkidle' }); await ready(widePage); await waitPhase(widePage, 'Duck', 'inspect', true); await pause(widePage).click(); await layout(widePage, 'desktop-1856'); await shot(widePage, '05-wide-desktop');
  await widePage.setViewportSize({ width: report.reference.width, height: report.reference.height }); await shot(widePage, '05b-reference-sized-desktop');
  const mobilePage = await desktop.newPage(); await mobilePage.setViewportSize({ width: 390, height: 844 }); await mobilePage.goto(base, { waitUntil: 'networkidle' }); await ready(mobilePage); await waitPhase(mobilePage, 'Duck', 'inspect', true); await pause(mobilePage).click(); await layout(mobilePage, 'mobile-390'); await shot(mobilePage, '06-mobile-writing');
  await start(mobilePage).click(); await mobilePage.getByTestId('upload-studio').waitFor(); check('Mobile Start opens the actual upload workflow', new URL(mobilePage.url()).hash === '#upload');
  await mobilePage.goBack(); await ready(mobilePage); await mobilePage.getByRole('link', { name: 'Try a guided sample', exact: true }).click(); await mobilePage.getByTestId('live-trial').waitFor(); check('The guided sample link opens the working sample route', new URL(mobilePage.url()).hash === '#trial');

  const reduced = await context({ reducedMotion: 'reduce' }); const reducedPage = await reduced.newPage(); await reducedPage.goto(base, { waitUntil: 'networkidle' }); await ready(reducedPage);
  const reducedBefore = await sceneState(reducedPage); await wait(420); frozen(reducedBefore, await sceneState(reducedPage));
  check('Reduced-motion preference starts with a fully paused scene and an available Play control', reducedBefore.paused === 'true' && reducedBefore.elapsed === 0 && await play(reducedPage).isVisible());
  await start(reducedPage).focus(); await reducedPage.keyboard.press('Enter'); await reducedPage.getByTestId('upload-studio').waitFor(); check('Keyboard Start reaches the same upload route', new URL(reducedPage.url()).hash === '#upload');
  }
  check('No POST, model/provider, external, or failed-resource request occurred', report.mutationRequests.length === 0 && report.outsideRequests.length === 0 && report.failedResources.length === 0 && !report.requests.some(request => request.path === '/api/upload/planner/draft'));
  check('No uncaught browser errors occurred', report.errors.length === 0);
  report.passed = true;
} catch (error) {
  report.error = String(error.stack || error); process.exitCode = 1;
  if (page && !page.isClosed()) { await shot(page, 'stopped-state').catch(() => {}); fs.writeFileSync(path.join(work, 'stopped-dom.txt'), await page.locator('body').innerText().catch(() => '')); }
} finally {
  await browser?.close(); report.finishedAt = new Date().toISOString(); const destination = report.passed ? out : work; fs.mkdirSync(destination, { recursive: true });
  if (report.passed) for (const file of fs.readdirSync(work)) fs.copyFileSync(path.join(work, file), path.join(destination, file));
  for (const screenshot of report.screenshots) { const file = path.join(destination, screenshot); if (fs.existsSync(file)) report.measurements[screenshot] = { sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') }; }
  fs.writeFileSync(path.join(destination, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, report: path.join(destination, 'report.json') }));
}
