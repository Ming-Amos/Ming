import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Preview of the packaged Worker, its live browser sample and recorded evidence.
const root = fileURLToPath(new URL('../..', import.meta.url));
const output = path.join(root, 'dist', 'sites');
const client = path.resolve(output, 'client');
const { default: worker } = await import(pathToFileURL(path.join(output, 'server', 'index.js')));
const port = Number(process.env.MING_PREVIEW_PORT ?? '4182');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid MING_PREVIEW_PORT');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const env = { ASSETS: { async fetch(request) {
  let relative;
  try { relative = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '') || 'index.html'; }
  catch { return new Response('Invalid path', { status: 400 }); }
  const file = path.resolve(client, relative);
  if (!file.startsWith(client + path.sep) || relative.includes('\\') || relative.includes('\0')) return new Response('Not found', { status: 404 });
  try {
    const content = await fs.readFile(file);
    return new Response(request.method === 'HEAD' ? null : content, { headers: { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' } });
  } catch (error) {
    if (['ENOENT', 'EISDIR'].includes(error.code)) return new Response('Not found', { status: 404 });
    throw error;
  }
} } };
const server = http.createServer(async (incoming, outgoing) => {
  try {
    const request = new Request(`http://127.0.0.1:${port}${incoming.url}`, { method: incoming.method, headers: incoming.headers });
    const response = await worker.fetch(request, env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500, { 'content-type': 'text/plain' });
    outgoing.end('Public-demo preview error');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Ming hosted preview: http://127.0.0.1:${port}`));
