/** Actual Windows sharing locks + concurrent JSON readers. Isolated runtime only. */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { writeJsonAtomicSync } = require('../apps/server/dist/atomic-json.js');
const runtime = path.join(root, 'runtime', `storage-durability-${randomUUID()}`);
fs.mkdirSync(runtime, { recursive: true });
const file = path.join(runtime, 'record.json'), children = new Set();
const report = { runtime, platform: process.platform, startedAt: new Date().toISOString(), checks: [] };
function check(label, passed) { report.checks.push({ label, passed: Boolean(passed) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`); if (!passed) throw Error(label); }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited;
}
async function lockFile(durationMs) {
  const code = `$stream = [System.IO.File]::Open($env:MING_LOCK_FILE, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read); try { [Console]::WriteLine('LOCKED'); [Console]::Out.Flush(); Start-Sleep -Milliseconds ${durationMs} } finally { $stream.Dispose() }`;
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', code], { windowsHide: true, env: { ...process.env, MING_LOCK_FILE: file }, stdio: ['ignore', 'pipe', 'pipe'] }); children.add(child);
  await new Promise((resolve, reject) => {
    let output = ''; const timer = setTimeout(() => reject(Error('Windows file lock did not become ready')), 10000);
    child.stdout.on('data', data => { output += data; if (output.includes('LOCKED')) { clearTimeout(timer); resolve(); } });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { if (!output.includes('LOCKED')) { clearTimeout(timer); reject(Error(`Lock holder exited: ${code}`)); } });
  });
  return child;
}
try {
  writeJsonAtomicSync(file, { version: 0, evidence: 'original' });
  check('Initial save creates one complete valid record', JSON.parse(fs.readFileSync(file, 'utf8')).version === 0);
  if (process.platform === 'win32') {
    const lock = await lockFile(5000), prior = fs.readFileSync(file), oldTemporary = path.join(runtime, 'former-writer.tmp');
    fs.writeFileSync(oldTemporary, JSON.stringify({ version: 1 }));
    let oldFailure; try { fs.renameSync(oldTemporary, file); } catch (error) { oldFailure = error; }
    check('Actual Windows sharing lock reproduces the former rename failure', ['EPERM', 'EACCES', 'EBUSY'].includes(oldFailure?.code));
    let failure; const started = performance.now();
    try { writeJsonAtomicSync(file, { version: 1, evidence: 'must not replace locked evidence' }); } catch (error) { failure = error; }
    check('Persistent sharing lock fails within a bounded retry window', ['EPERM', 'EACCES', 'EBUSY'].includes(failure?.code) && performance.now() - started >= 1400 && performance.now() - started < 3000);
    check('Failed replacement preserves the exact original evidence bytes', fs.readFileSync(file).equals(prior));
    check('Failed replacement cleans only its own temporary file', fs.readdirSync(runtime).filter(name => name.endsWith('.tmp')).every(name => name === 'former-writer.tmp'));
    await stop(lock); fs.unlinkSync(oldTemporary);
    const transient = await lockFile(180), retryStarted = performance.now();
    writeJsonAtomicSync(file, { version: 2, evidence: 'complete replacement' });
    check('Transient actual Windows lock is retried until replacement succeeds', JSON.parse(fs.readFileSync(file, 'utf8')).version === 2 && performance.now() - retryStarted >= 150);
    await stop(transient);
  }
  const rename = fs.renameSync; let attempts = 0;
  try {
    fs.renameSync = () => { attempts++; throw Object.assign(Error('Injected non-transient disk error'), { code: 'EIO' }); };
    let rejected = false; try { writeJsonAtomicSync(file, { version: 3 }); } catch { rejected = true; }
    check('Non-transient disk errors surface immediately without retries', rejected && attempts === 1);
  } finally { fs.renameSync = rename; }
  const previousVersion = JSON.parse(fs.readFileSync(file, 'utf8')).version;
  const cyclic = {}; cyclic.self = cyclic;
  let rejected = false; try { writeJsonAtomicSync(file, cyclic); } catch { rejected = true; }
  check('Serialization failure cannot modify an existing record', rejected && JSON.parse(fs.readFileSync(file, 'utf8')).version === previousVersion);
  const readerResult = path.join(runtime, 'reader-result.json'), readerStop = path.join(runtime, 'reader-stop');
  const readerCode = `const fs=require('node:fs');const delay=new Int32Array(new SharedArrayBuffer(4));let reads=0,errors=[];process.stdout.write('READY\\n');while(!fs.existsSync(process.argv[2])){try{const record=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!Number.isInteger(record.version))throw Error('invalid version');reads++}catch(e){errors.push(e.code||e.message)}Atomics.wait(delay,0,0,10)}fs.writeFileSync(process.argv[3],JSON.stringify({reads,errors}));`;
  const reader = spawn(process.execPath, ['-e', readerCode, file, readerStop, readerResult], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); children.add(reader);
  await new Promise((resolve, reject) => { reader.stdout.once('data', resolve); reader.once('error', reject); });
  for (let version = 10; version < 160; version++) writeJsonAtomicSync(file, { version, evidence: 'x'.repeat(64000) });
  fs.writeFileSync(readerStop, 'stop');
  for (let i = 0; i < 200 && !fs.existsSync(readerResult); i++) await wait(10);
  const result = JSON.parse(fs.readFileSync(readerResult, 'utf8'));
  check('Concurrent readers see complete JSON through 150 rapid replacements', result.reads > 0 && result.errors.length === 0 && JSON.parse(fs.readFileSync(file, 'utf8')).version === 159);
  check('Successful writes leave no temporary files', !fs.readdirSync(runtime).some(name => name.endsWith('.tmp')));

  // A permanent sharing violation is deterministic here, while the same error
  // was exercised with real Windows file handles above. Inject only subsequent
  // run-record replacements in this isolated child, never the initial record.
  const faultHook = path.join(runtime, 'locked-run-writes.cjs');
  fs.writeFileSync(faultHook, `const fs=require('node:fs'),path=require('node:path');const rename=fs.renameSync;fs.renameSync=function(from,to){if(path.basename(path.dirname(String(to)))==='runs'&&fs.existsSync(to))throw Object.assign(Error('Injected persistent run-record sharing violation'),{code:'EPERM'});return rename.call(this,from,to)};`);
  const serverRuntime = path.join(runtime, 'server'), port = Number(process.env.MING_STORAGE_REVIEW_PORT ?? 4474), base = `http://127.0.0.1:${port}`;
  let occupied = false; try { await fetch(base + '/api/capabilities', { signal: AbortSignal.timeout(200) }); occupied = true; } catch {}
  if (occupied) throw Error('Refuse occupied storage-review port');
  const log = fs.openSync(path.join(runtime, 'server.log'), 'a');
  const server = spawn(process.execPath, ['--require', faultHook, 'apps/server/dist/index.js'], { cwd: root, windowsHide: true, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MING_RUNTIME_DIR: serverRuntime, MING_PUBLIC_DEMO: '0', MING_TEST_MODE: '0', PROVIDER_API_KEY: '', PROVIDER_BASE_URL: '', PROVIDER_MODEL_ID: '' }, stdio: ['ignore', log, log] });
  children.add(server); fs.closeSync(log);
  async function api(endpoint, body) {
    const response = await fetch(base + endpoint, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const data = await response.json(); if (!response.ok) throw Error(`${endpoint}: HTTP ${response.status}`); return data;
  }
  let ready = false;
  for (let i = 0; i < 150; i++) { try { ready = (await api('/api/capabilities')).ok; if (ready) break; } catch {} await wait(40); }
  if (!ready) throw Error('Storage-review server did not become ready');
  const { plan } = await api('/api/plan?variant=shipboard-buggy');
  const { runId } = await api('/api/run', { variant: 'shipboard-buggy', confirmed: true, confirmedPlanId: plan.planId, confirmedPlanFingerprint: plan.fingerprint });
  let outcome;
  for (let i = 0; i < 100; i++) { outcome = (await api(`/api/run/${runId}`)).run; if (outcome.status === 'error') break; await wait(40); }
  check('Persistent final-write failure returns an explicit unsaved terminal error', outcome.status === 'error' && outcome.fatalError.includes('could not be saved') && outcome.fatalError.includes('only until the service restarts'));
  check('Persistent final-write failure does not crash the server', (await api('/api/capabilities')).ok && server.exitCode === null && server.signalCode === null);
  check('Unsaved terminal failure is consistent in progress and history', (await api(`/api/run/${runId}/progress`)).progress.status === 'error' && (await api('/api/history')).runs.find(run => run.runId === runId)?.status === 'error');
  const onDisk = JSON.parse(fs.readFileSync(path.join(serverRuntime, 'runs', `${runId}.json`), 'utf8'));
  check('API fallback preserves the original on-disk record without claiming persistence', onDisk.status === 'pending' && !onDisk.finishedAt && !outcome.criteria.some(criterion => criterion.status === 'passed'));
} catch (error) { report.error = String(error); console.error(report.error); process.exitCode = 1; }
finally {
  for (const child of children) await stop(child);
  report.finishedAt = new Date().toISOString(); report.passed = report.checks.filter(c => c.passed).length; report.total = report.checks.length;
  fs.writeFileSync(path.join(runtime, 'review-report.json'), JSON.stringify(report, null, 2));
  console.log(`Report: ${path.join(runtime, 'review-report.json')} (${report.passed}/${report.total})`);
}
