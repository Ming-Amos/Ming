/** Functional evidence/lifecycle regressions. Isolated runtime and loopback servers only. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { PlanRunner, computeFingerprint } = require('../packages/runner/dist/index.js');
const reviewId = randomUUID(), runtime = path.join(root, 'runtime', `functional-api-gaps-${reviewId}`);
const port = Number(process.env.MING_REVIEW_PORT ?? 4474), appPort = Number(process.env.MING_TARGET_PORT ?? 4475);
const base = `http://127.0.0.1:${port}`, targetUrl = `http://127.0.0.1:${appPort}/`;
fs.mkdirSync(runtime, { recursive: true });
const report = { reviewId, runtime, startedAt: new Date().toISOString(), checks: [], ids: {} };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(label, passed) { report.checks.push({ label, passed: Boolean(passed) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`); }
async function api(method, endpoint, body, expected = 200) {
  const response = await fetch(base + endpoint, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (response.status !== expected) throw Error(`${method} ${endpoint}: HTTP ${response.status}: ${data.error}`);
  return data;
}
async function until(fn, timeout = 12000) {
  const end = Date.now() + timeout;
  do { const value = await fn(); if (value) return value; await wait(40); } while (Date.now() < end);
  throw Error('Timed out waiting for test state');
}
async function terminal(id) { return until(async () => { const { run } = await api('GET', `/api/run/${id}`); return ['passed', 'failed', 'error'].includes(run.status) && run; }); }
let child;
async function stopServer() {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited;
}
async function startServer() {
  let occupied = false; try { await fetch(base + '/api/capabilities', { signal: AbortSignal.timeout(200) }); occupied = true; } catch {}
  if (occupied) throw Error('Refuse occupied review port');
  const log = fs.openSync(path.join(runtime, 'server.log'), 'a');
  child = spawn(process.execPath, ['apps/server/dist/index.js'], { cwd: root, windowsHide: true, env: { ...process.env, PORT: String(port), MING_RUNTIME_DIR: runtime, MING_PUBLIC_DEMO: '0', MING_TEST_MODE: '0', PROVIDER_API_KEY: '', PROVIDER_BASE_URL: '', PROVIDER_MODEL_ID: '' }, stdio: ['ignore', log, log] });
  fs.closeSync(log);
  await until(async () => { try { return (await api('GET', '/api/capabilities')).ok; } catch { return false; } });
}
const html = `<!doctype html><title>Lifecycle fixture</title><h1>Ready</h1><button onclick="document.body.style.background='rgb(255, 120, 120)'">Red scene</button><button onclick="document.body.style.background='rgb(120, 120, 255)'">Blue scene</button><script>console.error('Actual console diagnostic');fetch('/missing?token=synthetic-marker');setTimeout(()=>{throw Error('Actual page diagnostic')},10)</script>`;
const localApp = http.createServer(async (req, res) => {
  if (req.url.startsWith('/missing')) { res.writeHead(404); res.end('Missing'); return; }
  await wait(300); res.setHeader('content-type', 'text/html'); res.end(html);
});
const nav = { id: 'OPEN', type: 'navigate', url: '{{TARGET_URL}}', description: 'Open the page' };
const criterion = (id, steps) => ({ id, title: id, description: `Verify ${id}`, steps });
const plan = criteria => { const p = { planId: randomUUID(), version: '1', source: 'manual', title: 'Lifecycle regression', description: 'Real browser evidence', createdAt: new Date().toISOString(), fingerprint: '', criteria }; p.fingerprint = computeFingerprint(p); return p; };
try {
  await new Promise((resolve, reject) => { localApp.once('error', reject); localApp.listen(appPort, '127.0.0.1', resolve); });
  const screenshotDir = path.join(runtime, 'direct-screenshots');
  const collision = await new PlanRunner({ runId: randomUUID(), screenshotDir }).run(plan(['Red', 'Blue'].map(color => criterion(color, [nav, { id: 'COLOR', type: 'click', locator: `${color} scene`, description: `Show ${color} scene` }, { id: 'SAME', type: 'assertCount', locator: '.missing', expected: 1, description: `Fail ${color} assertion` }]))), { variant: 'direct', url: targetUrl, fingerprint: 'unknown' }, 'Evidence regression');
  const shots = collision.criteria.map(c => c.steps[2].screenshotPath);
  check('Both independent criteria record actual assertion failures', collision.criteria.every(c => c.status === 'failed'));
  check('Repeated step IDs retain different original screenshot paths', shots.every(Boolean) && new Set(shots).size === 2);
  check('Repeated step IDs retain each distinct rendered failure scene', shots.every(Boolean) && !fs.readFileSync(path.join(screenshotDir, shots[0])).equals(fs.readFileSync(path.join(screenshotDir, shots[1]))));
  check('Runner captures real console, page, and HTTP error diagnostics', collision.diagnostics.some(d => d.kind === 'console' && d.message === 'Actual console diagnostic') && collision.diagnostics.some(d => d.kind === 'pageerror' && d.message === 'Actual page diagnostic') && collision.diagnostics.some(d => d.kind === 'network' && d.status === 404));
  check('Network diagnostic URLs omit query values', collision.diagnostics.filter(d => d.url).every(d => !d.url.includes('?') && !d.url.includes('synthetic-marker')));
  const controller = new AbortController();
  const cancelled = await new PlanRunner({ runId: randomUUID(), screenshotDir, signal: controller.signal, onStepComplete: () => controller.abort() }).run(plan([criterion('PARTIAL', [nav, { id: 'CHECK', type: 'assertVisible', value: 'Ready', description: 'Check readiness' }])]), { variant: 'direct', url: targetUrl, fingerprint: 'unknown' }, 'Cancel regression');
  check('Cancellation between steps preserves the completed navigation', cancelled.status === 'error' && cancelled.terminationReason === 'cancelled' && cancelled.criteria[0].steps[0].status === 'passed' && cancelled.criteria[0].steps[1].status === 'skipped');
  await startServer();
  const { project } = await api('POST', '/api/targets', { name: 'Lifecycle isolated app', kind: 'url', url: targetUrl });
  const { requirement } = await api('POST', `/api/projects/${project.projectId}/requirements`, { text: 'The app says Ready, then eventually says Finished.' });
  const { draft } = await api('POST', '/api/drafts/manual', { projectId: project.projectId, requirementId: requirement.requirementId, plan: { title: 'Lifecycle checks', description: 'Preserve observed work', criteria: [criterion('FIRST', [nav, { id: 'READY', type: 'assertVisible', value: 'Ready', description: 'Read readiness' }]), criterion('SECOND', [nav, { id: 'FINISHED', type: 'assertVisible', value: 'Finished', description: 'Wait for missing finished text' }])] } });
  const { confirmation } = await api('POST', '/api/confirm', { draftId: draft.draftId, displayedPlanFingerprint: draft.plan.fingerprint });
  const { runId } = await api('POST', '/api/run-confirmed', { confirmationId: confirmation.confirmationId }); report.ids.cancelledRunId = runId;
  const initial = await until(async () => { const p = (await api('GET', `/api/run/${runId}/progress`)).progress; return p.currentCriteria && p; });
  check('Live progress identifies the first currently executing criterion', initial.status === 'running' && initial.currentCriteria === 'FIRST' && initial.finishedCriteria === 0);
  await until(async () => (await api('GET', `/api/run/${runId}/progress`)).progress.finishedCriteria === 1);
  await wait(80);
  const active = (await api('GET', `/api/run/${runId}`)).run;
  const progress = (await api('GET', `/api/run/${runId}/progress`)).progress;
  check('Live run record exposes completed criteria and original captures', active.status === 'running' && active.criteria[0].status === 'passed' && active.criteria[0].steps.some(s => s.screenshotPath));
  check('Progress advances to the active second criterion', progress.currentCriteria === 'SECOND' && progress.finishedCriteria === 1);
  await api('GET', `/api/run/${runId}/report?format=json`, undefined, 409);
  check('Export refuses incomplete runs', true);
  await api('POST', `/api/run/${runId}/cancel`, {});
  const final = await terminal(runId);
  check('API cancellation preserves completed first-criterion evidence', final.terminationReason === 'cancelled' && final.criteria[0].status === 'passed' && final.criteria[0].steps.some(s => s.screenshotPath));
  check('Cancelling an already finished run is idempotent', (await api('POST', `/api/run/${runId}/cancel`, {})).alreadyFinished);
  const { runId: restartId } = await api('POST', '/api/run-confirmed', { confirmationId: confirmation.confirmationId }); report.ids.interruptedRunId = restartId;
  await until(async () => (await api('GET', `/api/run/${restartId}/progress`)).progress.finishedCriteria === 1);
  await until(async () => (await api('GET', `/api/run/${restartId}`)).run.criteria[1].steps[0].status === 'passed');
  await stopServer(); await startServer();
  const recovered = (await api('GET', `/api/run/${restartId}`)).run;
  check('Restart makes an interrupted run terminal without claiming success', recovered.status === 'error' && recovered.terminationReason === 'interrupted');
  check('Restart retains completed criterion results and screenshots', recovered.criteria[0].status === 'passed' && recovered.criteria[0].steps[0].status === 'passed' && recovered.criteria[0].steps.some(s => s.screenshotPath));
  check('Restart retains finished steps in an incomplete criterion', recovered.criteria[1].status === 'error' && recovered.criteria[1].steps[0].status === 'passed' && recovered.criteria[1].steps[1].status === 'skipped');
  const exported = await api('GET', `/api/run/${restartId}/report?format=json`);
  check('JSON report preserves interrupted-run outcomes and evidence identity', exported.run.terminationReason === 'interrupted' && exported.run.criteria[0].status === 'passed');
  const markdown = await (await fetch(base + `/api/run/${restartId}/report?format=markdown`)).text();
  const exportedHtml = await (await fetch(base + `/api/run/${restartId}/report?format=html`)).text();
  check('Markdown and standalone HTML reports export real terminal evidence', markdown.includes('service restarted') && exportedHtml.includes('data:image/png;base64,') && exportedHtml.includes('service restarted'));
} catch (error) { report.error = String(error); console.error(report.error); process.exitCode = 1; }
finally {
  await stopServer(); localApp.closeAllConnections(); await new Promise(resolve => localApp.close(resolve));
  report.finishedAt = new Date().toISOString(); report.passed = report.checks.filter(c => c.passed).length; report.total = report.checks.length;
  fs.writeFileSync(path.join(runtime, 'review-report.json'), JSON.stringify(report, null, 2));
  console.log(`Report: ${path.join(runtime, 'review-report.json')} (${report.passed}/${report.total})`);
  if (report.checks.some(c => !c.passed)) process.exitCode = 1;
}
