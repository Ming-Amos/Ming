/** Codex full UI integration. Local fixture transport only; no model/Bob calls.
 * Requires built web/server. Uses its own server, runtime, browser profile and port.
 * Does not edit any example source or simulate a successful agent repair.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const port = Number(process.env.MING_REVIEW_PORT ?? 4416), base = `http://127.0.0.1:${port}`;
const reviewId = randomUUID(), runtime = path.join(root, `runtime/xray-ui-${reviewId}`);
const shots = path.join(runtime, 'ui-screenshots'); fs.mkdirSync(shots, { recursive: true });
const report = { author: 'Codex', reviewId, startedAt: new Date().toISOString(), base,
  scope: 'Real UI and browser runs; local explicitly labelled test transport; no live model or Bob calls; no sample source mutations', checks: [], ids: {}, pageErrors: [] };
const sourceHash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const buggyPath = path.join(root, 'examples/daily-report/buggy/index.html');
const initialBuggyHash = sourceHash(buggyPath);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(label, condition) {
  report.checks.push({ label, passed: Boolean(condition) }); console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) throw Error(label);
}
async function api(method, route, body) {
  const res = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw Error(`${route}: ${JSON.stringify(data)}`);
  return data;
}
async function waitRun(runId) {
  for (let i = 0; i < 240; i++) {
    const { progress } = await api('GET', `/api/run/${runId}/progress`);
    if (['passed', 'failed', 'error'].includes(progress.status)) return (await api('GET', `/api/run/${runId}`)).run;
    await delay(125);
  }
  throw Error(`Run ${runId} timeout`);
}
let child, browser, page;
async function postByClick(route, button) {
  const responsePromise = page.waitForResponse(r => r.url() === base + route && r.request().method() === 'POST', { timeout: 20000 });
  await button.click(); const response = await responsePromise;
  return { status: response.status(), data: await response.json(), sent: response.request().postDataJSON() };
}
async function waitDisplayed(run) {
  await page.locator('.evidence-footer code').filter({ hasText: run.runId.slice(0, 10) }).waitFor({ timeout: 20000 });
}
async function evidenceImages(runId, label) {
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('.evidence-column img')];
    return images.length > 0 && images.every(i => i.complete && i.naturalWidth > 0);
  });
  const images = await page.locator('.evidence-column img').evaluateAll(items => items.map(i => ({ src: i.src, width: i.naturalWidth, alt: i.alt })));
  check(`${label}: loaded screenshot URLs belong to displayed run`, images.length > 0 && images.every(i => i.src.includes(runId) && i.width > 0));
  for (const item of images) {
    const response = await fetch(item.src); check(`${label}: actual PNG evidence is served`, response.ok && response.headers.get('content-type')?.includes('image/png'));
  }
}
try {
  let occupied = false;
  try { await fetch(base + '/api/capabilities', { signal: AbortSignal.timeout(500) }); occupied = true; } catch {}
  if (occupied) throw Error(`Review port ${port} occupied; refusing to attach`);
  const logs = fs.openSync(path.join(runtime, 'server.log'), 'w');
  child = spawn(process.execPath, ['apps/server/dist/index.js'], { cwd: root, windowsHide: true,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MING_RUNTIME_DIR: runtime, MING_TEST_MODE: '1', MING_PUBLIC_DEMO: '0', PROVIDER_API_KEY: '', PROVIDER_BASE_URL: '', PROVIDER_MODEL_ID: '' }, stdio: ['ignore', logs, logs] });
  fs.closeSync(logs);
  for (let i = 0; i < 60; i++) { try { await api('GET', '/api/capabilities'); break; } catch { await delay(100); } }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.pageErrors.push(String(error)));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1, name: /看见功能背后的每一步/ }).waitFor();
  check('Initial sample target is buggy', await page.getByLabel('验收项目', { exact: true }).inputValue() === 'buggy');
  check('Execution disabled until explicit confirmation', await page.getByRole('button', { name: '开始验收', exact: true }).isDisabled());
  check('Fixture provenance visible before execution', await page.getByText('预设演示计划 · 无模型调用', { exact: true }).isVisible());
  await page.getByRole('button', { name: '确认验收标准', exact: true }).click();
  check('Confirmation enables execution', await page.getByRole('button', { name: '开始验收', exact: true }).isEnabled());
  const launched = await postByClick('/api/run', page.getByRole('button', { name: '开始验收', exact: true }));
  check('UI sends explicit plan confirmation', launched.status === 200 && launched.sent.confirmed === true && !!launched.sent.confirmedPlanFingerprint);
  const buggy = await waitRun(launched.data.runId); report.ids.buggyRun = buggy.runId;
  await waitDisplayed(buggy);
  check('Buggy browser run fails persistence only', buggy.status === 'failed' && buggy.criteria[0].status === 'passed' && buggy.criteria[1].status === 'failed' && buggy.criteria[2].status === 'passed');
  check('UI selects real AC-02 failure', await page.locator('.criterion-button[aria-pressed="true"]').innerText().then(t => t.includes('AC-02')) && await page.locator('.evidence-verdict').innerText().then(t => t.includes('验收未通过')));
  await evidenceImages(buggy.runId, 'Buggy run');
  await page.screenshot({ path: path.join(shots, '01-buggy-failure.png'), fullPage: true });
  const created = await postByClick('/api/repair-tasks', page.getByRole('button', { name: '创建 AI 修复任务', exact: true }));
  report.ids.repairTask = created.data.task?.taskId;
  check('Repair creation records waiting, not repaired', created.status === 200 && created.data.task.status === 'waiting' && !created.data.task.rerunId);
  const handoff = page.getByLabel('AI 修复交接指令'); await handoff.waitFor();
  const prompt = await handoff.inputValue();
  check('English handoff includes exact task, baseline and plan', prompt.includes(created.data.task.taskId) && prompt.includes(buggy.runId) && prompt.includes(buggy.planFingerprint) && prompt.includes('ming_get_repair_task'));
  check('UI makes agent handoff explicit', await page.getByText(/创建任务不会自动唤醒 AI/).isVisible());
  await page.getByRole('button', { name: '关闭面板', exact: true }).click();
  await page.reload({ waitUntil: 'networkidle' }); await waitDisplayed(buggy);
  check('Reload restores task status and baseline', await page.locator('.task-state').innerText().then(t => t.includes('等待 AI 接手') && t.includes(created.data.task.taskId.slice(0, 10))));
  check('Reload retains prior confirmed sample plan for a matching rerun', await page.getByRole('button', { name: '再次验收', exact: true }).isEnabled());
  await evidenceImages(buggy.runId, 'Restored baseline');
  await page.setViewportSize({ width: 390, height: 844 });
  check('Narrow workspace has no horizontal page overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  await page.screenshot({ path: path.join(shots, '02-narrow-restored.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '自定义需求', exact: true }).click();
  await page.getByRole('button', { name: '用自己的需求', exact: true }).click();
  await page.locator('dialog').getByRole('combobox').selectOption('normal');
  await page.getByLabel('项目名称', { exact: true }).fill('UI integration - confirmed reports');
  const requirementText = `UI proof ${reviewId}: Non-empty reports appear in the list and survive refresh. Empty input must not create records.`;
  await page.getByLabel('需求与验收边界', { exact: true }).fill(requirementText);
  const unconfigured = await postByClick('/api/generate', page.getByRole('button', { name: '生成验收草稿', exact: true }));
  check('Missing model returns explicit 503 without fallback', unconfigured.status === 503 && unconfigured.data.notConfigured === true);
  check('Missing model message visible inside setup', await page.locator('dialog [role="alert"]').innerText().then(t => t.includes('模型未配置')));
  await page.screenshot({ path: path.join(shots, '03-model-unconfigured.png'), fullPage: true });
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/stage-a-plan.json'), 'utf8'));
  fixture.source = 'generated'; fixture.title = 'UI reviewed daily-report plan'; delete fixture.fingerprint;
  await api('POST', '/admin/test-fixture', { mode: 'plan', plan: fixture });
  const generated = await postByClick('/api/generate', page.getByRole('button', { name: '生成验收草稿', exact: true }));
  const draft = generated.data.draft; report.ids.draft = draft?.draftId;
  await page.locator('dialog').waitFor({ state: 'detached' });
  check('Draft retains test provenance and requirement', generated.status === 200 && draft.plan.transportProvenance === 'test' && draft.usage.isLive === false && draft.plan.originalRequirement === requirementText);
  check('UI labels generated test plan as non-live', await page.getByText('测试传输生成 · 非真实模型', { exact: true }).isVisible());
  check('Draft exposes all three criteria for review', await page.locator('.criterion-button').count() === 3);
  check('Generated plan also cannot run before confirmation', await page.getByRole('button', { name: '开始验收', exact: true }).isDisabled());
  const confirmed = await postByClick('/api/confirm', page.getByRole('button', { name: '确认验收标准', exact: true }));
  const confirmation = confirmed.data.confirmation; report.ids.confirmation = confirmation?.confirmationId;
  check('UI confirms the exact displayed fingerprint', confirmed.status === 200 && confirmed.sent.displayedPlanFingerprint === draft.plan.fingerprint && confirmation.planFingerprint === draft.plan.fingerprint);
  const firstResponse = await postByClick('/api/run-confirmed', page.getByRole('button', { name: '开始验收', exact: true }));
  const first = await waitRun(firstResponse.data.runId); report.ids.generatedFirst = first.runId; await waitDisplayed(first);
  check('Confirmed generated test plan passes all real browser checks', first.status === 'passed' && first.criteria.length === 3 && first.criteria.every(c => c.status === 'passed'));
  check('Real run links exact requirement and confirmation', first.confirmationId === confirmation.confirmationId && first.requirementId === draft.requirementId);
  await evidenceImages(first.runId, 'Generated plan run');
  check('Repeat acceptance remains enabled', await page.getByRole('button', { name: '再次验收', exact: true }).isEnabled());
  const firstBytes = fs.readFileSync(path.join(runtime, 'runs', `${first.runId}.json`), 'utf8');
  const secondResponse = await postByClick('/api/run-confirmed', page.getByRole('button', { name: '再次验收', exact: true }));
  const second = await waitRun(secondResponse.data.runId); report.ids.generatedRerun = second.runId; await waitDisplayed(second);
  check('Rerun uses same confirmation but creates a new run', second.runId !== first.runId && secondResponse.sent.confirmationId === confirmation.confirmationId && second.confirmationId === first.confirmationId);
  check('Rerun passes same complete plan and runner', second.status === 'passed' && second.planFingerprint === first.planFingerprint && second.runnerFingerprint === first.runnerFingerprint && second.criteria.length === first.criteria.length);
  check('First generated run evidence remains unchanged', firstBytes === fs.readFileSync(path.join(runtime, 'runs', `${first.runId}.json`), 'utf8'));
  await evidenceImages(second.runId, 'Generated rerun');
  await page.screenshot({ path: path.join(shots, '04-generated-rerun.png'), fullPage: true });
  await page.getByRole('button', { name: '验收记录', exact: true }).click();
  await page.locator('dialog .history-item').filter({ hasText: buggy.runId.slice(0, 10) }).click(); await waitDisplayed(buggy);
  check('History restores fixture target and provenance', await page.getByLabel('验收项目', { exact: true }).inputValue() === 'buggy' && await page.getByText('预设演示计划 · 无模型调用', { exact: true }).isVisible());
  check('History does not borrow generated requirement', !(await page.locator('.requirement-panel').innerText()).includes(requirementText));
  await page.getByRole('button', { name: '验收记录', exact: true }).click();
  await page.locator('dialog .history-item').filter({ hasText: second.runId.slice(0, 10) }).click(); await waitDisplayed(second);
  check('Generated history restores matching target and provenance', await page.getByLabel('验收项目', { exact: true }).inputValue() === 'normal' && await page.getByText('测试传输生成 · 非真实模型', { exact: true }).isVisible());
  await page.getByText('查看完整需求', { exact: true }).click();
  check('Generated history restores the original requirement text', await page.locator('.requirement-text').innerText() === requirementText);
  await page.reload({ waitUntil: 'networkidle' }); await waitDisplayed(second);
  check('Generated confirmation and rerun ability survive reload', await page.getByRole('button', { name: '再次验收', exact: true }).isEnabled());
  check('No browser JavaScript exceptions', report.pageErrors.length === 0);
  check('Original buggy sample source was never changed', sourceHash(buggyPath) === initialBuggyHash);
  report.passed = true;
} catch (error) {
  report.passed = false; report.error = String(error); console.error(error); process.exitCode = 1;
  if (page) try { await page.screenshot({ path: path.join(shots, 'failure.png'), fullPage: true }); } catch {}
} finally {
  if (browser) await browser.close();
  if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
  report.finishedAt = new Date().toISOString();
  const file = path.join(runtime, 'review-report.json'); fs.writeFileSync(file, JSON.stringify(report, null, 2)); console.log(`REPORT ${file}`);
}
