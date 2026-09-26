/** Local browser-origin boundary checks. Uses only owned servers, no browser/model calls. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.MING_REVIEW_PORT ?? 4415);
const checks = [];
function request(method, route, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method, headers, timeout: 3000 }, res => {
      res.resume(); res.on('end', () => resolve({ status: res.statusCode, cors: res.headers['access-control-allow-origin'] ?? null }));
    });
    req.on('timeout', () => req.destroy(Error('request timeout'))); req.on('error', reject); req.end(method === 'POST' ? '{}' : undefined);
  });
}
async function suite(readOnly, cases) {
  let occupied = false;
  try { await request('GET', '/api/capabilities'); occupied = true; } catch {}
  if (occupied) throw Error(`Port ${port} occupied; refusing to attach`);
  const child = spawn(process.execPath, ['apps/server/dist/index.js'], { cwd: root, windowsHide: true,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MING_PUBLIC_DEMO: readOnly ? '1' : '0' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { await request('GET', '/api/capabilities'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
    for (const [label, method, route, headers, status, cors] of cases) {
      const result = await request(method, route, headers);
      const passed = result.status === status && result.cors === cors;
      checks.push({ label, passed, ...result }); console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
      if (!passed) throw Error(JSON.stringify({ label, result, expected: { status, cors } }));
    }
  } finally {
    if (child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
  }
}
try {
  await suite(false, [
    ['CLI/MCP reads', 'GET', '/api/capabilities', {}, 200, null],
    ['Same-process UI', 'GET', '/api/capabilities', { Origin: `http://localhost:${port}` }, 200, `http://localhost:${port}`],
    ['Vite UI preflight', 'OPTIONS', '/api/run', { Origin: 'http://127.0.0.1:4000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }, 204, 'http://127.0.0.1:4000'],
    ['Hostile preflight', 'OPTIONS', '/api/run', { Origin: 'https://attacker.invalid', 'Access-Control-Request-Method': 'POST' }, 403, null],
    ['Hostile direct JSON request', 'POST', '/api/run', { Origin: 'https://attacker.invalid', 'Content-Type': 'application/json' }, 403, null],
    ['Opaque origin', 'GET', '/api/capabilities', { Origin: 'null' }, 403, null],
    ['Cross-site resource request', 'GET', '/api/projects/fake/context', { 'Sec-Fetch-Site': 'cross-site' }, 403, null],
    ['Unexpected local port', 'GET', '/api/capabilities', { Origin: 'http://localhost:5555' }, 403, null],
    ['DNS-rebinding Host header', 'GET', '/api/capabilities', { Host: `attacker.invalid:${port}` }, 403, null],
  ]);
  await suite(true, [
    ['Public evidence readable', 'GET', '/api/capabilities', { Host: 'public.example', Origin: 'https://reader.example' }, 200, 'https://reader.example'],
    ['Public mutation rejected', 'POST', '/api/run', {}, 403, null],
    ['Public browser inspection rejected', 'GET', '/api/projects/fake/context', {}, 403, null],
  ]);
} catch (error) { console.error(error); process.exitCode = 1; }
finally {
  const file = path.join(root, 'runtime/review-origin-boundary.json');
  fs.writeFileSync(file, JSON.stringify({ author: 'Codex', at: new Date().toISOString(), passed: process.exitCode !== 1, checks }, null, 2));
  console.log(`REPORT ${file}`);
}
