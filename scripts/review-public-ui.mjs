/** Browser QA of the compiled read-only Worker and preserved real evidence. No deployment. */
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
const out = path.join(root, 'runtime', `public-ui-${randomUUID()}`);
fs.mkdirSync(out, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/demo-evidence/manifest.json'), 'utf8'));
const bundle = JSON.parse(fs.readFileSync(path.join(root, 'docs/demo-evidence/api-responses.json'), 'utf8'));
const port = Number(process.env.MING_PREVIEW_PORT || '4482');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port');
const base = `http://127.0.0.1:${port}`;
const results = [], errors = [], requests = [];
const check = (name, passed, detail) => {
  results.push({ name, passed: !!passed, ...(detail ? { detail } : {}) });
  if (!passed) throw new Error(name);
};
const hash = data => createHash('sha256').update(data).digest('hex');
const compare = (name, actual, expected) => { assert.deepEqual(actual, expected, name); check(name, true); };
const preview = spawn(process.execPath, [path.join(root, 'scripts/public-demo/preview.mjs')], {
  cwd: root, env: { ...process.env, MING_PREVIEW_PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
const log = fs.createWriteStream(path.join(out, 'preview.log'));
preview.stdout.pipe(log); preview.stderr.pipe(log);
let browser;
try {
  // Only this child may own the test port; don't silently reuse another application.
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Owned preview did not start')), 12_000);
    preview.once('exit', code => { clearTimeout(timeout); reject(new Error(`Owned preview exited: ${code}`)); });
    preview.once('error', error => { clearTimeout(timeout); reject(error); });
    preview.stdout.on('data', data => { if (String(data).includes(`127.0.0.1:${port}`)) { clearTimeout(timeout); resolve(); } });
  });
  compare('Published history equals the reviewed wire response', await (await fetch(base + '/api/history')).json(), bundle.responses['/api/history']);
  for (const id of [manifest.featuredBaselineRunId, manifest.featuredRerunId]) {
    compare(`Recorded run remains exact: ${id}`, await (await fetch(base + `/api/run/${id}`)).json(), bundle.responses[`/api/run/${id}`]);
  }
  const comparisonResponse = await (await fetch(base + `/api/repair-tasks/${manifest.taskId}/comparison`)).json();
  compare('Repair comparison is served unchanged', comparisonResponse.comparison, manifest.comparison);
  let screenshotCount = 0;
  for (const [relative, expectedHash] of Object.entries(manifest.files).filter(([name]) => name.startsWith('runtime/screenshots/'))) {
    const response = await fetch(base + '/api/screenshots/' + path.basename(relative));
    assert.equal(response.status, 200); assert.equal(hash(Buffer.from(await response.arrayBuffer())), expectedHash); screenshotCount++;
  }
  check('All 19 public screenshots match original manifest hashes', screenshotCount === 19);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1484, height: 1060 }, acceptDownloads: true });
  page.setDefaultTimeout(15_000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().startsWith(base + '/api/')) requests.push({ method: request.method(), path: new URL(request.url()).pathname }); });
  await page.goto(base);
  await page.getByText('公开演示 · 真实历史运行，只读回放', { exact: true }).waitFor();
  check('Public mode is visibly labelled read-only', true);
  check('Live execution button is disabled', await page.getByRole('button', { name: '历史运行回放', exact: true }).isDisabled());
  check('New project registration is unavailable', await page.getByRole('button', { name: '接入你的项目', exact: true }).count() === 0);
  await page.getByRole('button', { name: '验收记录', exact: true }).click();
  await page.getByLabel('搜索验收记录').fill(manifest.featuredBaselineRunId.slice(0, 10));
  check('History search isolates the original baseline', await page.locator('dialog[open] .history-item').count() === 1);
  await page.locator('dialog[open] .history-item').click();
  await page.getByRole('button').filter({ hasText: 'AC-02' }).click();
  await page.locator('.evidence-link img').first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.evidence-link img')].every(image => image.complete && image.naturalWidth > 0));
  check('Baseline images belong to the selected real run', await page.locator('.evidence-link img').evaluateAll((images, id) => images.length >= 2 && images.every(image => image.src.includes(id)), manifest.featuredBaselineRunId));
  await page.screenshot({ path: path.join(out, 'baseline-desktop.png') });
  await page.screenshot({ path: path.join(out, 'baseline-full.png'), fullPage: true });
  await page.getByRole('button', { name: '查看修复前后对照' }).click();
  await page.getByRole('heading', { name: '已验证修复', exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('dialog[open] img')].every(image => image.complete && image.naturalWidth > 0));
  check('Comparison shows original before/after image identities', await page.locator('dialog[open] img').evaluateAll((images, ids) => ids.every(id => images.some(image => image.src.includes(id))), [manifest.featuredBaselineRunId, manifest.featuredRerunId]));
  check('Comparison shows both source fingerprints', await page.getByText(manifest.comparison.baselineTargetFingerprint.slice(0, 10), { exact: true }).isVisible() && await page.getByText(manifest.comparison.repairedTargetFingerprint.slice(0, 10), { exact: true }).isVisible());
  await page.screenshot({ path: path.join(out, 'comparison-desktop.png') });
  await page.getByRole('button', { name: '查看修改后的完整运行与截图' }).click();
  await page.getByRole('button', { name: '查看修复前后对照' }).waitFor();
  check('Opening the rerun retains comparison access', true);
  await page.reload();
  await page.getByRole('button', { name: '查看修复前后对照' }).waitFor();
  await page.locator('.evidence-link img').first().waitFor();
  check('Reload restores the recorded rerun', (await page.locator('.evidence-link img').first().getAttribute('src')).includes(manifest.featuredRerunId));
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出记录', exact: true }).click();
  const download = await downloadPromise; const exported = path.join(out, 'reviewed-rerun-export.json'); await download.saveAs(exported);
  compare('Read-only JSON export matches the selected preserved run', JSON.parse(fs.readFileSync(exported, 'utf8')), bundle.responses[`/api/run/${manifest.featuredRerunId}`].run);
  await page.getByRole('button', { name: '模型未配置', exact: true }).click();
  await page.getByText('这是只读演示，不能保存密钥或调用模型。请在本地运行 Ming 后配置。').waitFor();
  check('Read-only model help exposes no key or configuration inputs', await page.locator('dialog[open] input').count() === 0);
  await page.screenshot({ path: path.join(out, 'model-readonly.png') });
  await page.getByRole('button', { name: '关闭模型设置' }).click();
  await page.getByRole('button', { name: '连接编码 AI', exact: true }).click();
  await page.getByRole('heading', { name: '让编码 AI 调用 Ming', exact: true }).waitFor();
  check('AI help explains local-only execution and 12-tool workflow', (await page.locator('dialog[open]').innerText()).includes('只读演示') && (await page.getByLabel('AI 工作说明').inputValue()).includes('ming_run_acceptance'));
  await page.screenshot({ path: path.join(out, 'ai-help-readonly.png') });
  await page.getByRole('button', { name: '关闭面板', exact: true }).click();
  await page.getByLabel('验收项目', { exact: true }).selectOption('todo-buggy');
  await page.getByRole('button').filter({ hasText: 'TODO-03' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.evidence-link img')].every(image => image.complete && image.naturalWidth > 0));
  const todoRun = bundle.responses['/api/history'].runs.find(run => run.targetVariant === 'todo-buggy');
  check('Switching projects selects the independent recorded todo evidence', await page.locator('.evidence-link img').evaluateAll((images, id) => images.length > 0 && images.every(image => image.src.includes(id)), todoRun.runId));
  await page.screenshot({ path: path.join(out, 'todo-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, 'mobile.png'), fullPage: true });
  check('390px workspace has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: '验收记录', exact: true }).click();
  check('390px history dialog fits the viewport', await page.locator('dialog[open]').evaluate(dialog => dialog.getBoundingClientRect().left >= 0 && dialog.getBoundingClientRect().right <= innerWidth));
  await page.screenshot({ path: path.join(out, 'mobile-history.png') });
  await page.getByRole('button', { name: '关闭面板', exact: true }).click();
  check('Browsing/export/help makes no mutation requests', requests.every(request => request.method === 'GET'));
  for (const [method, endpoint] of [['POST', '/api/run'], ['POST', '/api/provider/test'], ['PUT', '/api/provider/config'], ['DELETE', '/api/provider/config'], ['POST', '/api/repair-tasks']]) {
    const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: '{}' });
    check(`Public Worker rejects ${method} ${endpoint}`, response.status === 403);
  }
  check('No frontend JavaScript errors', errors.length === 0);
  console.log(JSON.stringify({ passed: results.length, failed: 0, report: path.join(out, 'report.json') }));
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ reviewedAt: new Date().toISOString(), base, baselineRunId: manifest.featuredBaselineRunId, rerunId: manifest.featuredRerunId, results, errors, requests }, null, 2));
  await browser?.close();
  if (preview.exitCode === null) {
    preview.kill();
    await new Promise(resolve => { const deadline = setTimeout(resolve, 5000); preview.once('exit', () => { clearTimeout(deadline); resolve(); }); });
  }
  log.end();
}
