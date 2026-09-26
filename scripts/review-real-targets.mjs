/** Real local-project integration. No external network, model calls, Bob calls or sample edits. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reviewId = randomUUID(), runtime = path.join(root, 'runtime', `real-targets-${reviewId}`);
const source = fs.mkdtempSync(path.join(os.tmpdir(), 'ming-real-project-'));
const port = Number(process.env.MING_REVIEW_PORT ?? 4418), base = `http://127.0.0.1:${port}`;
fs.mkdirSync(runtime, { recursive: true });
const report = { reviewId, startedAt: new Date().toISOString(), runtime, source, scope: 'Real third multi-file local web project, manual plan lifecycle, URL observation, cancellation, archive, restart. No live model or Bob.', checks: [], ids: {} };
const wait = ms => new Promise(r => setTimeout(r, ms));
function check(label, passed) { report.checks.push({ label, passed: Boolean(passed) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`); if (!passed) throw Error(label); }
async function api(method, endpoint, body, expect = 200) {
  const res = await fetch(base + endpoint, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  const data = await res.json();
  if (res.status !== expect) throw Error(`${method} ${endpoint}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}
async function terminal(id) {
  for (let i = 0; i < 240; i++) {
    const { progress } = await api('GET', `/api/run/${id}/progress`);
    if (['passed', 'failed', 'error'].includes(progress.status)) return (await api('GET', `/api/run/${id}`)).run;
    await wait(75);
  }
  throw Error('Run did not terminate');
}
const html = `<!doctype html><title>Field Notes</title><link rel="stylesheet" href="/style.css"><h1>Field Notes</h1><label for="note">New note</label><input id="note"><button id="save">Save note</button><ul id="notes"></ul><p id="health">Needs repair</p><script src="/app.js"></script>`;
const script = `async function refresh(){const a=await(await fetch('/api/notes')).json();document.querySelector('#notes').replaceChildren(...a.map(x=>{const li=document.createElement('li');li.textContent=x;return li}));}document.querySelector('#save').onclick=async()=>{await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:document.querySelector('#note').value})});await refresh()};refresh();`;
fs.writeFileSync(path.join(source, 'index.html'), html);
fs.writeFileSync(path.join(source, 'app.js'), script);
fs.writeFileSync(path.join(source, 'style.css'), 'body{font:18px Arial;padding:30px}');
fs.writeFileSync(path.join(source, '.env'), 'TEST_SECRET=excluded-from-source-hash');
let notes = [], requests = [], child, remoteHits = 0;
const localApp = http.createServer(async (req, res) => {
  requests.push(req.url);
  if (req.url === '/redirect') { res.writeHead(302, { location: `http://127.0.0.1:${trap.address().port}/escaped` }); res.end(); return; }
  if (req.url === '/api/notes') {
    if (req.method === 'POST') { let raw = ''; for await (const c of req) raw += c; notes.push(JSON.parse(raw).text); }
    await wait(60); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(notes)); return;
  }
  const filename = req.url?.split('?')[0] === '/app.js' ? 'app.js' : req.url?.split('?')[0] === '/style.css' ? 'style.css' : 'index.html';
  res.setHeader('content-type', filename.endsWith('.js') ? 'application/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(path.join(source, filename)));
});
const trap = http.createServer((_req, res) => { remoteHits++; res.end('must not be contacted'); });
await new Promise(resolve => localApp.listen(0, '127.0.0.1', resolve));
await new Promise(resolve => trap.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${localApp.address().port}/`;
async function stopServer() {
  if (!child || child.exitCode !== null) return;
  const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill(); await stopped;
}
async function startServer() {
  let occupied = false; try { await fetch(base + '/api/capabilities', { signal: AbortSignal.timeout(300) }); occupied = true; } catch {}
  if (occupied) throw Error('Refuse occupied review port');
  const log = fs.openSync(path.join(runtime, 'server.log'), 'a');
  child = spawn(process.execPath, ['apps/server/dist/index.js'], { cwd: root, windowsHide: true, env: { ...process.env, PORT: String(port), MING_RUNTIME_DIR: runtime, MING_PUBLIC_DEMO: '0', MING_TEST_MODE: '0', PROVIDER_API_KEY: '', PROVIDER_BASE_URL: '', PROVIDER_MODEL_ID: '' }, stdio: ['ignore', log, log] });
  fs.closeSync(log);
  for (let i = 0; i < 100; i++) { try { await api('GET', '/api/capabilities'); return; } catch { await wait(75); } }
  throw Error('Review server failed to start');
}
const criteria = [
  { id: 'NOTE-01', title: 'Save a new note', description: 'Persist the unique note through the actual API', steps: [
    { id: 'N1', type: 'navigate', url: '{{TARGET_URL}}', description: 'Open the local app' },
    { id: 'N2', type: 'fill', locator: 'New note', value: '{{UNIQUE_CONTENT}}', description: 'Enter a unique note' },
    { id: 'N3', type: 'click', locator: 'Save note', description: 'Save through the API' },
    { id: 'N4', type: 'assertVisibleIn', locator: '#notes', value: '{{UNIQUE_CONTENT}}', description: 'The saved note is visible' },
  ] },
  { id: 'NOTE-02', title: 'Reload preserves the saved note', description: 'Check the same note after reload', contextMode: 'inherit', dependsOn: ['NOTE-01'], steps: [
    { id: 'N5', type: 'reload', description: 'Reload the same browser' },
    { id: 'N6', type: 'assertVisibleIn', locator: '#notes', value: '{{UNIQUE_CONTENT}}', description: 'The note is still visible' },
  ] },
];
async function manual(project, requirement, cs = criteria, title = 'Field Notes acceptance') {
  return (await api('POST', '/api/drafts/manual', { projectId: project.projectId, requirementId: requirement.requirementId, plan: { title, description: 'User authored checks for the independent project', criteria: cs } })).draft;
}
async function confirm(draft) { return (await api('POST', '/api/confirm', { draftId: draft.draftId, displayedPlanFingerprint: draft.plan.fingerprint })).confirmation; }
try {
  await startServer();
  for (const invalidUrl of ['https://127.0.0.1:5173/', 'http://example.com:5173/', 'http://user:pass@localhost:5173/', 'http://localhost:80/', 'http://localhost:4000/', `http://localhost:${port}/`]) await api('POST', '/api/targets', { name: 'Invalid', kind: 'url', url: invalidUrl }, 400);
  check('Reject remote/credential/privileged/Ming addresses', true);
  const { target, project } = await api('POST', '/api/targets', { name: 'Field Notes — real project', kind: 'url', url, sourceDir: source });
  report.ids.projectId = project.projectId; report.ids.variant = target.variant;
  check('Register an independent multi-file local project', target.kind === 'url' && !target.isSample && target.projectId === project.projectId && target.sourceBinding === 'live-url-observed');
  check('Custom target has no fabricated sample plan', (await api('GET', `/api/plan?variant=${target.variant}`)).plan === null);
  await api('POST', '/api/run', { variant: target.variant, confirmed: true }, 400);
  check('Custom target cannot bypass confirmation through fixture API', true);
  const probe = await api('POST', `/api/targets/${target.variant}/probe`, {});
  check('Actual target probe returns page title and accessible control', probe.reachable && probe.context.title === 'Field Notes' && probe.context.elements.some(e => e.label === 'New note'));
  const before = (await api('GET', '/api/targets')).targets.find(t => t.variant === target.variant).fingerprint;
  fs.writeFileSync(path.join(source, '.env'), 'TEST_SECRET=new-excluded-value');
  check('Source observation excludes .env contents', (await api('GET', '/api/targets')).targets.find(t => t.variant === target.variant).fingerprint === before);
  const requirement = (await api('POST', `/api/projects/${project.projectId}/requirements`, { text: 'Saving a new note displays it. Reloading the page preserves that same note.' })).requirement;
  await api('POST', '/api/drafts/manual', { projectId: project.projectId, requirementId: requirement.requirementId, plan: { title: 'No assertion', description: '', criteria: [{ ...criteria[0], steps: [criteria[0].steps[0]] }] } }, 422);
  check('Manual plan cannot save a criterion without an assertion', true);
  await api('POST', '/api/drafts/manual', { projectId: project.projectId, requirementId: requirement.requirementId, plan: { title: 'Oversized', description: '', criteria: Array.from({ length: 21 }, (_, i) => ({ ...criteria[0], id: `C${i}` })) } }, 422);
  await api('POST', '/api/drafts/manual', { projectId: project.projectId, requirementId: requirement.requirementId, plan: { title: 'Unsafe ID', description: '', criteria: [{ ...criteria[0], id: '../escape' }] } }, 422);
  check('Manual plan rejects oversized work and path-like criterion identifiers', true);
  const draft = await manual(project, requirement), confirmation = await confirm(draft);
  check('Manual draft links original requirement and claims no model generation', draft.plan.source === 'manual' && draft.plan.originalRequirement === requirement.text && draft.usage.isLive === false && !draft.plan.transportProvenance);
  const runId = (await api('POST', '/api/run-confirmed', { confirmationId: confirmation.confirmationId })).runId;
  const run = await terminal(runId); report.ids.firstRunId = runId;
  check('Real multi-file project passes manual acceptance and persistence', run.status === 'passed' && run.criteria.every(c => c.status === 'passed') && requests.includes('/app.js') && requests.includes('/api/notes'));
  check('URL execution is explicitly observed, not frozen source', run.sourceBinding === 'live-url-observed' && run.targetFingerprint !== 'unknown' && run.planSnapshot.source === 'manual');
  const oldConfirmationBytes = fs.readFileSync(path.join(runtime, 'confirmations', `${confirmation.confirmationId}.json`), 'utf8');
  const revised = (await api('POST', `/api/drafts/${draft.draftId}/revise`, { projectId: project.projectId, requirementId: requirement.requirementId, plan: { title: 'Reviewed Field Notes acceptance', description: 'Revised description', criteria } })).draft;
  check('Revision creates a new immutable draft/version', revised.supersedesDraftId === draft.draftId && revised.draftVersion > draft.draftVersion && revised.plan.fingerprint !== draft.plan.fingerprint);
  await api('POST', '/api/run-confirmed', { confirmationId: confirmation.confirmationId }, 409);
  check('Old confirmation cannot execute newly revised standards', !(await api('GET', `/api/confirmations/${confirmation.confirmationId}`)).confirmation.active);
  check('Old confirmation and run remain unchanged for historical evidence', fs.readFileSync(path.join(runtime, 'confirmations', `${confirmation.confirmationId}.json`), 'utf8') === oldConfirmationBytes && (await api('GET', `/api/run/${runId}`)).run.status === 'passed');
  const workspace = await api('GET', `/api/projects/${project.projectId}/workspace`);
  check('Workspace restores persisted requirements, latest drafts and inactive confirmation', workspace.requirements[0].requirementId === requirement.requirementId && workspace.drafts[0].draftId === revised.draftId && workspace.confirmations[0].active === false);
  const fresh = await confirm(revised);
  check('Revised standards require and accept new explicit confirmation', (await api('GET', `/api/confirmations/${fresh.confirmationId}`)).confirmation.active);

  const failCriteria = [{ id: 'HEALTH', title: 'Project readiness', description: 'The project must state Ready', steps: [criteria[0].steps[0], { id: 'H2', type: 'assertVisibleIn', locator: '#health', value: 'Ready', description: 'Application says Ready' }] }];
  const failDraft = await manual(project, requirement, failCriteria), failConfirmation = await confirm(failDraft);
  const failRun = await terminal((await api('POST', '/api/run-confirmed', { confirmationId: failConfirmation.confirmationId })).runId);
  check('Real URL assertion failure is recorded', failRun.status === 'failed');
  const task = (await api('POST', '/api/repair-tasks', { baselineRunId: failRun.runId })).task;
  await api('POST', `/api/repair-tasks/${task.taskId}/claim`, { claimedBy: 'Codex integration test' });
  fs.writeFileSync(path.join(source, 'index.html'), html.replace('Needs repair', 'Ready'));
  const newFingerprint = (await api('GET', '/api/targets')).targets.find(t => t.variant === target.variant).fingerprint;
  const rerun = await terminal((await api('POST', `/api/repair-tasks/${task.taskId}/rerun`, { expectedTargetFingerprint: newFingerprint })).runId);
  const comparison = (await api('GET', `/api/repair-tasks/${task.taskId}/comparison`)).comparison;
  check('Changed live project can pass rerun without falsely claiming frozen repair', rerun.status === 'passed' && comparison.acceptancePassed && comparison.targetFingerprintChanged && !comparison.sourceFingerprintKnown && !comparison.verifiedRepair);
  const reviewTask = (await api('GET', `/api/repair-tasks/${task.taskId}`)).task;
  check('Passed live URL acceptance enters review instead of failed', reviewTask.status === 'review' && reviewTask.blockedReason.includes('A live URL'));
  await api('POST', `/api/repair-tasks/${task.taskId}/claim`, { claimedBy: 'Different owner' }, 400);
  await api('POST', `/api/repair-tasks/${task.taskId}/claim`, { claimedBy: 'Codex integration test' });
  await terminal((await api('POST', `/api/repair-tasks/${task.taskId}/rerun`, { expectedTargetFingerprint: newFingerprint })).runId);
  const finalReviewTask = (await api('GET', `/api/repair-tasks/${task.taskId}`)).task;
  check('Same owner can retry once; all-pass second attempt stays review', finalReviewTask.status === 'review' && finalReviewTask.attemptCount === 2);
  await api('POST', `/api/repair-tasks/${task.taskId}/claim`, { claimedBy: 'Codex integration test' }, 400);
  check('Review status does not bypass the two-attempt limit', true);
  report.ids.unboundComparisonTaskId = task.taskId;

  const slowDraft = await manual(project, requirement, [{ ...failCriteria[0], steps: [criteria[0].steps[0], ...Array.from({ length: 12 }, (_, i) => ({ id: `S${i}`, type: 'click', locator: 'Missing control', description: 'Bounded missing control' })), failCriteria[0].steps[1]] }]);
  const slowConfirmation = await confirm(slowDraft);
  const slowId = (await api('POST', '/api/run-confirmed', { confirmationId: slowConfirmation.confirmationId })).runId;
  const snapshotStart = performance.now();
  const inFlightSnapshot = (await api('GET', `/api/run/${slowId}`)).run;
  const snapshotMs = performance.now() - snapshotStart;
  check('GET during a long run returns its persisted snapshot within one second', snapshotMs < 1000 && ['pending', 'running'].includes(inFlightSnapshot.status) && inFlightSnapshot.planSnapshot.fingerprint === slowDraft.plan.fingerprint && !inFlightSnapshot.finishedAt);
  report.inFlightSnapshotMs = Math.round(snapshotMs);
  await api('POST', '/api/run-confirmed', { confirmationId: slowConfirmation.confirmationId }, 409);
  await api('DELETE', `/api/targets/${target.variant}`, undefined, 409);
  check('No overlapping run or archive while a target is active', true);
  await api('POST', `/api/run/${slowId}/cancel`, {});
  const cancelled = await terminal(slowId);
  check('Cancellation is persisted as error, never success', cancelled.status === 'error' && cancelled.terminationReason === 'cancelled');

  const redirect = (await api('POST', '/api/targets', { name: 'Redirect trap', kind: 'url', url: url + 'redirect' })).target;
  await api('POST', `/api/targets/${redirect.variant}/probe`, {}, 502);
  check('Page probe never follows a redirect to an unregistered origin', remoteHits === 0);
  const singleHtml = path.join(source, 'standalone.html'); fs.writeFileSync(singleHtml, '<!doctype html><title>Imported</title><p>Independent HTML</p>');
  const imported = await api('POST', '/api/targets', { name: 'Imported standalone', kind: 'html', htmlPath: singleHtml });
  check('An explicit HTML outside the Ming repository can be registered', imported.target.kind === 'html' && imported.target.htmlPath === singleHtml);
  const importedRequirement = (await api('POST', `/api/projects/${imported.project.projectId}/requirements`, { text: 'The imported document displays Independent HTML.' })).requirement;
  const importedDraft = await manual(imported.project, importedRequirement, [{ id: 'HTML', title: 'Document text', description: 'Imported document content', steps: [criteria[0].steps[0], { id: 'H3', type: 'assertVisible', value: 'Independent HTML', description: 'Original document text is present' }] }]);
  const importedRun = await terminal((await api('POST', '/api/run-confirmed', { confirmationId: (await confirm(importedDraft)).confirmationId })).runId);
  check('Imported HTML executes against the captured document snapshot', importedRun.status === 'passed' && importedRun.sourceBinding === 'self-contained-html-snapshot');

  const slowHtmlDraft = await manual(imported.project, importedRequirement, [{ id: 'SLOW', title: 'Pending interaction', description: 'Cancellation fixture', steps: [criteria[0].steps[0], { id: 'WAIT', type: 'click', locator: 'Missing control', description: 'Wait for missing control' }, { id: 'A', type: 'assertVisible', value: 'Independent HTML', description: 'Document text' }] }]);
  const slowHtmlConfirmation = await confirm(slowHtmlDraft);
  const concurrent1 = (await api('POST', '/api/run-confirmed', { confirmationId: slowConfirmation.confirmationId })).runId;
  const concurrent2 = (await api('POST', '/api/run-confirmed', { confirmationId: slowHtmlConfirmation.confirmationId })).runId;
  const { plan: samplePlan } = await api('GET', '/api/plan?variant=buggy');
  await api('POST', '/api/run', { variant: 'buggy', confirmed: true, confirmedPlanId: samplePlan.planId, confirmedPlanFingerprint: samplePlan.fingerprint }, 429);
  check('Global concurrency cap rejects a third browser run', true);
  await api('POST', `/api/run/${concurrent1}/cancel`, {}); await api('POST', `/api/run/${concurrent2}/cancel`, {});
  await terminal(concurrent1); await terminal(concurrent2);

  const crashBaseline = await terminal((await api('POST', '/api/run', { variant: 'buggy', confirmed: true, confirmedPlanId: samplePlan.planId, confirmedPlanFingerprint: samplePlan.fingerprint })).runId);
  const crashTask = (await api('POST', '/api/repair-tasks', { baselineRunId: crashBaseline.runId })).task;
  await api('POST', `/api/repair-tasks/${crashTask.taskId}/claim`, { claimedBy: 'Codex restart check' });

  const interruptedId = (await api('POST', '/api/run-confirmed', { confirmationId: slowConfirmation.confirmationId })).runId;
  const beforeRecovery = await api('GET', `/api/run/${interruptedId}/progress`);
  check('In-flight run is persisted before browser completion', fs.existsSync(path.join(runtime, 'runs', `${interruptedId}.json`)) && ['running', 'pending'].includes(beforeRecovery.progress.status));
  const crashedRerun = (await api('POST', `/api/repair-tasks/${crashTask.taskId}/rerun`, { expectedTargetFingerprint: crashBaseline.targetFingerprint })).runId;
  await stopServer(); await startServer();
  const interrupted = (await api('GET', `/api/run/${interruptedId}`)).run;
  check('Restart converts unfinished run to explicit interrupted error', interrupted.status === 'error' && interrupted.terminationReason === 'interrupted');
  check('Restart recovers an actual in-flight repair task without fake completion', (await api('GET', `/api/repair-tasks/${crashTask.taskId}`)).task.status === 'error' && (await api('GET', `/api/run/${crashedRerun}`)).run.terminationReason === 'interrupted');
  check('Custom target and project workspace survive restart', (await api('GET', '/api/targets')).targets.some(t => t.variant === target.variant) && (await api('GET', `/api/projects/${project.projectId}/workspace`)).drafts.length >= 4);
  const newerRequirement = (await api('POST', `/api/projects/${project.projectId}/requirements`, { text: 'A changed PRD requires a new acceptance review.' })).requirement;
  await api('POST', '/api/run-confirmed', { confirmationId: fresh.confirmationId }, 409);
  check('New requirement versions invalidate earlier confirmation for new runs', newerRequirement.version === requirement.version + 1 && !(await api('GET', `/api/confirmations/${fresh.confirmationId}`)).confirmation.active);
  await api('DELETE', `/api/targets/${target.variant}`);
  check('Archive retains target identity and original evidence', (await api('GET', '/api/targets')).targets.find(t => t.variant === target.variant).archived && (await api('GET', `/api/run/${runId}`)).run.status === 'passed');
  await api('POST', '/api/run-confirmed', { confirmationId: fresh.confirmationId }, 409);
  check('Archived target rejects fresh execution', true);
  check('Project list includes registered real projects', (await api('GET', '/api/projects')).projects.some(p => p.projectId === project.projectId && p.archived));
  report.success = true;
} catch (error) { report.success = false; report.error = error.stack; console.error(error); process.exitCode = 1; }
finally {
  await stopServer(); await new Promise(resolve => localApp.close(resolve)); await new Promise(resolve => trap.close(resolve));
  report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(runtime, 'review-report.json'), JSON.stringify(report, null, 2)); console.log(`Report: ${path.join(runtime, 'review-report.json')}`);
}
