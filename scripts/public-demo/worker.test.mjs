import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorker } from './worker.mjs';

// Adapter unit-test data only. These values are never exported as product evidence.
const comparison = { ok: true, comparison: { verifiedRepair: false, reason: 'unit test only' } };
const fixture = { schemaVersion: 1, screenshots: ['test.png'], responses: {
  '/api/history': { ok: true, runs: [{ runId: 'unit-test-run', status: 'failed' }] },
  '/api/repair-tasks/test/comparison': comparison,
  '/api/plan?variant=todo-buggy': { ok: true, plan: { source: 'fixture', fingerprint: 'unit-test-only' } },
} };
const worker = createWorker(fixture);
const request = (pathname, init) => new Request('https://example.test' + pathname, init);
const unusedAssets = { ASSETS: { fetch() { throw new Error('Unexpected static asset request'); } } };

test('returns recorded JSON unchanged; does not recompute repair success', async () => {
  const response = await worker.fetch(request('/api/repair-tasks/test/comparison'), unusedAssets);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), comparison);
});
test('serves exact variant route and rejects unknown API routes even for HTML requests', async () => {
  const response = await worker.fetch(request('/api/plan?variant=todo-buggy'), unusedAssets);
  assert.deepEqual(await response.json(), fixture.responses['/api/plan?variant=todo-buggy']);
  assert.equal((await worker.fetch(request('/api/unknown', { headers: { accept: 'text/html' } }), unusedAssets)).status, 404);
  assert.equal((await worker.fetch(request('/api/plan?variant=unknown'), unusedAssets)).status, 404);
});
test('blocks writes and admin access without calling an asset or model service', async () => {
  for (const method of ['POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS']) {
    assert.equal((await worker.fetch(request('/api/run', { method }), unusedAssets)).status, 403);
  }
  assert.equal((await worker.fetch(request('/admin/test-transport'), unusedAssets)).status, 404);
});
test('keeps recorded APIs read-only and advertises a separate browser-owned live sample', async () => {
  const capabilities = await (await worker.fetch(request('/api/capabilities'), unusedAssets)).json();
  assert.equal(capabilities.readOnly, true);
  assert.equal(capabilities.demoMode, 'recorded-evidence');
  assert.deepEqual(capabilities.uploadedProjects.github, { available: true, visibility: 'public', build: false, commitPinned: true, serverUpload: false });
  assert.equal(capabilities.uploadedProjects.modelCalls, 'explicit-draft-only');
  assert.equal(capabilities.uploadedProjects.planner.confirmedUserActionRequired, true);
  assert.deepEqual(capabilities.liveTrial, { available: true, path: '/#trial', execution: 'visitor-browser', scope: 'bundled-shipboard', captureKind: 'dom-render', modelCalls: false });
  const provider = await (await worker.fetch(request('/api/provider/status'), unusedAssets)).json();
  assert.equal(provider.status.configured, false);
});

test('dispatches the optional planner before recorded-route write guards without enabling other writes', async () => {
  const status = await (await worker.fetch(request('/api/upload/planner/status'), unusedAssets)).json();
  assert.equal(status.configured, false);
  const unconfigured = await worker.fetch(request('/api/upload/planner/draft', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: '{}' }), unusedAssets);
  assert.equal(unconfigured.status, 503);
  assert.match((await unconfigured.json()).error, /manual plan/i);
  assert.equal((await worker.fetch(request('/api/plan', { method: 'POST', body: '{}' }), unusedAssets)).status, 403);
});

test('a missing trial document never falls back to the application shell', async () => {
  const seen = [];
  const env = { ASSETS: { async fetch(req) { seen.push(new URL(req.url).pathname); return new Response('Missing sample', { status: 404 }); } } };
  const response = await worker.fetch(request('/trial/missing.html', { headers: { accept: 'text/html' } }), env);
  assert.equal(response.status, 404);
  assert.deepEqual(seen, ['/trial/missing.html']);
});
test('serves only explicitly bundled screenshots with a safe asset path', async () => {
  const seen = [];
  const env = { ASSETS: { async fetch(req) { seen.push(new URL(req.url).pathname); return new Response('test image'); } } };
  assert.equal((await worker.fetch(request('/api/screenshots/test.png'), env)).status, 200);
  assert.deepEqual(seen, ['/demo-evidence/screenshots/test.png']);
  for (const pathname of ['/api/screenshots/missing.png', '/api/screenshots/%2e%2e%2fsecret.png', '/api/screenshots/%ZZ']) {
    assert.ok((await worker.fetch(request(pathname), unusedAssets)).status >= 400);
  }
});
test('HEAD responses retain status without the body', async () => {
  const response = await worker.fetch(request('/api/history', { method: 'HEAD' }), unusedAssets);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});
test('serves existing static assets and limits SPA fallback to HTML navigation', async () => {
  const seen = [];
  const env = { ASSETS: { async fetch(req) {
    const pathname = new URL(req.url).pathname;
    seen.push(pathname);
    return new Response(pathname, { status: pathname === '/index.html' || pathname === '/assets/app.js' ? 200 : 404 });
  } } };
  assert.equal((await worker.fetch(request('/assets/app.js'), env)).status, 200);
  const navigation = await worker.fetch(request('/workspace/one', { headers: { accept: 'text/html' } }), env);
  assert.equal(await navigation.text(), '/index.html');
  assert.equal((await worker.fetch(request('/assets/missing.js'), env)).status, 404);
  assert.deepEqual(seen, ['/assets/app.js', '/workspace/one', '/index.html', '/assets/missing.js']);
});
