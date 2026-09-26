import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../..', import.meta.url));
const output = path.join(root, 'dist', 'sites');
const evidence = path.join(root, 'docs', 'demo-evidence');
const web = path.join(root, 'apps', 'web', 'dist');
const metadataFile = path.join(root, '.openai', 'hosting.json');
const args = process.argv.slice(2);
if (args.some((arg, index) => arg !== '--archive' && args[index - 1] !== '--archive') || args.filter(arg => arg === '--archive').length > 1) {
  throw new Error('Usage: node scripts/public-demo/build.mjs [--archive ABSOLUTE_TAR_GZ_PATH]');
}
const archiveIndex = args.indexOf('--archive');
const archive = archiveIndex >= 0 ? args[archiveIndex + 1] : null;
if (archiveIndex >= 0 && (!archive || !path.isAbsolute(archive))) throw new Error('--archive requires an absolute destination path');

const data = JSON.parse(fs.readFileSync(path.join(evidence, 'api-responses.json'), 'utf8'));
if (data.schemaVersion !== 1 || !data.responses || Array.isArray(data.responses) || typeof data.responses !== 'object') {
  throw new Error('Expected {schemaVersion:1,responses:{"/api/history":<complete wire JSON>,...}}');
}
for (const required of ['/api/history', '/api/targets', '/api/plan', '/api/repair-tasks']) {
  if (!Object.hasOwn(data.responses, required)) throw new Error('Missing reviewed wire response: ' + required);
}
for (const [route, body] of Object.entries(data.responses)) {
  if (!route.startsWith('/api/') || /[\r\n#]/.test(route)) throw new Error('Invalid reviewed API route: ' + route);
  const url = new URL(route, 'https://ming.invalid');
  url.searchParams.sort();
  if (route !== url.pathname + url.search || url.origin !== 'https://ming.invalid') throw new Error('API route must be canonical: ' + route);
  if (!body || typeof body !== 'object') throw new Error('Wire responses must be objects: ' + route);
  if (/^\/api\/run\/[^/]+$/.test(url.pathname) && !['passed', 'failed', 'error'].includes(body.run?.status)) {
    throw new Error('Public evidence must contain terminal run records: ' + route);
  }
}
if (!fs.existsSync(path.join(web, 'index.html'))) throw new Error('Build apps/web before preparing the public demo');
const hosting = fs.existsSync(metadataFile) ? JSON.parse(fs.readFileSync(metadataFile, 'utf8')) : { d1: null, r2: null };
if (archive && (typeof hosting.project_id !== 'string' || !hosting.project_id)) {
  throw new Error('Archive publication requires the actual Sites project_id in .openai/hosting.json. Local build is available without --archive.');
}

// Delete only the exact generated output directory under this repository's dist.
if (path.dirname(path.resolve(output)) !== path.resolve(root, 'dist') || path.basename(output) !== 'sites') {
  throw new Error('Refusing an output directory outside this repository');
}
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, 'server'), { recursive: true });
fs.mkdirSync(path.join(output, '.openai'), { recursive: true });
fs.cpSync(web, path.join(output, 'client'), { recursive: true });

const screenshotSource = path.join(evidence, 'runtime', 'screenshots');
const screenshotTarget = path.join(output, 'client', 'demo-evidence', 'screenshots');
fs.mkdirSync(screenshotTarget, { recursive: true });
const screenshots = [];
if (fs.existsSync(screenshotSource)) {
  for (const entry of fs.readdirSync(screenshotSource, { withFileTypes: true })) {
    if (!entry.isFile() || !/^[A-Za-z0-9_.-]+\.(png|jpe?g|webp)$/i.test(entry.name)) {
      throw new Error('Unexpected item in reviewed screenshots: ' + entry.name);
    }
    fs.copyFileSync(path.join(screenshotSource, entry.name), path.join(screenshotTarget, entry.name));
    screenshots.push(entry.name);
  }
}

// An absent screenshot must fail packaging, never become an apparently complete report.
const screenshotNames = new Set(screenshots);
function checkScreenshots(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (key === 'screenshotPath' && typeof item === 'string' && item) {
      const name = path.basename(item.replaceAll('\\', '/'));
      if (!screenshotNames.has(name)) throw new Error('Referenced screenshot is not in the reviewed bundle: ' + name);
    }
    checkScreenshots(item);
  }
}
checkScreenshots(data.responses);

const workerSource = fs.readFileSync(new URL('./worker.mjs', import.meta.url), 'utf8');
const bundle = JSON.stringify({ schemaVersion: 1, responses: data.responses, screenshots });
fs.writeFileSync(path.join(output, 'server', 'index.js'), workerSource + '\nexport default createWorker(' + bundle + ');\n');
fs.writeFileSync(path.join(output, '.openai', 'hosting.json'), JSON.stringify(hosting, null, 2) + '\n');
console.log(JSON.stringify({ output, recordedRoutes: Object.keys(data.responses).length, screenshots: screenshots.length }));

if (archive) {
  // Windows-compatible equivalent of the Sites package helper's staging contract:
  // tar root dist/{client,server,.openai}; no source, .env, local runtime, or tokens.
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'ming-sites-'));
  try {
    fs.cpSync(output, path.join(stage, 'dist'), { recursive: true });
    fs.mkdirSync(path.dirname(archive), { recursive: true });
    execFileSync('tar', ['-czf', archive, '-C', stage, 'dist'], { stdio: 'pipe' });
    const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).split(/\r?\n/);
    for (const required of ['dist/server/index.js', 'dist/client/index.html', 'dist/.openai/hosting.json']) {
      if (!entries.includes(required)) throw new Error('Archive missing ' + required);
    }
    console.log(JSON.stringify({ archive, files: entries.filter(Boolean).length }));
  } finally {
    const resolvedStage = path.resolve(stage);
    if (path.dirname(resolvedStage) !== path.resolve(os.tmpdir()) || !path.basename(resolvedStage).startsWith('ming-sites-')) {
      throw new Error('Refusing cleanup of an unexpected staging path');
    }
    fs.rmSync(resolvedStage, { recursive: true, force: true });
  }
}
