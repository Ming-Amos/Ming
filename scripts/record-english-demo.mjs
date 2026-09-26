/** Record new English judge evidence without rewriting any earlier evidence.
 * A real MCP client claims the failed task, then waits for Codex to edit the
 * repair target source. This script never applies the repair itself.
 * Requires built server/runner/MCP. No Bob access or model request is used.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../apps/mcp/package.json', import.meta.url));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport, getDefaultEnvironment } = require('@modelcontextprotocol/sdk/client/stdio.js');
const port = 4480, base = `http://127.0.0.1:${port}`;
const proofId = randomUUID();
const runtime = path.join(root, 'runtime', `english-judge-${proofId}`);
const out = path.join(root, 'docs', 'judge-evidence');
const processDir = path.join(out, 'repair-process');
const repairFile = path.join(root, 'examples', 'shipboard', 'repair', 'index.html');
const buggyFile = path.join(root, 'examples', 'shipboard', 'buggy', 'index.html');
const normalFile = path.join(root, 'examples', 'shipboard', 'normal', 'index.html');
const planFile = path.join(root, 'fixtures', 'shipboard-plan.json');
const variants = ['shipboard-normal', 'shipboard-buggy', 'shipboard-repair'];
const actor = 'Codex via real stdio MCP';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fileHash = filename => hash(fs.readFileSync(filename));
const report = { proofId, startedAt: new Date().toISOString(), actor, checks: [], modelCalls: 0, bobCalls: 0, runs: {}, rawWireRoutes: [] };
const rawResponses = {}, responses = {};
let child, client;

function check(label, passed) {
  report.checks.push({ label, passed: Boolean(passed) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
  if (!passed) throw Error(label);
}
function treeHashes(dir, origin = dir, result = {}) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) treeHashes(file, origin, result);
    else result[path.relative(origin, file).replaceAll('\\', '/')] = fileHash(file);
  }
  return result;
}
async function api(method, route, body) {
  const response = await fetch(base + route, {
    method, headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw Error(`${route} ${response.status}: ${JSON.stringify(data)}`);
  return data;
}
async function recordedGet(route) {
  const data = await api('GET', route);
  rawResponses[route] = data;
  return data;
}
async function tool(name, args = {}, evidenceName) {
  const response = await client.callTool({ name, arguments: args });
  if (evidenceName) fs.writeFileSync(path.join(processDir, evidenceName + '.json'), JSON.stringify({ requestedAt: new Date().toISOString(), tool: name, arguments: args, response }, null, 2));
  if (response.isError) throw Error(`MCP ${name}: ${JSON.stringify(response)}`);
  const text = response.content.find(item => item.type === 'text')?.text;
  if (!text) throw Error(`MCP ${name} returned no text`);
  return JSON.parse(text);
}
async function terminal(runId) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const { progress } = await api('GET', `/api/run/${runId}/progress`);
    if (['passed', 'failed', 'error'].includes(progress.status)) return (await api('GET', `/api/run/${runId}`)).run;
    await delay(150);
  }
  throw Error(`Run ${runId} did not finish`);
}
async function runFixture(variant) {
  const { plan } = await api('GET', `/api/plan?variant=${variant}`);
  const { runId } = await api('POST', '/api/run', { variant, confirmed: true, confirmedPlanId: plan.planId, confirmedPlanFingerprint: plan.fingerprint });
  return terminal(runId);
}
function copyRecord(folder, name) {
  const destination = path.join(out, 'runtime', folder, name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(runtime, folder, name), destination);
}

const legacyBefore = treeHashes(path.join(root, 'docs', 'demo-evidence'));
const buggyBefore = fileHash(buggyFile), normalBefore = fileHash(normalFile), planBefore = fileHash(planFile);
const repairBefore = fs.readFileSync(repairFile, 'utf8');
try {
  if (fs.existsSync(path.join(out, 'manifest.json'))) throw Error('Reviewed judge evidence already exists. Do not overwrite it with a second recording.');
  if (!repairBefore.includes('function loadTasks() { return []; }')) throw Error('Repair target must still contain its seeded persistence defect before recording.');
  let occupied = false;
  try { await fetch(base + '/api/capabilities', { signal: AbortSignal.timeout(400) }); occupied = true; } catch {}
  if (occupied) throw Error('Port 4480 is occupied; refusing to attach to an unrelated server.');
  fs.mkdirSync(runtime, { recursive: true }); fs.mkdirSync(processDir, { recursive: true });
  fs.writeFileSync(path.join(processDir, 'before.html'), repairBefore);
  const log = fs.openSync(path.join(runtime, 'server.log'), 'w');
  child = spawn(process.execPath, ['apps/server/dist/index.js'], {
    cwd: root, windowsHide: true,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MING_RUNTIME_DIR: runtime, MING_PUBLIC_DEMO: '0', MING_TEST_MODE: '0', PROVIDER_API_KEY: '', PROVIDER_BASE_URL: '', PROVIDER_MODEL_ID: '' },
    stdio: ['ignore', log, log],
  }); fs.closeSync(log);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) { try { await api('GET', '/api/capabilities'); ready = true; break; } catch { await delay(100); } }
  if (!ready) throw Error('Dedicated judge-evidence server did not start.');

  const targets = (await api('GET', '/api/targets')).targets;
  check('All three English demonstration targets are registered', variants.every(variant => targets.some(target => target.variant === variant)));
  client = new Client({ name: 'ming-english-evidence-codex', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'apps/mcp/dist/index.js')], cwd: root, stderr: 'pipe', env: { ...getDefaultEnvironment(), MING_BASE_URL: base } }));
  const discovered = await client.listTools();
  fs.writeFileSync(path.join(processDir, 'mcp-tools.json'), JSON.stringify(discovered, null, 2));
  check('The real stdio MCP server exposes repair and rerun tools', ['ming_get_failed_run', 'ming_create_repair_task', 'ming_claim_repair_task', 'ming_rerun_plan', 'ming_get_comparison'].every(name => discovered.tools.some(tool => tool.name === name)));

  const working = await runFixture('shipboard-normal');
  check('Working Shipboard passes all three actual browser criteria', working.status === 'passed' && working.criteria.length === 3 && working.criteria.every(c => c.status === 'passed'));
  report.runs.working = working.runId;
  const defective = await runFixture('shipboard-buggy');
  check('The repeatable defective example fails only reload persistence', defective.status === 'failed' && defective.criteria.filter(c => c.status === 'failed').map(c => c.criteriaId).join() === 'SHIP-02');
  report.runs.defective = defective.runId;
  const baseline = await runFixture('shipboard-repair');
  check('The repair workspace reproduces the same persistence failure', baseline.status === 'failed' && baseline.criteria[0].status === 'passed' && baseline.criteria[1].status === 'failed' && baseline.criteria[2].status === 'passed');
  check('The browser executed a frozen self-contained HTML snapshot', baseline.sourceBinding === 'self-contained-html-snapshot' && baseline.sourceChangedDuringRun === false);
  report.runs.baseline = baseline.runId;

  const failure = await tool('ming_get_failed_run', { runId: baseline.runId }, 'mcp-read-failure');
  check('Actual MCP failure evidence identifies the failed persistence criterion', JSON.stringify(failure).includes('SHIP-02') && JSON.stringify(failure).includes(baseline.runId));
  const { task } = await tool('ming_create_repair_task', { runId: baseline.runId }, 'mcp-create-task');
  report.taskId = task.taskId;
  const claimed = await tool('ming_claim_repair_task', { taskId: task.taskId, claimedBy: actor }, 'mcp-claim');
  check('Codex claims the actual task over stdio MCP', claimed.claimedBy === actor && claimed.status === 'claimed');
  await tool('ming_get_repair_task', { taskId: task.taskId }, 'mcp-read-task');
  const frozenBaseline = fileHash(path.join(runtime, 'runs', `${baseline.runId}.json`));
  fs.writeFileSync(path.join(runtime, 'waiting-for-source-fix.json'), JSON.stringify({ taskId: task.taskId, baselineRunId: baseline.runId, repairFile, sourceHash: hash(repairBefore), planFingerprint: baseline.planFingerprint, runnerFingerprint: baseline.runnerFingerprint }, null, 2));
  console.log('READY_FOR_CODEX_SOURCE_FIX ' + repairFile);
  console.log('STATE ' + path.join(runtime, 'waiting-for-source-fix.json'));
  const deadline = Date.now() + 10 * 60 * 1000;
  while (fileHash(repairFile) === hash(repairBefore)) { if (Date.now() > deadline) throw Error('No source fix arrived within the evidence recording window.'); await delay(1000); }
  await delay(300);
  check('Only the repair target changed; original plan and both reference examples remain intact', fileHash(planFile) === planBefore && fileHash(buggyFile) === buggyBefore && fileHash(normalFile) === normalBefore);
  const repairedSource = fs.readFileSync(repairFile, 'utf8');
  check('The actual source repair implements persistent save and restore', repairedSource.includes('localStorage.getItem(STORAGE_KEY)') && repairedSource.includes('localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))'));
  fs.writeFileSync(path.join(processDir, 'after.html'), repairedSource);
  let diff = '';
  try { diff = execFileSync('git', ['diff', '--no-index', '--', path.join(processDir, 'before.html'), path.join(processDir, 'after.html')], { cwd: root, encoding: 'utf8' }); }
  catch (error) { if (error.status !== 1) throw error; diff = String(error.stdout); }
  fs.writeFileSync(path.join(processDir, 'target-repair.diff'), diff);
  const updatedTargets = await tool('ming_get_targets', {}, 'mcp-target-after-edit');
  const repairedTarget = updatedTargets.targets.find(target => target.variant === 'shipboard-repair');
  check('MCP observes a new fingerprint for the same repair target', repairedTarget.fingerprint !== baseline.targetFingerprint && repairedTarget.url === baseline.targetUrl);
  const queued = await tool('ming_rerun_plan', { taskId: task.taskId, expectedTargetFingerprint: repairedTarget.fingerprint }, 'mcp-rerun');
  const rerun = await terminal(queued.runId); report.runs.rerun = rerun.runId;
  check('The repaired source passes all three original browser criteria', rerun.status === 'passed' && rerun.criteria.every(c => c.status === 'passed'));
  const comparisonResult = await tool('ming_get_comparison', { taskId: task.taskId }, 'mcp-comparison');
  const comparison = comparisonResult.comparison || comparisonResult;
  check('Strict repair verification passes with no blockers', comparison.verifiedRepair === true && comparison.blockers.length === 0);
  check('Plan, runner, and target identity are unchanged across the repair', baseline.planFingerprint === rerun.planFingerprint && baseline.runnerFingerprint === rerun.runnerFingerprint && baseline.targetUrl === rerun.targetUrl && baseline.targetVariant === rerun.targetVariant);
  check('The original failed record remains byte-for-byte unchanged', fileHash(path.join(runtime, 'runs', `${baseline.runId}.json`)) === frozenBaseline);

  const runIds = Object.values(report.runs);
  for (const runId of runIds) {
    const route = `/api/run/${runId}`;
    const body = await recordedGet(route); responses[route] = body;
    check(`Run ${runId.slice(0, 8)} is terminal and all visible evidence is English`, Boolean(body.run.finishedAt) && !/[\u3400-\u9fff]/.test(JSON.stringify(body.run)));
    responses[route + '/progress'] = await recordedGet(route + '/progress');
    copyRecord('runs', `${runId}.json`);
    for (const criterion of body.run.criteria) for (const step of criterion.steps) if (step.screenshotPath) copyRecord('screenshots', path.basename(step.screenshotPath));
  }
  responses[`/api/repair-tasks/${task.taskId}`] = await recordedGet(`/api/repair-tasks/${task.taskId}`);
  responses[`/api/repair-tasks/${task.taskId}/comparison`] = await recordedGet(`/api/repair-tasks/${task.taskId}/comparison`);
  const allTasks = await recordedGet('/api/repair-tasks'); responses['/api/repair-tasks'] = { ...allTasks, tasks: allTasks.tasks.filter(item => item.taskId === task.taskId) };
  const allHistory = await recordedGet('/api/history'); responses['/api/history'] = { ...allHistory, runs: allHistory.runs.filter(run => runIds.includes(run.runId)) };
  const allTargets = await recordedGet('/api/targets'); responses['/api/targets'] = { ...allTargets, targets: allTargets.targets.filter(target => variants.includes(target.variant)) };
  responses['/api/projects'] = await recordedGet('/api/projects');
  for (const variant of variants) responses[`/api/plan?variant=${variant}`] = await recordedGet(`/api/plan?variant=${variant}`);
  const defaultPlan = await recordedGet('/api/plan');
  responses['/api/plan'] = defaultPlan.plan?.planId === 'shipboard-task-acceptance' ? defaultPlan : responses['/api/plan?variant=shipboard-buggy'];
  const capabilities = await recordedGet('/api/capabilities');
  responses['/api/capabilities'] = { ...capabilities, readOnly: true, featuredBaselineRunId: baseline.runId, featuredRerunId: rerun.runId };
  await recordedGet('/api/provider/status');
  responses['/api/provider/status'] = { ok: true, status: { configured: false, providerLabel: 'Recorded evidence viewer', baseUrl: '', modelId: '', missingFields: ['This read-only view does not connect to a model.'], readOnly: true } };
  copyRecord('repair-tasks', `${task.taskId}.json`);
  check('All judge-facing response copy is English', !/[\u3400-\u9fff]/.test(JSON.stringify(responses)));
  check('The original demonstration evidence bundle is byte-for-byte unchanged', JSON.stringify(treeHashes(path.join(root, 'docs', 'demo-evidence'))) === JSON.stringify(legacyBefore));

  fs.writeFileSync(path.join(out, 'api-responses.json'), JSON.stringify({ schemaVersion: 1, responses }, null, 2));
  fs.writeFileSync(path.join(out, 'raw-wire-responses.json'), JSON.stringify({ schemaVersion: 1, baseUrl: base, responses: rawResponses }, null, 2));
  report.rawWireRoutes = Object.keys(rawResponses); report.success = true; report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'review-report.json'), JSON.stringify(report, null, 2));
  const files = treeHashes(path.join(out, 'runtime'), out); treeHashes(processDir, out, files);
  for (const name of ['api-responses.json', 'raw-wire-responses.json', 'review-report.json']) files[name] = fileHash(path.join(out, name));
  const manifest = { schemaVersion: 1, exportedAt: new Date().toISOString(), actor, provenance: 'Actual English browser executions with a hand-authored fixture plan. Codex performed a real source repair and used the actual stdio MCP server. No live model generation or Bob usage.', featuredBaselineRunId: baseline.runId, featuredRerunId: rerun.runId, taskId: task.taskId, runIds, comparison, files, legacyEvidenceUnchanged: true, sourceHashes: { before: hash(repairBefore), after: fileHash(repairFile), defectiveExample: buggyBefore, workingExample: normalBefore, plan: planBefore } };
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(root, 'runtime', 'english-judge-proof-state.json'), JSON.stringify({ runtime, out, ...report.runs, taskId: task.taskId, verifiedRepair: comparison.verifiedRepair }, null, 2));
  console.log('EXPORTED ' + JSON.stringify({ out, checks: report.checks.length, ...report.runs, taskId: task.taskId, verifiedRepair: comparison.verifiedRepair }));
} catch (error) {
  report.success = false; report.error = String(error.stack || error); report.finishedAt = new Date().toISOString();
  fs.mkdirSync(runtime, { recursive: true }); fs.writeFileSync(path.join(runtime, 'failed-recording-report.json'), JSON.stringify(report, null, 2));
  console.error(report.error); process.exitCode = 1;
} finally {
  await client?.close();
  if (child && child.exitCode === null) { const ended = new Promise(resolve => child.once('exit', resolve)); child.kill(); await ended; }
}
