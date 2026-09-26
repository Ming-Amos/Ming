/** Real browser QA for GitHub import. Mocked GitHub transport is explicitly labelled;
 * imported HTML/JS and acceptance operations really execute in the opaque sandbox.
 * MING_GITHUB_LIVE=1 additionally imports the public MDN starter through real GitHub GETs.
 * No credentials, model calls, Bob usage, repository writes, or application mutations.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const base = process.env.MING_GITHUB_REVIEW_URL || 'http://127.0.0.1:4192';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('GitHub development review requires a local compiled preview.');
const origin = new URL(base).origin;
const reviewId = randomUUID(), tag = reviewId.slice(0, 8), stamp = new Date().toISOString().replace(/[:.]/g, '-');
const work = path.join(root, 'runtime', `github-import-review-${reviewId}`);
const out = path.join(root, 'docs/evidence/github-import', `${stamp}-${tag}`);
fs.mkdirSync(work, { recursive: true });
const report = { reviewId, startedAt: new Date().toISOString(), base, checks: [], runs: [], githubRequests: [], requests: [], errors: [], outsideRequests: [], screenshots: [], passed: false,
  scope: 'Deterministic GitHub API/raw response fixtures; real repository inspection UI, imported code execution, browser actions and DOM captures. Live MDN smoke is separately labelled when enabled.' };
const liveReport = { startedAt: '', repository: 'https://github.com/mdn/beginner-html-site', transport: 'real unauthenticated GitHub API and raw GET requests', checks: [], requests: [], responses: [], failedRequests: [], passed: false };
const check = (name, passed, detail) => { report.checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); if (!passed) throw Error(name); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const blob = bytes => createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const commit = { broken: '1'.repeat(40), fixed: '2'.repeat(40) };
const treeSha = { broken: 'a'.repeat(40), fixed: 'b'.repeat(40) };
const css = 'body{margin:0;background:rgb(223,244,238);font:16px system-ui;color:#183831}main{margin:32px;padding:28px;background:white;border-radius:16px}label{display:block;margin:18px 0 8px}input,button{padding:12px;border-radius:6px}li{padding:10px}';
const logo = '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="40"><rect width="72" height="40" rx="9" fill="#166c55"/></svg>';
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Repository Notes</title><link rel="stylesheet" href="/assets/style.css"></head><body><main><img id="repo-logo" src="./assets/logo.svg" alt="Repository logo"><h1>Repository Notes</h1><p id="loaded">Waiting for script</p><form id="taskForm"><label for="taskName">Task name</label><input id="taskName"><button id="addTask">Add task</button></form><ul id="taskList"></ul></main><script src="./assets/app.js"></script></body></html>';
const script = fixed => `const key='github-review-tasks';let tasks=${fixed ? "JSON.parse(localStorage.getItem(key)||'[]')" : '[]'};function render(){document.querySelector('#taskList').replaceChildren(...tasks.map(text=>{const row=document.createElement('li');row.textContent=text;return row}))}document.querySelector('#taskForm').onsubmit=e=>{e.preventDefault();const input=document.querySelector('#taskName');tasks.push(input.value);${fixed ? 'localStorage.setItem(key,JSON.stringify(tasks));' : ''}render();input.value=''};document.querySelector('#loaded').textContent='Repository JavaScript executed';render();`;
function files(fixed) { return new Map([['docs/site/index.html', Buffer.from(html)], ['docs/site/assets/style.css', Buffer.from(css)], ['docs/site/assets/app.js', Buffer.from(script(fixed))], ['docs/site/assets/logo.svg', Buffer.from(logo)], ['docs/site/assets/tiny.json', Buffer.from('{}\n')], ['docs/site/.env.json', Buffer.from('{"reviewFixture":"synthetic-not-a-secret"}')], ['docs/site/secrets.json', Buffer.from('{"reviewFixture":true}')], ['package.json', Buffer.from('{"scripts":{"build":"vite build"}}')], ['src/App.tsx', Buffer.from('export default function App(){return <h1>Source only</h1>}')]]); }
const contents = { broken: files(false), fixed: files(true) };
const tree = entries => [...entries].map(([file, bytes]) => ({ path: file, mode: '100644', type: 'blob', sha: blob(bytes), size: bytes.length }));
const ui = {
  root: page => page.locator('[data-testid="upload-studio"]'),
  url: page => page.getByRole('textbox', { name: 'Public repository URL', exact: true }),
  ref: page => page.getByRole('textbox', { name: 'Branch, tag, or commit (optional)', exact: true }),
  folder: page => page.getByRole('textbox', { name: 'Static folder (optional)', exact: true }),
  inspect: page => page.getByRole('button', { name: 'Inspect repository', exact: true }),
  selectedFolder: page => page.getByRole('combobox', { name: 'Static folder to import', exact: true }),
  import: page => page.getByRole('button', { name: 'Import selected folder', exact: true }),
  cancelImport: page => page.getByRole('button', { name: 'Cancel GitHub import', exact: true }),
  requirements: page => page.getByRole('textbox', { name: 'Requirements', exact: true }),
  steps: page => page.locator('[data-testid="upload-step"]'),
  confirm: page => page.getByRole('checkbox', { name: 'These checks match my requirements.', exact: true }),
  run: page => page.getByRole('button', { name: 'Run acceptance checks', exact: true }),
  cancelRun: page => page.getByRole('button', { name: 'Cancel checks', exact: true }),
};
let browser, context, page, livePage, revision = 'broken';
async function configureRepository(current, repo = 'public-static', ref = '', directory = '') {
  await current.getByRole('tab', { name: 'GitHub', exact: true }).click();
  await ui.url(current).fill(`https://github.com/ming-review/${repo}`);
  await ui.ref(current).fill(ref); await ui.folder(current).fill(directory);
}
async function inspect(current) { await ui.inspect(current).click(); await ui.selectedFolder(current).waitFor(); }
async function importSelected(current, directory = 'docs/site') {
  const before = await ui.root(current).getAttribute('data-project-fingerprint');
  await ui.selectedFolder(current).selectOption(directory); await ui.import(current).click();
  await Promise.race([
    current.waitForFunction(previous => { const node = document.querySelector('[data-testid="upload-studio"]'); return node?.dataset.projectFingerprint && node.dataset.projectFingerprint !== previous && node.dataset.previewReady === 'true' && node.dataset.phase === 'idle'; }, before),
    current.getByRole('alert').waitFor().then(async () => { throw Error(await current.getByRole('alert').innerText()); }),
  ]);
}
async function configurePlan(current, task) {
  await ui.requirements(current).fill(`Add ${task}, then verify it remains visible after reload.`);
  const editor = current.getByTestId('plan-technical-editor'); if (!(await editor.evaluate(node => node.open))) await editor.locator('summary').click();
  const steps = [{ action: 'fill', selector: '#taskName', value: task }, { action: 'click', selector: '#addTask' }, { action: 'assertText', selector: '#taskList', value: task }, { action: 'reload' }, { action: 'assertText', selector: '#taskList', value: task }];
  for (let index = 0; index < steps.length; index++) {
    if (index) await current.getByRole('button', { name: 'Add step', exact: true }).click();
    const row = ui.steps(current).nth(index), step = steps[index]; await row.getByLabel('Action', { exact: true }).selectOption(step.action);
    if (step.selector) await row.getByLabel('CSS selector', { exact: true }).fill(step.selector);
    if (step.value) await row.getByLabel(step.action === 'assertText' ? 'Expected text' : 'Value', { exact: true }).fill(step.value);
  }
  await ui.confirm(current).check();
}
async function run(current, name) {
  await ui.run(current).click(); await ui.cancelRun(current).waitFor({ state: 'visible' }); await ui.cancelRun(current).waitFor({ state: 'hidden', timeout: 45000 });
  const promise = current.waitForEvent('download'); await current.getByRole('button', { name: 'Export evidence report', exact: true }).click();
  const file = path.join(work, name + '.json'); await (await promise).saveAs(file); const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  report.runs.push({ ...exported.currentRun, steps: exported.currentRun.steps.map(({ capture, ...step }) => ({ ...step, ...(capture ? { capture: { bytes: Buffer.from(capture.split(',')[1], 'base64').length, sha256: sha(capture) } } : {}) })) });
  return exported;
}
async function shot(current, name) {
  await current.evaluate(() => scrollTo(0, 0)); await current.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const file = path.join(work, name + '.png'); await current.screenshot({ path: file, fullPage: true }); report.screenshots.push(name + '.png');
}
async function mockGitHub(route) {
  const request = route.request(), url = new URL(request.url());
  const credentialsAbsent = !request.headers().authorization && !request.headers().cookie;
  report.githubRequests.push({ path: url.pathname, host: url.hostname, method: request.method(), credentialsAbsent });
  const respond = (body, status = 200, extra = {}) => route.fulfill({ status, headers: { 'access-control-allow-origin': '*', 'content-type': typeof body === 'string' || Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json', ...extra }, body: typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body) }).catch(() => {});
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (url.hostname === 'raw.githubusercontent.com') {
    const [owner, repo, pinned, ...file] = parts;
    if (owner !== 'ming-review' || !['public-static', 'corrupt-blob', 'slow-download', 'compressed-blob', 'expanded-blob'].includes(repo)) return respond({ message: 'Unknown fixture' }, 404);
    const version = pinned === commit.broken ? 'broken' : pinned === commit.fixed ? 'fixed' : null;
    const bytes = version && contents[version].get(file.join('/'));
    if (!bytes) return respond({ message: 'Unknown fixture file' }, 404);
    if (repo === 'slow-download') await sleep(1600);
    // Playwright fulfillment supplies the renderer's already-decoded body. Preserve
    // the real CDN wire headers while returning the three decoded bytes; the separate
    // live MDN case verifies the actual compressed network response end to end.
    if (repo === 'compressed-blob' && file.join('/').endsWith('tiny.json')) { const wire = gzipSync(bytes); return respond(bytes, 200, { 'content-encoding': 'gzip', 'content-length': String(wire.length) }); }
    if (repo === 'expanded-blob' && file.join('/').endsWith('tiny.json')) return respond(Buffer.concat([bytes, Buffer.from('!')]));
    if (repo === 'corrupt-blob' && file.join('/').endsWith('app.js')) { const altered = Buffer.from(bytes); altered[0] ^= 1; return respond(altered); }
    return respond(bytes);
  }
  const [, owner, repo, endpoint, reference] = parts;
  if (owner !== 'ming-review') return respond({ message: 'Unknown fixture' }, 404);
  if (repo === 'missing') return respond({ message: 'Not Found' }, 404);
  if (repo === 'rate-limited') return respond({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0' });
  if (repo === 'slow') { await sleep(1600); return respond({ full_name: 'ming-review/slow', private: false, default_branch: 'main', html_url: 'https://github.com/ming-review/slow' }); }
  if (!endpoint) return respond({ full_name: `ming-review/${repo}`, private: repo === 'private', default_branch: 'feature/demo', html_url: `https://github.com/ming-review/${repo}` });
  const version = reference === commit.fixed || reference === 'fixed' ? 'fixed' : revision;
  if (endpoint === 'commits') return respond({ sha: commit[version], commit: { tree: { sha: treeSha[version] } } });
  if (endpoint === 'git' && reference === 'trees') {
    let entries = tree(contents[parts[5] === treeSha.fixed ? 'fixed' : 'broken']);
    if (repo === 'no-html') entries = tree(new Map([['README.md', Buffer.from('No HTML here')], ['assets/style.css', Buffer.from(css)]]));
    if (repo === 'source-only') entries = tree(new Map([['package.json', Buffer.from('{"scripts":{"build":"vite build"}}')], ['src/App.tsx', Buffer.from('export const app=<h1>Source</h1>')]]));
    if (repo === 'oversized') entries = [{ path: 'index.html', mode: '100644', type: 'blob', sha: 'c'.repeat(40), size: 21 * 1024 * 1024 }];
    if (repo === 'unsafe-tree') entries.push({ path: 'docs/site/../outside.js', mode: '100644', type: 'blob', sha: 'd'.repeat(40), size: 10 });
    if (repo === 'symlink') entries = [{ path: 'index.html', mode: '120000', type: 'blob', sha: 'c'.repeat(40), size: 20 }];
    if (repo === 'too-many-files') entries = [{ path: 'index.html', mode: '100644', type: 'blob', sha: 'c'.repeat(40), size: 20 }, ...Array.from({ length: 100 }, (_, index) => ({ path: `assets/file-${index}.js`, mode: '100644', type: 'blob', sha: 'c'.repeat(40), size: 20 }))];
    return respond({ sha: repo === 'wrong-tree' ? 'f'.repeat(40) : parts[5], truncated: false, tree: entries });
  }
  return respond({ message: 'Unsupported fixture route' }, 404);
}
async function rejected(current, repo, pattern, title) {
  await configureRepository(current, repo); await ui.inspect(current).click();
  const alert = current.getByRole('alert').filter({ hasText: pattern }); await alert.waitFor(); check(title, true, await alert.innerText());
}
try {
  const compiled = await fetch(base); const document = await compiled.text();
  const expected = fs.readFileSync(path.join(root, 'apps/web/dist/index.html'), 'utf8').match(/\/assets\/[^"']+\.js/)?.[0];
  check('The local preview serves the exact compiled UI', compiled.ok && Boolean(expected) && document.includes(expected));
  browser = await chromium.launch({ headless: true }); context = await browser.newContext({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true });
  context.on('page', current => current.on('pageerror', error => report.errors.push(error.message)));
  await context.route('**/*', route => {
    const request = route.request(), href = request.url(); if (/^(?:blob|data|about):/.test(href)) return route.continue();
    const url = new URL(href); if (url.origin === origin) { report.requests.push({ path: url.pathname, method: request.method() }); return route.continue(); }
    if (['api.github.com', 'raw.githubusercontent.com'].includes(url.hostname)) return mockGitHub(route);
    report.outsideRequests.push(url.origin); return route.abort();
  });
  if (process.env.MING_GITHUB_ONLY_LIVE !== '1') {
  page = await context.newPage(); page.setDefaultTimeout(20000); await page.goto(base + '/#upload', { waitUntil: 'networkidle' }); await ui.root(page).waitFor();
  await configureRepository(page, 'public-static', 'feature/demo', 'docs/site'); await inspect(page);
  check('Repository inspection finds the requested static folder', await ui.selectedFolder(page).locator('option[value="docs/site"]').count() === 1);
  check('Inspection does not execute the project before import', !(await ui.root(page).getAttribute('data-project-fingerprint')));
  await ui.ref(page).fill('fixed');
  check('Changing the requested revision clears stale inspection results', await ui.selectedFolder(page).count() === 0 && await ui.import(page).count() === 0);
  await ui.ref(page).fill('feature/demo'); await inspect(page);
  await importSelected(page); const frame = page.frameLocator('iframe[sandbox]');
  check('Selected repository JavaScript executes in the isolated preview', await frame.locator('#loaded').innerText() === 'Repository JavaScript executed');
  check('Selected-folder root-relative CSS resolves', await frame.locator('body').evaluate(node => getComputedStyle(node).backgroundColor) === 'rgb(223, 244, 238)');
  check('Selected-folder image asset is decoded', await frame.locator('#repo-logo').evaluate(async image => { await image.decode().catch(() => {}); return image.naturalWidth === 72; }));
  const task = `GitHub acceptance ${tag}`; await configurePlan(page, task); const before = await run(page, 'baseline');
  const baseline = before.currentRun;
  check('Imported broken code fails its actual persistence assertion', baseline.status === 'failed' && baseline.steps[2].status === 'passed' && baseline.steps[4].status === 'failed');
  check('Export records the public repository, immutable commit and selected folder', baseline.source?.kind === 'github' && baseline.source.commit === commit.broken && baseline.source.directory === 'docs/site');
  check('Repository acceptance produces real DOM-render failure evidence', baseline.steps[4].capture?.startsWith('data:image/png;base64,') && baseline.steps[4].capture.length > 1000);
  await shot(page, '01-github-baseline');
  revision = 'fixed'; await configureRepository(page, 'public-static', 'fixed', 'docs/site'); await inspect(page); await importSelected(page);
  check('Importing another commit invalidates approval without changing the plan', !(await ui.confirm(page).isChecked()) && await ui.steps(page).count() === 5 && (await ui.requirements(page).inputValue()).includes(task));
  await ui.confirm(page).check(); const after = await run(page, 'fixed-commit'), fixed = after.currentRun;
  check('The updated repository commit passes the same acceptance plan', fixed.status === 'passed' && fixed.planFingerprint === baseline.planFingerprint && fixed.id !== baseline.id && fixed.projectFingerprint !== baseline.projectFingerprint && fixed.source?.commit === commit.fixed);
  assert.deepEqual(after.baseline, baseline); check('Original failed repository evidence remains unchanged', true);
  check('The comparison verifies a changed source in the same repository and folder with unchanged entry/plan', after.comparison.samePlan && after.comparison.sameEntry && after.comparison.sameSourceTarget && after.comparison.sourceChanged && after.comparison.revisedSourcePassed);
  await shot(page, '02-github-fixed-commit');
  await page.setViewportSize({ width: 390, height: 844 });
  check('GitHub import and provenance fit a 390px screen', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await shot(page, '03-github-mobile'); await page.setViewportSize({ width: 1484, height: 1060 });
  const prior = await ui.root(page).getAttribute('data-project-fingerprint');
  await configureRepository(page, 'slow'); await ui.inspect(page).click(); await ui.cancelImport(page).waitFor(); await ui.cancelImport(page).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="upload-studio"]')?.getAttribute('data-phase') === 'idle');
  await sleep(1800); check('Cancelling inspection preserves the active project and cannot complete later', await ui.root(page).getAttribute('data-project-fingerprint') === prior && await ui.selectedFolder(page).count() === 0);
  await configureRepository(page, 'slow-download', 'fixed', 'docs/site'); await inspect(page); await ui.selectedFolder(page).selectOption('docs/site'); await ui.import(page).click();
  await ui.cancelImport(page).waitFor(); await ui.cancelImport(page).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="upload-studio"]')?.getAttribute('data-phase') === 'idle');
  await sleep(1800); check('Cancelling a file download never replaces the current project with partial content', await ui.root(page).getAttribute('data-project-fingerprint') === prior);
  await rejected(page, 'missing', /public|private|not found|404/i, 'A missing or inaccessible repository receives a useful error');
  await rejected(page, 'private', /private|public/i, 'Private repositories are rejected');
  await rejected(page, 'rate-limited', /rate|limit|403/i, 'GitHub rate limits are reported explicitly');
  await rejected(page, 'no-html', /html|static|build/i, 'Repositories without HTML explain the required static output');
  await rejected(page, 'source-only', /build|dist|source|html/i, 'Uncompiled source repositories receive build guidance');
  await configureRepository(page, 'oversized'); await inspect(page);
  check('Oversized repository output cannot be imported and shows its limit', await ui.import(page).isDisabled() && /20 MB|10 MB|limit/i.test(await ui.selectedFolder(page).innerText()));
  await configureRepository(page, 'symlink'); await inspect(page);
  check('A symbolic-link HTML entry cannot be imported', await ui.import(page).isDisabled() && /symbolic|unsupported/i.test(await ui.selectedFolder(page).innerText()));
  await configureRepository(page, 'too-many-files'); await inspect(page);
  check('A selected folder above the 100-file limit cannot be imported', await ui.import(page).isDisabled() && /100|limit/i.test(await ui.selectedFolder(page).innerText()));
  await rejected(page, 'unsafe-tree', /path|unsafe|traversal|invalid/i, 'Ambiguous repository tree paths are rejected');
  await rejected(page, 'wrong-tree', /tree|commit|match|pinned/i, 'A tree response must match the resolved commit');
  const requestCount = report.githubRequests.length;
  await configureRepository(page); await ui.url(page).fill('https://github.com.evil.invalid/ming-review/public-static'); await ui.inspect(page).click();
  await page.getByRole('alert').filter({ hasText: /github|url|https|valid/i }).waitFor();
  check('A GitHub-looking hostname is rejected without a network request', report.githubRequests.length === requestCount && report.outsideRequests.length === 0);
  await configureRepository(page, 'corrupt-blob', 'fixed', 'docs/site'); await inspect(page); await ui.selectedFolder(page).selectOption('docs/site'); await ui.import(page).click();
  await page.getByRole('alert').filter({ hasText: /integrity|checksum|hash|changed|size|match/i }).waitFor();
  check('Downloaded file bytes must match the pinned Git tree', await ui.root(page).getAttribute('data-project-fingerprint') === prior);
  const compressed = await context.newPage(); compressed.setDefaultTimeout(20000); await compressed.goto(base + '/#upload', { waitUntil: 'networkidle' }); await ui.root(compressed).waitFor();
  await configureRepository(compressed, 'compressed-blob', 'fixed', 'docs/site'); await inspect(compressed); await importSelected(compressed);
  check('A decoded three-byte file with larger gzip wire metadata imports correctly', await compressed.frameLocator('iframe[sandbox]').locator('#loaded').innerText() === 'Repository JavaScript executed');
  const compressedFingerprint = await ui.root(compressed).getAttribute('data-project-fingerprint');
  await configureRepository(compressed, 'expanded-blob', 'fixed', 'docs/site'); await inspect(compressed); await ui.selectedFolder(compressed).selectOption('docs/site'); await ui.import(compressed).click();
  await compressed.getByRole('alert').filter({ hasText: /download|size|limit/i }).waitFor();
  check('A decoded body exceeding its declared Git blob size is still rejected', await ui.root(compressed).getAttribute('data-project-fingerprint') === compressedFingerprint); await compressed.close();
  check('Private configuration paths are excluded before downloading', !report.githubRequests.some(request => request.host === 'raw.githubusercontent.com' && /(?:\.env|secrets\.json|package\.json|App\.tsx)/.test(request.path)));
  check('Every mocked GitHub request is an unauthenticated GET', report.githubRequests.every(request => request.method === 'GET' && request.credentialsAbsent));
  check('Repository assets are downloaded only using immutable commits', report.githubRequests.filter(request => request.host === 'raw.githubusercontent.com').every(request => request.path.includes(commit.broken) || request.path.includes(commit.fixed)));
  check('A branch containing a slash is resolved without path confusion', report.githubRequests.some(request => request.path.endsWith('/commits/feature%2Fdemo')));
  check('No application mutations, model requests or unexpected origins', report.requests.every(request => request.method === 'GET') && report.outsideRequests.length === 0 && !report.requests.some(request => /\/api\/(?:generate|run|repair|provider\/test)/.test(request.path)));
  check('No uncaught JavaScript exceptions occurred', report.errors.length === 0, report.errors);
  }
  report.passed = true;

  if (process.env.MING_GITHUB_LIVE === '1') {
    liveReport.startedAt = new Date().toISOString();
    const live = await browser.newContext({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true });
    const liveErrors = [];
    live.on('page', current => current.on('pageerror', error => liveErrors.push(error.message)));
    live.on('response', response => { const url = new URL(response.url()); if (['api.github.com', 'raw.githubusercontent.com'].includes(url.hostname)) { const headers = response.headers(); liveReport.responses.push({ host: url.hostname, path: url.pathname, status: response.status(), contentLength: headers['content-length'], contentEncoding: headers['content-encoding'] }); } });
    live.on('requestfailed', request => { const url = new URL(request.url()); if (['api.github.com', 'raw.githubusercontent.com'].includes(url.hostname)) liveReport.failedRequests.push({ host: url.hostname, path: url.pathname, error: request.failure()?.errorText }); });
    await live.route('**/*', route => {
      const request = route.request(), href = request.url(); if (/^(?:blob|data|about):/.test(href)) return route.continue();
      const url = new URL(href);
      if (url.origin === origin) return route.continue();
      const approved = url.origin === 'https://api.github.com' && /^\/repos\/mdn\/beginner-html-site(?:\/|$)/.test(url.pathname) || url.origin === 'https://raw.githubusercontent.com' && /^\/mdn\/beginner-html-site\/[a-f\d]{40}\//i.test(url.pathname);
      liveReport.requests.push({ host: url.hostname, path: url.pathname, method: request.method(), allowed: approved });
      if (!approved || request.method() !== 'GET' || request.headers().authorization || request.headers().cookie) return route.abort();
      return route.continue();
    });
    const current = await live.newPage(); livePage = current; current.setDefaultTimeout(30000); await current.goto(base + '/#upload', { waitUntil: 'networkidle' });
    await current.getByRole('tab', { name: 'GitHub', exact: true }).click(); await ui.url(current).fill(liveReport.repository); await ui.inspect(current).click(); await ui.selectedFolder(current).waitFor();
    const options = await ui.selectedFolder(current).locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, disabled: node.disabled })));
    const selected = options.find(option => !option.disabled && option.value === '') || options.find(option => !option.disabled); assert.ok(selected, 'MDN public repo has an eligible static root');
    await importSelected(current, selected.value); const liveFrame = current.frameLocator('iframe[sandbox]');
    const heading = await liveFrame.locator('h1').innerText(); assert.ok(heading.trim());
    liveReport.checks.push({ name: 'Live public MDN repository imports and renders its actual heading', passed: true, heading });
    await ui.requirements(current).fill('The imported public starter page shows its own heading.'); await current.getByTestId('plan-technical-editor').locator('summary').click(); await ui.steps(current).first().getByLabel('CSS selector', { exact: true }).fill('h1'); await ui.steps(current).first().getByLabel('Expected text', { exact: true }).fill(heading); await ui.confirm(current).check();
    const accepted = await run(current, 'live-mdn'); assert.equal(accepted.currentRun.status, 'passed'); assert.equal(accepted.currentRun.source?.kind, 'github');
    liveReport.run = { id: accepted.currentRun.id, status: accepted.currentRun.status, source: accepted.currentRun.source, planFingerprint: accepted.currentRun.planFingerprint, projectFingerprint: accepted.currentRun.projectFingerprint, captureAvailable: Boolean(accepted.currentRun.steps[0].capture) };
    liveReport.checks.push({ name: 'Actual imported MDN page passes a user-confirmed assertion with DOM evidence', passed: Boolean(accepted.currentRun.steps[0].capture) });
    assert.ok(liveReport.requests.every(request => request.allowed && request.method === 'GET')); assert.deepEqual(liveErrors, []);
    liveReport.checks.push({ name: 'Live smoke uses only allowlisted public GitHub reads without JavaScript exceptions', passed: true });
    await shot(current, '04-live-mdn-import'); liveReport.passed = true; liveReport.finishedAt = new Date().toISOString(); await live.close();
  }
} catch (error) { report.passed = false; report.error = String(error.stack || error); process.exitCode = 1; console.error(report.error); for (const [label, current] of [['stopped', page], ['live-stopped', livePage]]) if (current && !current.isClosed()) { fs.writeFileSync(path.join(work, `${label}-dom.txt`), await current.locator('body').innerText().catch(() => '')); await shot(current, `${label}-state`).catch(() => {}); } }
finally {
  await browser?.close(); report.finishedAt = new Date().toISOString();
  const destination = report.passed ? out : work; fs.mkdirSync(destination, { recursive: true });
  if (report.passed) for (const name of report.screenshots) fs.copyFileSync(path.join(work, name), path.join(destination, name));
  fs.writeFileSync(path.join(destination, 'report.json'), JSON.stringify(report, null, 2));
  if (liveReport.startedAt) fs.writeFileSync(path.join(destination, 'live-public-report.json'), JSON.stringify(liveReport, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, live: liveReport.passed, report: path.join(destination, 'report.json') }));
}
