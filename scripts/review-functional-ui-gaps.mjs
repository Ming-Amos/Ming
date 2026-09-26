/** Isolated regression checks for editing state and manual acceptance, without model calls. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const port = 4472, targetPort = 4473, base = `http://127.0.0.1:${port}`;
const runtime = path.join(root, 'runtime', `functional-ui-${randomUUID()}`);
fs.mkdirSync(runtime, { recursive: true });
const report = { startedAt: new Date().toISOString(), checks: [], pageErrors: [], ids: {} };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let pauseAfterTwoPages = false, livePageRequests = 0;
const target = http.createServer((req, res) => {
  if (pauseAfterTwoPages && req.url === '/' && ++livePageRequests > 2) return; // Wait for cancellation.
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html lang="en"><title>Editor regression target</title><h1>Ready</h1><label>Task name<input id="task"></label><button id="clear" onclick="document.querySelector(\'#task\').value=\'\'">Clear</button><label>Choice<select id="choice"><option value="first">First</option><option value="">None</option></select></label></html>');
});
let child, browser, page;
function check(label, passed, detail) { report.checks.push({ label, passed: !!passed, ...(detail ? { detail } : {}) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`); }
async function api(route, body) {
  const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const data = await response.json(); if (!response.ok) throw Error(`${route}: ${response.status} ${JSON.stringify(data)}`); return data;
}
async function closeSheet() { await page.getByRole('button', { name: 'Close panel', exact: true }).click(); }
async function importPlan(plan) {
  const details = page.locator('details').filter({ has: page.getByText('Advanced: Import or export a plan', { exact: true }) });
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  await page.getByLabel('Plan JSON', { exact: true }).fill(JSON.stringify(plan));
  await page.getByRole('button', { name: 'Import into editor', exact: true }).click();
}
async function waitRun(id) {
  for (let i = 0; i < 180; i++) { const { run } = await api(`/api/run/${id}`); if (!['pending', 'running'].includes(run.status)) return run; await delay(200); }
  throw Error('Run timed out');
}
try {
  let occupied = false; try { await fetch(base + '/api/capabilities', { signal: AbortSignal.timeout(300) }); occupied = true; } catch {}
  if (occupied) throw Error('Port 4472 is occupied; refusing to attach');
  await new Promise((resolve, reject) => { target.once('error', reject); target.listen(targetPort, '127.0.0.1', resolve); });
  const log = fs.openSync(path.join(runtime, 'server.log'), 'w');
  child = spawn(process.execPath, ['apps/server/dist/index.js'], { cwd: root, windowsHide: true, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MING_RUNTIME_DIR: runtime, MING_TEST_MODE: '1', MING_PUBLIC_DEMO: '0', PROVIDER_API_KEY: '', PROVIDER_BASE_URL: '', PROVIDER_MODEL_ID: '' }, stdio: ['ignore', log, log] }); fs.closeSync(log);
  for (let i = 0; i < 80; i++) { try { await api('/api/capabilities'); break; } catch { await delay(150); } }
  const { project, target: registered } = await api('/api/targets', { name: 'Manual editor regression', kind: 'url', url: `http://127.0.0.1:${targetPort}` });
  report.ids.projectId = project.projectId;
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1484, height: 1060 } }); page.setDefaultTimeout(10000); page.on('pageerror', e => report.pageErrors.push(String(e)));
  await page.goto(base + '/#studio', { waitUntil: 'networkidle' });
  await page.locator('.project-card').getByRole('button', { name: /Open workspace/ }).click();
  await page.getByLabel('Requirements and boundaries', { exact: true }).fill('The task can be cleared and an empty option can be selected.');
  await page.getByRole('button', { name: 'Save requirements', exact: true }).click();
  await page.getByText(/Requirements v1 saved/).waitFor();
  const unsavedText = 'Unfinished notes based on requirements v1';
  await page.getByLabel('Requirements and boundaries', { exact: true }).fill(unsavedText);
  await closeSheet();
  await page.getByRole('button', { name: 'Requirements', exact: true }).click();
  check('An unfinished requirements edit is recovered while its original version remains current', await page.getByLabel('Requirements and boundaries', { exact: true }).inputValue() === unsavedText);
  await closeSheet();
  const updatedText = 'Current requirements from another client: clearing the task produces an empty field, and None selects the empty option.';
  const { requirement: latest } = await api(`/api/projects/${project.projectId}/requirements`, { text: updatedText });
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.locator('.project-card').getByRole('button', { name: /Open workspace/ }).click();
  await page.getByRole('button', { name: 'Requirements', exact: true }).click();
  check('Opening current requirements does not replace a newer server version with an old saved browser copy', await page.getByLabel('Requirements and boundaries', { exact: true }).inputValue() === updatedText);
  // Restore the current version even when running this script against the pre-fix bundle.
  await page.getByLabel('Requirements and boundaries', { exact: true }).fill(updatedText);
  await page.getByRole('button', { name: /Write my own plan/ }).click();
  const imported = { title: 'Imported prerequisite plan', description: 'Verify the current target.', criteria: [{ id: 'AC-01', title: 'The target is ready', description: 'Ready is visible', prerequisites: 'Start the local application first.', steps: [{ id: 'S1', type: 'navigate', url: '{{TARGET_URL}}', description: 'Open target' }, { id: 'S2', type: 'assertVisible', value: 'Ready', description: 'Ready is visible' }] }] };
  const { draft: validImport } = await api('/api/drafts/manual', { projectId: project.projectId, requirementId: latest.requirementId, plan: imported });
  check('Server accepts the prerequisite-bearing plan used by the browser import test', !!validImport.draftId);
  await importPlan(imported);
  check('Plan JSON import accepts the shared-contract text prerequisite field', await page.getByLabel('Plan name', { exact: true }).inputValue() === imported.title);
  await page.getByLabel('Plan name', { exact: true }).fill('Unsaved manual edit');
  await page.keyboard.press('Control+k');
  check('Command shortcut preserves the active plan editor and its unsaved edits', await page.getByLabel('Plan name', { exact: true }).isVisible() && await page.getByLabel('Plan name', { exact: true }).inputValue() === 'Unsaved manual edit');
  if (!(await page.getByLabel('Plan name', { exact: true }).isVisible())) {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /2\. Create plan/ }).click();
  }
  const emptyPlan = { title: 'Empty controls remain testable', description: 'Clearing inputs and selecting the empty option are valid user flows.', criteria: [{ id: 'AC-01', title: 'Clear a task and select None', description: 'The cleared field and selected option both contain the empty string.', steps: [
    { id: 'S1', type: 'navigate', url: '{{TARGET_URL}}', description: 'Open the app' },
    { id: 'S2', type: 'fill', locator: 'Task name', value: 'Temporary task', description: 'Enter a task' },
    { id: 'S3', type: 'click', locator: 'Clear', description: 'Clear the field' },
    { id: 'S4', type: 'assertValue', locator: 'Task name', value: '', description: 'The field is empty' },
    { id: 'S5', type: 'selectOption', locator: 'Choice', value: '', description: 'Select None' },
    { id: 'S6', type: 'assertValue', locator: 'Choice', value: '', description: 'The empty option is selected' },
  ] }] };
  await importPlan({ ...emptyPlan, planId: 'imported-plan-identity', fingerprint: 'preserved-only-in-original', source: 'manual' });
  const draftResponse = page.waitForResponse(r => r.url() === base + '/api/drafts/manual' && r.request().method() === 'POST', { timeout: 1500 }).catch(() => null);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  const response = await draftResponse;
  check('Manual editor saves empty-value assertions and empty select options', response?.status() === 200, response ? undefined : await page.getByRole('alert').innerText());
  if (response?.ok()) {
    const submitted = response.request().postDataJSON();
    check('Importing a complete plan keeps server-owned identities out of the new draft', Object.keys(submitted.plan).sort().join(',') === 'criteria,description,title');
    report.ids.draftId = (await response.json()).draft.draftId;
    await page.getByRole('button', { name: 'Confirm plan', exact: true }).click();
    await page.getByRole('button', { name: 'Run checks', exact: true }).waitFor();
    const launched = page.waitForResponse(r => r.url() === base + '/api/run-confirmed' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Run checks', exact: true }).click();
    const { runId } = await (await launched).json(); const run = await waitRun(runId); report.ids.runId = runId;
    check('The confirmed empty-field plan passes all six real browser operations without a model', run.status === 'passed' && run.criteria[0].steps.length === 6 && run.criteria[0].steps.every(s => s.status === 'passed'));
    await page.locator('.evidence-footer code').filter({ hasText: runId.slice(0, 10) }).waitFor();
    await page.screenshot({ path: path.join(runtime, 'empty-field-accepted.png'), fullPage: true });

    await page.getByRole('button', { name: 'Edit plan', exact: true }).click();
    const livePlan = { title: 'Observe completed work before cancellation', description: 'Completed actions remain visible while a later navigation waits.', criteria: [
      { id: 'LIVE-01', title: 'The starting page is ready', description: 'Ready is visible before continuing.', steps: [
        { id: 'S1', type: 'navigate', url: '{{TARGET_URL}}', description: 'Open the starting page' },
        { id: 'S2', type: 'assertVisible', value: 'Ready', description: 'Record the starting page' },
      ] },
      { id: 'LIVE-02', title: 'Later navigation can be cancelled', description: 'Keep evidence of the completed actions when stopping a later page load.', steps: [
        { id: 'S1', type: 'navigate', url: '{{TARGET_URL}}', description: 'Open the next criterion' },
        { id: 'S2', type: 'fill', locator: 'Task name', value: 'Visible before stopping', description: 'Fill before waiting' },
        { id: 'S3', type: 'assertValue', locator: 'Task name', value: 'Visible before stopping', description: 'Record the entered value' },
        { id: 'S4', type: 'navigate', url: '{{TARGET_URL}}', description: 'Wait for the slow page' },
        { id: 'S5', type: 'assertVisible', value: 'Never reached', description: 'Unexecuted future assertion' },
      ] },
    ] };
    await importPlan(livePlan);
    await page.getByRole('button', { name: 'Save revision', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm plan', exact: true }).click();
    pauseAfterTwoPages = true;
    const waitingLaunch = page.waitForResponse(r => r.url() === base + '/api/run-confirmed' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Run checks', exact: true }).click();
    const { runId: waitingId } = await (await waitingLaunch).json(); report.ids.cancelledLiveRunId = waitingId;
    let live;
    for (let i = 0; i < 40; i++) {
      live = (await api(`/api/run/${waitingId}`)).run;
      if (live.criteria[1]?.steps[2]?.status === 'passed') break;
      await delay(100);
    }
    check('The backend exposes completed steps while a later navigation is still waiting', live.status === 'running' && live.criteria[0].status === 'passed' && live.criteria[1].steps[2].status === 'passed');
    await page.locator('.trace-step').filter({ hasText: 'Record the entered value' }).waitFor({ timeout: 2500 }).catch(() => {});
    const trace = page.locator('.proof-timeline');
    const liveVisible = await trace.isVisible();
    check('Completed actions and a captured screenshot appear before the run finishes', liveVisible && await page.locator('.evidence-column img').count() > 0 && await page.getByRole('button', { name: 'Stop checks', exact: true }).isVisible());
    if (liveVisible) await page.screenshot({ path: path.join(runtime, 'live-captured-evidence.png'), fullPage: true });
    check('The live timeline excludes pending future actions', liveVisible && await trace.locator('.trace-step').count() === 5 && await trace.locator('.trace-step').filter({ hasText: 'Unexecuted future assertion' }).count() === 0);
    check('Automatic recorded replay is disabled during a live run', liveVisible && await trace.getByRole('button', { name: 'Play recorded steps', exact: true }).isDisabled());
    if (liveVisible) {
      await trace.locator('.trace-step').filter({ hasText: 'Fill before waiting' }).click();
      await delay(1100);
      check('Refreshing live results preserves the selected criterion and step', await trace.locator('[aria-current="step"]').innerText().then(text => text.includes('Fill before waiting')) && await page.locator('.actual-block').innerText().then(text => text.includes('Entered text')));
      await page.screenshot({ path: path.join(runtime, 'live-recorded-actions.png'), fullPage: true });
    }
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Stop checks', exact: true }).waitFor();
    await page.locator('.trace-step').filter({ hasText: 'Record the entered value' }).waitFor({ timeout: 2500 }).catch(() => {});
    check('Reload recovers the same live run and its already recorded actions', await page.locator('.trace-step').count() === 5);
    await page.getByRole('button', { name: 'Stop checks', exact: true }).click();
    const cancelled = await waitRun(waitingId);
    await page.getByRole('button', { name: 'Run again', exact: true }).waitFor();
    check('Cancellation preserves completed criteria and completed steps in the unfinished criterion', cancelled.status === 'error' && cancelled.terminationReason === 'cancelled' && cancelled.criteria[0].status === 'passed' && cancelled.criteria[1].steps.slice(0, 3).every(s => s.status === 'passed') && cancelled.criteria[1].steps[4].status === 'skipped');
    const recordedCount = cancelled.criteria.flatMap(c => c.steps).filter(s => ['passed', 'failed', 'error'].includes(s.status)).length;
    check('Cancelled replay counts only actions with actual results and excludes skipped steps', await page.locator('.trace-step').count() === recordedCount && await page.locator('.trace-step').filter({ hasText: 'Unexecuted future assertion' }).count() === 0);
  }
  check('No uncaught browser exceptions across the regression flows', report.pageErrors.length === 0);
} catch (error) { report.error = String(error.stack || error); console.error(report.error); }
finally {
  report.finishedAt = new Date().toISOString(); report.passed = !report.error && report.checks.every(c => c.passed);
  fs.writeFileSync(path.join(runtime, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close(); child?.kill(); target.closeAllConnections(); await new Promise(resolve => target.close(resolve));
  console.log('REPORT ' + path.join(runtime, 'report.json')); if (!report.passed) process.exitCode = 1;
}
