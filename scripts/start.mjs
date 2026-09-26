import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const childEnvironment = { ...process.env };
const runtimeRoot = path.resolve(root, 'runtime');
let publicRuntime = null;
function cleanPublicRuntime() {
  if (!publicRuntime) return;
  const resolved = path.resolve(publicRuntime);
  if (path.dirname(resolved) !== runtimeRoot || !path.basename(resolved).startsWith('public-demo-')) {
    throw new Error('Refusing cleanup outside the owned public snapshot directory');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
  publicRuntime = null;
}
// Public mode always gets a new isolated snapshot of the explicitly reviewed
// bundle. Never merge with the user's runtime or an existing override directory.
if (process.env.MING_PUBLIC_DEMO === '1') {
  const source = path.join(root, 'docs/judge-evidence/runtime');
  if (!fs.existsSync(source)) {
    console.error('Reviewed demo evidence is missing. Build the demo evidence bundle first.');
    process.exit(1);
  }
  fs.mkdirSync(runtimeRoot, { recursive: true });
  publicRuntime = fs.mkdtempSync(path.join(runtimeRoot, 'public-demo-'));
  try {
    fs.cpSync(source, publicRuntime, { recursive: true, force: false });
    childEnvironment.MING_RUNTIME_DIR = publicRuntime;
  } catch (error) {
    cleanPublicRuntime();
    throw error;
  }
}
const server = spawn(process.execPath, [path.join(root, 'apps/server/dist/index.js')], {
  cwd: root, stdio: 'inherit', windowsHide: true, env: childEnvironment,
});
server.on('exit', code => { cleanPublicRuntime(); process.exitCode = code ?? 1; });
server.on('error', error => { cleanPublicRuntime(); console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
