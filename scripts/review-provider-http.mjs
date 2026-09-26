/**
 * Codex independent provider HTTP review. This is not Bob implementation work.
 * Project-local copy prepared by Codex; project root resolves relative to this file.
 * Uses Ming's built OpenAICompatibleTransport and a real loopback HTTP server.
 * Does not load .env, use TestFixtureTransport, start Ming, or contact a provider.
 * Run only after Ming has been rebuilt. No credentials/raw bodies are persisted.
 * Expected duration: approximately 35 seconds (includes the real 30-second limit).
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const MING_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(MING_ROOT, 'apps/server/src/provider/openai-transport.ts');
const BUILT = path.join(MING_ROOT, 'apps/server/dist/provider/openai-transport.js');
const REPORT_DIR = path.join(MING_ROOT, 'runtime');
const startedAt = new Date().toISOString();
const reportPath = path.join(REPORT_DIR, 'review-provider-http-' +
  startedAt.replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8) + '.json');
const fakeKey = 'sk-codex-review-' + randomBytes(24).toString('hex');
const MODEL = 'codex-local-fixture-model';
const REQUIREMENT = 'Allow a nonempty local sample report to be submitted and retained after refresh.';
const PAGE_MARKER = 'CODEX_REVIEW_PAGE_CONTEXT_MARKER';
const checks = [];
const cases = [];
const sockets = new Set();
const streamTimers = new Set();
let server;
let port;
let activeCase = null;
let fatal = null;
let outsideLoopbackAttempts = 0;
let cleanup = null;
let restoreRequestGuards = () => {};
let artifacts = {};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function check(caseId, label, condition) {
  checks.push({ caseId, label, passed: Boolean(condition) });
  console.log((condition ? 'PASS ' : 'FAIL ') + caseId + ': ' + label);
}
function noSecret(value) {
  const text = JSON.stringify(value) ?? '';
  // Detect both the full sentinel and its identifiable prefix after truncation.
  return !text.includes(fakeKey) && !text.includes(fakeKey.slice(0, 12));
}
async function until(predicate, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  while (!predicate() && performance.now() < deadline) await delay(25);
  return predicate();
}

function validPlan() {
  return {
    planId: 'codex-http-fixture-plan', version: '1.0.0', source: 'generated',
    // Deliberately claims live: the trusted constructor setting must override it.
    transportProvenance: 'live',
    title: 'Local HTTP review plan', description: 'Synthetic independent test only',
    fingerprint: 'TO_BE_COMPUTED', createdAt: '2026-09-26T00:00:00.000Z',
    criteria: [{
      id: 'AC-01', title: 'Report form is visible',
      description: 'Synthetic transport fixture; browser execution is out of scope',
      requirementRef: REQUIREMENT, expectedBehavior: 'The report form is visible',
      openQuestions: [], contextMode: 'fresh',
      steps: [
        { id: 'S1', type: 'navigate', url: '{{TARGET_URL}}', description: 'Open configured sample' },
        { id: 'S2', type: 'assertVisible', value: 'Report', description: 'Check form text' },
      ],
    }],
  };
}
function successEnvelope(content = JSON.stringify(validPlan())) {
  return JSON.stringify({
    choices: [{ message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 17, completion_tokens: 23 },
  });
}

function stopTimer(timer) {
  clearInterval(timer);
  streamTimers.delete(timer);
}
function handleRequest(req, res) {
  const current = activeCase;
  if (!current) {
    res.writeHead(503, { Connection: 'close' });
    res.end();
    return;
  }
  current.requests += 1;
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    body += chunk;
    if (Buffer.byteLength(body) > 1024 * 1024) req.destroy();
  });
  req.on('error', () => {});
  res.on('error', () => {});
  req.on('end', () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    const messages = Array.isArray(parsed?.messages) ? parsed.messages : [];
    const user = messages.find((message) => message?.role === 'user');
    // Store only booleans/synthetic routing data, never headers or prompt bodies.
    current.observation = {
      methodMatches: req.method === 'POST',
      pathMatches: req.url === current.expectedPath,
      contentTypeMatches: /^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? ''),
      authorizationMatches: req.headers.authorization === 'Bearer ' + fakeKey,
      contentLengthMatches: Number(req.headers['content-length']) === Buffer.byteLength(body),
      modelMatches: parsed?.model === MODEL,
      systemMessagePresent: messages.some((message) => message?.role === 'system' && typeof message.content === 'string' && message.content.length > 0),
      requirementMapped: typeof user?.content === 'string' && user.content.includes(REQUIREMENT),
      pageContextMapped: typeof user?.content === 'string' && user.content.includes(PAGE_MARKER),
      linkageMapped: typeof user?.content === 'string' && user.content.includes('codex-review-project') && user.content.includes('codex-review-requirement'),
      promptContainsNoKey: !body.includes(fakeKey),
    };

    const headers = { 'Content-Type': 'application/json', Connection: 'close' };
    if (current.mode === 'success') {
      res.writeHead(200, headers); res.end(successEnvelope());
    } else if (current.mode === 'auth') {
      res.writeHead(401, headers);
      res.end(JSON.stringify({ error: 'Fixture authentication rejection: ' + fakeKey }));
    } else if (current.mode === 'auth_boundary') {
      res.writeHead(401, headers);
      // The full fake key crosses the transport's current 200-character excerpt.
      // Redaction must happen before truncation to avoid exposing a key fragment.
      res.end('X'.repeat(184) + fakeKey + ': fixture rejection');
    } else if (current.mode === 'quota') {
      res.writeHead(429, headers); res.end(JSON.stringify({ error: 'fixture rate limit' }));
    } else if (current.mode === 'malformed_envelope') {
      res.writeHead(200, headers); res.end('not-valid-json');
    } else if (current.mode === 'malformed_content') {
      res.writeHead(200, headers); res.end(successEnvelope('{ broken plan JSON'));
    } else if (current.mode === 'oversize') {
      res.writeHead(200, headers);
      res.end(Buffer.alloc(600 * 1024, 0x58));
    } else if (current.mode === 'trickle') {
      res.writeHead(200, headers);
      res.flushHeaders();
      res.write('{"choices":[');
      current.sentChunks = 1;
      // Data every 100 ms defeats the 25-second inactivity timeout.
      const timer = setInterval(() => {
        if (res.destroyed || res.writableEnded) { stopTimer(timer); return; }
        res.write(' ');
        current.sentChunks += 1;
      }, 100);
      streamTimers.add(timer);
      res.once('close', () => { current.responseClosed = true; stopTimer(timer); });
    } else {
      res.writeHead(500, headers); res.end('{}');
    }
  });
}

function installRequestGuards() {
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  http.request = function guardedRequest(options, ...args) {
    const target = typeof options === 'string' || options instanceof URL ? new URL(options) : options;
    if (target?.hostname !== '127.0.0.1' || Number(target.port) !== port) {
      outsideLoopbackAttempts += 1;
      throw new Error('Independent review blocked a request outside its loopback fixture');
    }
    return originalHttpRequest.call(this, options, ...args);
  };
  https.request = function blockedHttpsRequest() {
    outsideLoopbackAttempts += 1;
    throw new Error('Independent review permits only its local HTTP fixture');
  };
  restoreRequestGuards = () => {
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
  };
}

async function executeCase(Transport, spec) {
  const current = {
    id: spec.id, mode: spec.mode, expectedPath: spec.expectedPath,
    requests: 0, observation: null, sentChunks: 0, responseClosed: false,
  };
  activeCase = current;
  const transport = new Transport({
    label: 'Codex independent loopback HTTP review',
    baseUrl: 'http://127.0.0.1:' + port + spec.root,
    modelId: MODEL, apiKey: fakeKey, isLive: false,
  });
  const request = {
    requirement: REQUIREMENT,
    pageContext: {
      projectId: 'codex-review-project', targetVariant: 'normal',
      targetUrl: 'http://127.0.0.1:' + port + '/sample', title: 'Local fixture',
      elements: [{ label: PAGE_MARKER, role: 'textbox', selector: '#review-input' }],
      visibleTextSummary: 'Synthetic local context only', capturedAt: startedAt,
    },
    projectId: 'codex-review-project', requirementId: 'codex-review-requirement',
  };
  let outcome;
  let errorName = null;
  let watchdog;
  let watchdogTriggered = false;
  const start = performance.now();
  try {
    const maximum = spec.mode === 'trickle' ? 37_000 : 10_000;
    outcome = await Promise.race([
      transport.generate(request),
      new Promise((_, reject) => {
        watchdog = setTimeout(() => {
          watchdogTriggered = true;
          reject(new Error('Independent review watchdog expired'));
          for (const socket of sockets) socket.destroy();
        }, maximum);
      }),
    ]);
  } catch (error) {
    errorName = error instanceof Error ? error.name : 'UnknownThrownValue';
  } finally {
    clearTimeout(watchdog);
  }
  const elapsedMs = Math.round(performance.now() - start);
  check(spec.id, 'real HTTP fixture received exactly one request', current.requests === 1);
  check(spec.id, 'generate returned without throwing or watchdog intervention', !errorName && !watchdogTriggered);
  for (const [label, value] of Object.entries(current.observation ?? {})) check(spec.id, label, value);
  check(spec.id, 'captured HTTP request mapping exists', Boolean(current.observation));
  check(spec.id, 'outcome contains no full or truncated fake credential', noSecret(outcome));
  check(spec.id, 'usage records test provenance', outcome?.usage?.isLive === false);

  if (spec.mode === 'success') {
    check(spec.id, 'generation succeeds', outcome?.ok === true);
    check(spec.id, 'trusted test provenance overrides model live claim', outcome?.plan?.transportProvenance === 'test');
    check(spec.id, 'source remains generated', outcome?.plan?.source === 'generated');
    check(spec.id, 'project and requirement mapping preserved', outcome?.plan?.projectId === request.projectId && outcome?.plan?.requirementId === request.requirementId && outcome?.plan?.originalRequirement === REQUIREMENT);
    check(spec.id, 'reported token usage maps without fabrication', outcome?.usage?.inputTokens === 17 && outcome?.usage?.outputTokens === 23);
  } else {
    check(spec.id, 'generation reports an error', outcome?.ok === false && outcome?.usage?.status === 'error');
    if (spec.category) check(spec.id, 'expected error classification', outcome?.usage?.errorCategory === spec.category);
    if (spec.mode === 'oversize') {
      check(spec.id, 'response cap rejects before JSON parsing', /超过限制|too large|exceed|oversiz/i.test(outcome?.usage?.errorMessage ?? ''));
      check(spec.id, 'oversized response terminated promptly', elapsedMs < 10_000);
    }
    if (spec.mode === 'trickle') {
      check(spec.id, 'server continuously sent data beyond the idle timeout', current.sentChunks >= 250);
      check(spec.id, 'hard deadline fired around 30 seconds', elapsedMs >= 28_000 && elapsedMs <= 35_000);
    }
  }

  const closedBeforeForcedCleanup = await until(() => sockets.size === 0, 1_500);
  check(spec.id, 'fixture connections close without forced cleanup', closedBeforeForcedCleanup);
  if (spec.mode === 'trickle') check(spec.id, 'trickling response closes after cancellation', current.responseClosed);
  const forcedSockets = sockets.size;
  if (forcedSockets) {
    for (const socket of sockets) socket.destroy();
    await until(() => sockets.size === 0, 1_000);
  }
  cases.push({
    id: spec.id, mode: spec.mode, expectedPath: spec.expectedPath,
    elapsedMs, requestCount: current.requests, watchdogTriggered, errorName,
    outcomeOk: outcome?.ok ?? null,
    errorCategory: outcome?.usage?.errorCategory ?? null,
    provenanceIsTest: outcome?.usage?.isLive === false,
    credentialLeakDetected: !noSecret(outcome),
    sentChunks: current.sentChunks, closedBeforeForcedCleanup, forcedSockets,
  });
  activeCase = null;
}

async function main() {
  try {
    if (!fs.existsSync(BUILT)) throw new Error('BuildRequired');
    const sourceStat = fs.statSync(SOURCE);
    const builtStat = fs.statSync(BUILT);
    artifacts = {
      sourcePath: SOURCE, builtPath: BUILT,
      sourceSha256: sha256(SOURCE), builtSha256: sha256(BUILT),
      sourceModifiedAt: sourceStat.mtime.toISOString(),
      builtModifiedAt: builtStat.mtime.toISOString(),
    };
    if (sourceStat.mtimeMs > builtStat.mtimeMs) throw new Error('BuildRequired');
    const module = await import(pathToFileURL(BUILT).href);
    const Transport = module.OpenAICompatibleTransport ?? module.default?.OpenAICompatibleTransport;
    if (typeof Transport !== 'function') throw new Error('TransportExportUnavailable');
    server = http.createServer(handleRequest);
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.once('close', () => sockets.delete(socket));
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    port = server.address().port;
    installRequestGuards();

    const specs = [
      { id: 'root', mode: 'success', root: '', expectedPath: '/chat/completions' },
      { id: 'root_trailing_slash', mode: 'success', root: '/', expectedPath: '/chat/completions' },
      { id: 'version_root', mode: 'success', root: '/v1', expectedPath: '/v1/chat/completions' },
      { id: 'version_trailing_slash', mode: 'success', root: '/v1/', expectedPath: '/v1/chat/completions' },
      { id: 'provider_prefix', mode: 'success', root: '/compatible-mode/v1/', expectedPath: '/compatible-mode/v1/chat/completions' },
      { id: 'auth_redaction', mode: 'auth', category: 'auth' },
      { id: 'auth_truncation_redaction', mode: 'auth_boundary', category: 'auth' },
      { id: 'rate_limit', mode: 'quota', category: 'quota' },
      { id: 'malformed_http_json', mode: 'malformed_envelope', category: 'invalid_output' },
      { id: 'malformed_model_json', mode: 'malformed_content', category: 'invalid_output' },
      { id: 'response_byte_cap', mode: 'oversize' },
      { id: 'trickling_hard_deadline', mode: 'trickle', category: 'timeout' },
    ];
    for (const spec of specs) {
      await executeCase(Transport, { root: '/v1', expectedPath: '/v1/chat/completions', ...spec });
    }
    check('network_boundary', 'no request attempted outside the loopback fixture', outsideLoopbackAttempts === 0);
  } catch (error) {
    // Persist a small allowlisted reason, never raw errors, stacks or responses.
    const known = ['BuildRequired', 'TransportExportUnavailable'];
    fatal = {
      reason: error instanceof Error && known.includes(error.message) ? error.message : 'IndependentReviewSetupOrExecutionError',
      errorName: error instanceof Error ? error.name : 'UnknownThrownValue',
    };
    console.error('Independent HTTP review did not complete: ' + fatal.reason);
  } finally {
    const socketsBeforeCleanup = sockets.size;
    for (const timer of streamTimers) clearInterval(timer);
    streamTimers.clear();
    for (const socket of sockets) socket.destroy();
    if (server?.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
    await until(() => sockets.size === 0, 1_000);
    cleanup = { socketsBeforeCleanup, socketsRemaining: sockets.size, fixtureServerClosed: !server?.listening, fixtureTimersRemaining: streamTimers.size };
    restoreRequestGuards();
  }

  const failedChecks = checks.filter((item) => !item.passed).length;
  const report = {
    author: 'Codex independent test; not Bob implementation',
    scope: 'Real OpenAICompatibleTransport requests to a loopback HTTP fixture only',
    startedAt, finishedAt: new Date().toISOString(), artifacts,
    fakeCredentialOnly: true, rawRequestsAndResponsesSaved: false,
    externalRequestsPermitted: false, outsideLoopbackAttempts,
    passed: !fatal && failedChecks === 0 && cleanup.socketsRemaining === 0,
    checkCount: checks.length, failedChecks, fatal, cases, checks, cleanup,
    limits: 'Does not prove live-provider quality, UI behavior, or persistent server secret redaction; only this built transport and returned outcome were tested.',
  };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const serialized = JSON.stringify(report, null, 2);
  if (!noSecret(report)) throw new Error('ReportSafetyCheckFailed');
  fs.writeFileSync(reportPath, serialized + '\n', { encoding: 'utf8', flag: 'wx' });
  console.log('Report: ' + reportPath);
  console.log('Independent HTTP review: ' + (report.passed ? 'PASS' : 'FAIL') + ', ' + checks.length + ' checks, ' + failedChecks + ' failed');
  process.exitCode = report.passed ? 0 : 1;
}

await main();

