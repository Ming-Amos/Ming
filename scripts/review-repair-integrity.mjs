/** Codex: isolated real-browser repair/integrity checks. No live models or Bob calls.
 * Uses temporary copies of example HTML and adversarial mutations ONLY in its own runtime.
 * Run after pnpm --filter @ming/server... run build. Leaves report/evidence, stops owned server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { compareRepair } = require('../apps/server/dist/repair-integrity.js');
const { computeFingerprint, PlanRunner } = require('../packages/runner/dist/index.js');
const temp = path.join(root, 'runtime', `integrity-${randomUUID()}`);
fs.mkdirSync(temp, { recursive: true });
const relative = p => path.relative(root, p).replaceAll('\\', '/');
const html = path.join(temp, 'target.html');
const healthy = fs.readFileSync(path.join(root, 'examples/daily-report/normal/index.html'), 'utf8');
const broken = fs.readFileSync(path.join(root, 'examples/daily-report/buggy/index.html'), 'utf8');
fs.writeFileSync(html, broken);
const registry = path.join(temp, 'targets.json');
fs.writeFileSync(registry, JSON.stringify([{ variant: 'normal', route: '/normal', label: 'Isolated integrity target', htmlPath: relative(html), planPath: 'fixtures/stage-a-plan.json' }]));
const port = Number(process.env.MING_REVIEW_PORT ?? 4411);
const base = `http://127.0.0.1:${port}`;
const report = { author: 'Codex', scope: 'Real local browser / isolated copied source; adversarial record mutations explicitly test integrity rejection', checks: [], runs: [], startedAt: new Date().toISOString() };
function check(label, condition) {
  report.checks.push({ label, passed: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
  if (!condition) throw Error(label);
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(method, route, body) {
  const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  return { status: response.status, ...(await response.json()) };
}
async function ok(method, route, body) {
  const result = await request(method, route, body);
  if (!result.ok) throw Error(`${route}: ${JSON.stringify(result)}`);
  return result;
}
async function wait(runId) {
  for (let i = 0; i < 300; i++) {
    const result = await ok('GET', `/api/run/${runId}/progress`);
    if (['passed', 'failed', 'error'].includes(result.progress.status)) {
      const { run } = await ok('GET', `/api/run/${runId}`);
      report.runs.push({ runId, status: run.status, sourceChangedDuringRun: run.sourceChangedDuringRun });
      return run;
    }
    await delay(100);
  }
  throw Error('Run did not finish');
}
let child;
try {
  // Never attach to or terminate a pre-existing server on the review port.
  let occupied = false;
  try { await fetch(`${base}/api/capabilities`, { signal: AbortSignal.timeout(500) }); occupied = true; } catch {}
  if (occupied) throw Error(`Review port ${port} already in use`);
  child = spawn(process.execPath, ['apps/server/dist/index.js'], { cwd: root, windowsHide: true,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MING_RUNTIME_DIR: temp, MING_TARGET_REGISTRY: registry, MING_TEST_MODE: '1', MING_PUBLIC_DEMO: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; }); child.stderr.on('data', chunk => { log += chunk; });
  for (let i = 0; i < 100; i++) {
    try { await ok('GET', '/api/capabilities'); break; } catch { if (child.exitCode !== null) throw Error(log); await delay(100); }
  }
  const { plan } = await ok('GET', '/api/plan');
  const runFixture = async () => wait((await ok('POST', '/api/run', { variant: 'normal', confirmed: true, confirmedPlanId: plan.planId, confirmedPlanFingerprint: plan.fingerprint })).runId);
  const baseline = await runFixture();
  check('Copied buggy target produces actual failed assertion', baseline.status === 'failed' && baseline.criteria[1].status === 'failed');
  check('Baseline binds captured HTML and exact plan', baseline.sourceBinding === 'self-contained-html-snapshot' && baseline.sourceChangedDuringRun === false && computeFingerprint(baseline.planSnapshot) === baseline.planFingerprint);
  const baselineBytes = fs.readFileSync(path.join(temp, 'runs', `${baseline.runId}.json`), 'utf8');
  const { task } = await ok('POST', '/api/repair-tasks', { baselineRunId: baseline.runId });
  await ok('POST', `/api/repair-tasks/${task.taskId}/claim`, { claimedBy: 'Codex-isolated-integrity-test' });
  const taskPath = path.join(temp, 'repair-tasks', `${task.taskId}.json`);
  const taskBytes = fs.readFileSync(taskPath, 'utf8');
  const corruptTask = JSON.parse(taskBytes); corruptTask.planSnapshot.criteria[0].title += ' tampered';
  fs.writeFileSync(taskPath, JSON.stringify(corruptTask));
  check('Tampered plan content rejected despite unchanged stored fingerprint', (await request('POST', `/api/repair-tasks/${task.taskId}/rerun`, { expectedTargetFingerprint: baseline.targetFingerprint })).status === 422);
  fs.writeFileSync(taskPath, taskBytes);
  check('Stale expected source fingerprint rejected', (await request('POST', `/api/repair-tasks/${task.taskId}/rerun`, { expectedTargetFingerprint: 'stale' })).status === 409);
  fs.writeFileSync(html, healthy); // Mechanical fixture replacement, not the product demonstration repair.
  const rerun = await wait((await ok('POST', `/api/repair-tasks/${task.taskId}/rerun`, { expectedTargetFingerprint: computeFingerprint(healthy) })).runId);
  await delay(25);
  const finalTask = (await ok('GET', `/api/repair-tasks/${task.taskId}`)).task;
  const comparison = (await ok('GET', `/api/repair-tasks/${task.taskId}/comparison`)).comparison;
  check('Real browser repair comparison verifies and task agrees', comparison.verifiedRepair && finalTask.status === 'passed' && rerun.status === 'passed');
  check('Plan and runner remain identical while source changes', comparison.planFingerprintMatch && comparison.runnerFingerprintMatch && comparison.targetFingerprintChanged);
  check('Baseline evidence bytes preserved', baselineBytes === fs.readFileSync(path.join(temp, 'runs', `${baseline.runId}.json`), 'utf8'));
  const adversarial = [
    ['unknown runner', (b, r) => { delete r.runnerFingerprint; }],
    ['fatal cleanup error', (b, r) => { r.fatalError = 'cleanup failed'; r.status = 'error'; }],
    ['missing criterion', (b, r) => { r.criteria.pop(); }],
    ['missing step', (b, r) => { r.criteria[0].steps.pop(); }],
    ['duplicate criterion', (b, r) => { r.criteria[1] = r.criteria[0]; }],
    ['source changed during run', (b, r) => { r.sourceChangedDuringRun = true; }],
    ['unknown source binding', (b, r) => { delete b.sourceBinding; }],
    ['wrong requirement', (b, r) => { r.requirementId = 'different'; }],
    ['wrong target identity', (b, r) => { r.targetVariant = 'other'; }],
    ['infrastructure-only baseline', (b, r) => { b.status = 'error'; b.criteria[1].status = 'error'; b.criteria[1].steps.forEach(s => { if (s.status === 'failed') s.status = 'error'; }); }],
  ];
  for (const [label, mutate] of adversarial) {
    const b = structuredClone(baseline), r = structuredClone(rerun); mutate(b, r);
    check(`Strict comparison blocks ${label}`, !compareRepair(finalTask, b, r).verifiedRepair);
  }
  // Snapshot must serve every fresh context and reload even after disk source is changed.
  const running = await ok('POST', '/api/run', { variant: 'normal', confirmed: true, confirmedPlanId: plan.planId, confirmedPlanFingerprint: plan.fingerprint });
  fs.writeFileSync(html, '<html><body>Changed source, no expected controls</body></html>');
  const changedRun = await wait(running.runId);
  check('All browser contexts/reloads execute captured HTML', changedRun.status === 'passed');
  check('Concurrent source change is recorded and cannot count as verified', changedRun.sourceChangedDuringRun === true);
  const directRunner = new PlanRunner({ screenshotDir: path.join(temp, 'screenshots'), runId: randomUUID() });
  let rejectedMismatch = false;
  try { await directRunner.run(plan, { variant: 'normal', url: `${base}/normal`, fingerprint: 'wrong', htmlSnapshot: healthy }, 'unique'); } catch { rejectedMismatch = true; }
  check('Runner itself rejects mismatched HTML snapshot hash', rejectedMismatch);
  fs.writeFileSync(html, broken);
  const limitBaseline = await runFixture();
  const limitTask = (await ok('POST', '/api/repair-tasks', { baselineRunId: limitBaseline.runId })).task;
  for (let i = 0; i < 2; i++) {
    await ok('POST', `/api/repair-tasks/${limitTask.taskId}/claim`, { claimedBy: 'Codex-attempt-limit-test' });
    await wait((await ok('POST', `/api/repair-tasks/${limitTask.taskId}/rerun`, { expectedTargetFingerprint: computeFingerprint(broken) })).runId);
    await delay(25);
  }
  const stopped = (await ok('GET', `/api/repair-tasks/${limitTask.taskId}`)).task;
  check('Two unsuccessful reruns stop at blocked with retained attempt IDs', stopped.status === 'blocked' && stopped.attemptCount === 2 && stopped.attemptRunIds.length === 2);
  check('Third attempt cannot be claimed', (await request('POST', `/api/repair-tasks/${limitTask.taskId}/claim`, { claimedBy: 'Codex-attempt-limit-test' })).status === 400);
  // Stage B full linkage checks using a clearly marked local test transport.
  const project = (await ok('POST', '/api/projects', { name: 'Integrity project', targetVariant: 'normal' })).project;
  const requirement = (await ok('POST', `/api/projects/${project.projectId}/requirements`, { text: 'Persist submitted reports and reject blank input.' })).requirement;
  await ok('POST', '/admin/test-fixture', { mode: 'plan', plan });
  const draft = (await ok('POST', '/api/generate', { requirementId: requirement.requirementId })).draft;
  const confirmation = (await ok('POST', '/api/confirm', { draftId: draft.draftId, displayedPlanFingerprint: draft.plan.fingerprint })).confirmation;
  const generatedBaseline = await wait((await ok('POST', '/api/run-confirmed', { confirmationId: confirmation.confirmationId })).runId);
  check('Generated confirmed baseline retains original plan and requirement', generatedBaseline.planFingerprint === confirmation.planFingerprint && generatedBaseline.requirementId === requirement.requirementId);
  const confirmationPath = path.join(temp, 'confirmations', `${confirmation.confirmationId}.json`);
  const confirmationBytes = fs.readFileSync(confirmationPath, 'utf8');
  for (const [label, mutate] of [
    ['snapshot content', c => { c.planSnapshot.criteria[0].title = 'tampered'; }],
    ['requirement link', c => { c.requirementId = 'nonexistent'; }],
    ['project link', c => { c.projectId = 'nonexistent'; }],
    ['target link', c => { c.targetVariant = 'other'; }],
  ]) {
    const changed = JSON.parse(confirmationBytes); mutate(changed); fs.writeFileSync(confirmationPath, JSON.stringify(changed));
    check(`Confirmed execution rejects tampered ${label}`, [400, 422].includes((await request('POST', '/api/run-confirmed', { confirmationId: confirmation.confirmationId })).status));
    check(`Repair creation rejects tampered ${label}`, (await request('POST', '/api/repair-tasks', { baselineRunId: generatedBaseline.runId })).status === 422);
    fs.writeFileSync(confirmationPath, confirmationBytes);
  }
  check('Valid generated baseline creates repair task using same confirmed plan', (await ok('POST', '/api/repair-tasks', { baselineRunId: generatedBaseline.runId })).task.planFingerprint === confirmation.planFingerprint);
  report.passed = true;
} catch (error) {
  report.passed = false; report.error = String(error); console.error(error); process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 3000); }); }
  report.finishedAt = new Date().toISOString();
  const reportPath = path.join(temp, 'review-report.json'); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`REPORT ${reportPath}`);
}
