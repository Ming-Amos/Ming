import { zipSync } from 'fflate';
import { importProject, IMPORT_LIMITS } from './importer';
import type { GitHubSource, UploadedProject } from './types';

const BUILD_HELP = 'Import a browser-ready HTML site or select its committed dist/build folder. Ming does not install dependencies, compile source, or start a backend. Build it locally first and upload the static output if it is not in the repository.';
const API_LIMIT = 2 * 1024 * 1024;
const TREE_LIMIT = 10000;
const SHA = /^[a-f0-9]{40}$/i;
const webExtension = /\.(?:html?|css|m?js|json|png|jpe?g|svg|webp|gif|ico|woff2?|ttf|txt)$/i;
const secretPart = /^(?:\.env(?:\.|$)|\.git$|\.ssh$|credentials?(?:\.|$)|secrets?(?:\.|$)|id_(?:rsa|ed25519|ecdsa)(?:\.|$))/i;
const ignoredPart = /^(?:\.github|node_modules|\.next|\.venv|coverage|__MACOSX)$/i;
const ignoredFile = /^(?:readme(?:\.(?:md|markdown|txt|rst))?$|licen[sc]e(?:\.|$)|changelog(?:\.(?:md|markdown|txt|rst))?$|package(?:-lock)?\.json$|tsconfig(?:\.[^/]*)?\.json$|jsconfig\.json$|(?:vite|vitest|webpack|rollup|tailwind|postcss|eslint|prettier|next|nuxt)\.config\.)/i;

export interface GitHubTreeFile { path: string; sha: string; size: number; mode: string; }
export interface GitHubCandidate { directory: string; entries: string[]; fileCount: number; totalBytes: number; eligible: boolean; reason?: string; }
export interface GitHubInspection {
  owner: string; repo: string; url: string; ref: string; commit: string; defaultBranch: string;
  selectedDirectory: string; candidates: GitHubCandidate[]; warnings: string[]; tree: GitHubTreeFile[];
}
export interface GitHubImportProgress { completed: number; total: number; path: string; }
interface InspectionSnapshot { owner: string; repo: string; url: string; ref: string; commit: string; tree: GitHubTreeFile[]; }
const inspections = new WeakMap<GitHubInspection, InspectionSnapshot>();
const encoder = new TextEncoder();

function fail(message: string): never { throw new Error(message); }
function aborted(signal?: AbortSignal): void { if (signal?.aborted) throw new DOMException('GitHub import cancelled.', 'AbortError'); }
function string(value: unknown, label: string): string { if (typeof value !== 'string' || !value) fail(`GitHub returned invalid ${label}. Try inspecting the repository again.`); return value; }
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`GitHub returned invalid ${label}.`);
  return value as Record<string, unknown>;
}

/** Repository roots only: refs and folders are supplied in separate, unambiguous fields. */
export function parseGitHubRepositoryUrl(input: string): { owner: string; repo: string; url: string } {
  let parsed: URL;
  try { parsed = new URL(input.trim()); } catch { return fail('Enter a public repository URL such as https://github.com/owner/repository.'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) {
    fail('Use an HTTPS github.com repository URL without credentials, query parameters, or a fragment. No GitHub token is needed.');
  }
  const match = /^\/([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)\/([a-z\d_.-]{1,104})\/?$/i.exec(parsed.pathname);
  if (!match) fail('Paste the repository root URL: https://github.com/owner/repository. Set the branch and static folder in their separate fields.');
  const owner = match[1], repo = match[2].replace(/\.git$/i, '');
  if (!repo || repo === '.' || repo === '..' || repo.length > 100) fail('This GitHub repository name is invalid.');
  return { owner, repo, url: `https://github.com/${owner}/${repo}` };
}

function directoryPath(input: string): string {
  const value = input.trim().replace(/\/$/, '');
  if (!value || value === '.') return '';
  validatePath(value);
  if (value.split('/').some(part => secretPart.test(part) || ignoredPart.test(part))) fail('Choose a static website folder, not private configuration or dependency folders.');
  return value;
}
function validatePath(path: string): void {
  if (!path || path.length > 400 || /[\\\u0000-\u001f\u007f:%]/.test(path) || path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..' || part.trim() !== part)) {
    fail('The repository contains an unsupported or unsafe file path. Use ordinary relative static-file paths without traversal or encoded segments.');
  }
}
function isWebFile(path: string): boolean {
  const parts = path.split('/'), name = parts[parts.length - 1];
  return webExtension.test(name) && !parts.some(part => secretPart.test(part) || ignoredPart.test(part)) && !ignoredFile.test(name) && !/\.(?:pem|key|p12|pfx|keystore)$/i.test(name);
}
function filesIn(tree: GitHubTreeFile[], directory: string): GitHubTreeFile[] {
  return tree.filter(file => isWebFile(file.path) && (!directory || file.path.startsWith(`${directory}/`)));
}
function candidate(tree: GitHubTreeFile[], directory: string): GitHubCandidate {
  const files = filesIn(tree, directory), prefix = directory ? directory.length + 1 : 0;
  const entries = files.filter(file => /\.html?$/i.test(file.path)).map(file => file.path.slice(prefix)).sort((a, b) => {
    const rank = (path: string) => /^index\.html?$/i.test(path) ? 0 : /(?:^|\/)index\.html?$/i.test(path) ? 1 : 2;
    return rank(a) - rank(b) || a.split('/').length - b.split('/').length || a.localeCompare(b);
  });
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  let reason: string | undefined;
  if (!entries.length) reason = `No HTML entry was found in this folder. ${BUILD_HELP}`;
  else if (files.some(file => !['100644', '100755'].includes(file.mode))) reason = 'This folder includes a symbolic link or unsupported Git object. Commit real static files instead.';
  else if (files.length > IMPORT_LIMITS.files) reason = 'This folder exceeds the 100-file limit. Select a smaller static build folder.';
  else if (totalBytes > IMPORT_LIMITS.unpackedBytes) reason = 'This folder exceeds the 20 MB unpacked limit. Select a smaller static build.';
  else if (files.some(file => file.size > IMPORT_LIMITS.inputBytes)) reason = 'A file in this folder exceeds the 10 MB download limit.';
  return { directory, entries, fileCount: files.length, totalBytes, eligible: !reason, ...(reason ? { reason } : {}) };
}

async function boundedFetch(url: string, maxBytes: number, signal: AbortSignal | undefined, api: boolean): Promise<Uint8Array> {
  aborted(signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      method: 'GET', credentials: 'omit', mode: 'cors', redirect: 'error', cache: 'no-store', signal: controller.signal,
      ...(api ? { headers: { Accept: 'application/vnd.github+json' } } : {}),
    });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) fail('GitHub denied or rate-limited this request. Anonymous GitHub access has limits; wait and retry, or download the static folder and upload its ZIP. Do not paste an access token.');
      if (response.status === 404) fail('GitHub could not find this public repository, branch, or file. Check the URL and branch. Private repositories are not supported; upload a static ZIP instead.');
      if (response.status === 409 || response.status === 422) fail('GitHub cannot read this repository or revision. It may be empty, or the branch/tag may be invalid.');
      fail(`GitHub returned HTTP ${response.status}. Retry later or upload a static ZIP.`);
    }
    // Content-Length counts encoded transport bytes, while Fetch yields decoded bytes.
    // GitHub does not expose Content-Encoding to cross-origin browser JavaScript, so
    // even a three-byte file can advertise a 23-byte gzip body. Keep a separate wire
    // ceiling and enforce the exact decoded limit while reading, then verify its SHA.
    const length = Number(response.headers.get('content-length') || 0);
    const wireLimit = (api ? API_LIMIT : IMPORT_LIMITS.inputBytes) + 64 * 1024;
    if (length > wireLimit) fail('The GitHub response exceeds the import size limit. Select a smaller static folder or upload its ZIP.');
    if (!response.body) fail('GitHub returned an empty response body. Retry or upload a static ZIP.');
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        size += next.value.length;
        if (size > maxBytes) { await reader.cancel(); fail('The GitHub download exceeds the import size limit. Select a smaller static folder.'); }
        chunks.push(next.value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('GitHub import cancelled.', 'AbortError');
    if (controller.signal.aborted) fail('GitHub took too long to respond. Retry or upload the static folder as a ZIP.');
    if (error instanceof TypeError) fail('Could not reach GitHub from this browser. Check your connection, or upload a downloaded static ZIP. Redirected repositories should use their current GitHub URL.');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
async function apiJson(url: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const bytes = await boundedFetch(url, API_LIMIT, signal, true);
  try { return object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), 'API response'); }
  catch (error) { if (error instanceof SyntaxError || error instanceof TypeError) fail('GitHub returned an unreadable response. Retry or upload a static ZIP.'); throw error; }
}

export async function inspectGitHubRepository(input: { url: string; ref?: string; directory?: string; signal?: AbortSignal }): Promise<GitHubInspection> {
  const parsed = parseGitHubRepositoryUrl(input.url), directory = directoryPath(input.directory ?? '');
  const api = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
  const metadata = await apiJson(api, input.signal);
  if (metadata.private !== false) fail('Only public GitHub repositories can be imported. For a private project, upload its static HTML or ZIP locally; no GitHub token is accepted.');
  const defaultBranch = string(metadata.default_branch, 'default branch');
  const ref = input.ref?.trim() || defaultBranch;
  if (ref.length > 250 || /[\u0000-\u001f\u007f]/.test(ref)) fail('Use a valid branch, tag, or commit, up to 250 characters.');
  const commitData = await apiJson(`${api}/commits/${encodeURIComponent(ref)}`, input.signal);
  const commit = string(commitData.sha, 'commit');
  const treeSha = string(object(object(commitData.commit, 'commit metadata').tree, 'commit tree').sha, 'tree SHA');
  if (!SHA.test(commit) || !SHA.test(treeSha)) fail('GitHub returned an invalid immutable revision. Inspect the repository again.');
  const treeData = await apiJson(`${api}/git/trees/${treeSha}?recursive=1`, input.signal);
  if (treeData.truncated !== false || !Array.isArray(treeData.tree) || treeData.tree.length > TREE_LIMIT) fail('This repository is too large to inspect completely. Upload the required static build folder as a ZIP instead.');
  if (typeof treeData.sha !== 'string' || treeData.sha.toLowerCase() !== treeSha.toLowerCase()) fail('GitHub returned a tree that does not match the pinned commit. Inspect the repository again.');
  const tree: GitHubTreeFile[] = [], names = new Set<string>();
  for (const value of treeData.tree) {
    const item = object(value, 'tree entry'), path = string(item.path, 'file path');
    validatePath(path);
    if (item.type !== 'blob') continue;
    // Configuration and secrets are excluded before any file-content request.
    if (!isWebFile(path)) continue;
    const name = path.normalize('NFC').toLowerCase();
    if (names.has(name)) fail('Repository file names differ only by case or Unicode normalization. Use unambiguous static file names.');
    names.add(name);
    const sha = string(item.sha, 'file SHA'), mode = string(item.mode, 'file mode');
    if (!SHA.test(sha) || !Number.isSafeInteger(item.size) || (item.size as number) < 0) fail('GitHub returned invalid file size or checksum metadata.');
    tree.push({ path, sha, mode, size: item.size as number });
  }
  if (!tree.some(file => /\.html?$/i.test(file.path))) fail(`This repository has no browser-ready HTML entry. ${BUILD_HELP}`);
  const directories = new Set<string>(['', directory]);
  for (const file of tree.filter(file => /\.html?$/i.test(file.path))) {
    const parts = file.path.split('/'); parts.pop();
    directories.add(parts.join('/'));
    for (let count = 1; count <= parts.length; count++) if (/^(?:dist|build|public|docs|site|www)$/i.test(parts[count - 1])) directories.add(parts.slice(0, count).join('/'));
    if (directories.size > 200) fail('This repository contains too many possible website folders. Upload the required static build folder as a ZIP instead.');
  }
  const candidates = [...directories].map(value => candidate(tree, value)).sort((a, b) => {
    const rank = (value: GitHubCandidate) => !value.eligible ? 9 : /(?:^|\/)(?:dist|build)$/i.test(value.directory) ? 0 : value.directory === '' ? 1 : /(?:^|\/)(?:public|docs|site|www)$/i.test(value.directory) ? 2 : 3;
    return rank(a) - rank(b) || a.directory.split('/').length - b.directory.split('/').length || a.directory.localeCompare(b.directory);
  });
  const selectedDirectory = directory || candidates.find(value => value.eligible)?.directory || '';
  if (directory && !candidates.find(value => value.directory === directory)?.eligible) fail(candidate(tree, directory).reason ?? 'This static folder is not available.');
  const warnings = ['Public files are downloaded directly from GitHub into this browser. No repository credentials are requested.', 'Only browser-ready static files are imported. Backend code, dependency installation, and network-dependent apps are not supported.'];
  const inspection: GitHubInspection = { ...parsed, ref, commit, defaultBranch, selectedDirectory, candidates, warnings, tree };
  inspections.set(inspection, { ...parsed, ref, commit, tree: tree.map(file => ({ ...file })) });
  return inspection;
}

async function gitBlobSha(bytes: Uint8Array): Promise<string> {
  const prefix = encoder.encode(`blob ${bytes.length}\0`), objectBytes = new Uint8Array(prefix.length + bytes.length);
  objectBytes.set(prefix); objectBytes.set(bytes, prefix.length);
  const hash = await crypto.subtle.digest('SHA-1', objectBytes);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
}

/** Downloads only the selected, immutable static snapshot, then reuses ZIP validation. */
export async function importGitHubProject(options: { inspection: GitHubInspection; directory?: string; signal?: AbortSignal; onProgress?: (progress: GitHubImportProgress) => void }): Promise<UploadedProject & { source: GitHubSource }> {
  const snapshot = inspections.get(options.inspection);
  if (!snapshot) fail('Inspect the public repository before importing it.');
  aborted(options.signal);
  const directory = directoryPath(options.directory ?? options.inspection.selectedDirectory);
  const selection = candidate(snapshot.tree, directory);
  if (!selection.eligible) fail(selection.reason ?? 'Choose a supported static folder.');
  const files = filesIn(snapshot.tree, directory), packed: Record<string, Uint8Array> = Object.create(null);
  let downloaded = 0;
  for (const [index, file] of files.entries()) {
    aborted(options.signal);
    options.onProgress?.({ completed: index, total: files.length, path: file.path });
    const path = file.path.split('/').map(encodeURIComponent).join('/');
    const bytes = await boundedFetch(`https://raw.githubusercontent.com/${snapshot.owner}/${snapshot.repo}/${snapshot.commit}/${path}`, Math.min(file.size, IMPORT_LIMITS.inputBytes), options.signal, false);
    if (bytes.length !== file.size || await gitBlobSha(bytes) !== file.sha.toLowerCase()) fail(`GitHub content did not match the pinned revision for ${file.path}. Inspect again; no partial project was imported.`);
    downloaded += bytes.length;
    if (downloaded > IMPORT_LIMITS.unpackedBytes) fail('Downloaded static files exceed the 20 MB limit.');
    const relative = directory ? file.path.slice(directory.length + 1) : file.path;
    packed[relative] = bytes;
    options.onProgress?.({ completed: index + 1, total: files.length, path: file.path });
  }
  aborted(options.signal);
  const zip = zipSync(packed, { level: 6 });
  if (zip.length > IMPORT_LIMITS.inputBytes) fail('The selected static snapshot exceeds the 10 MB compressed limit. Select a smaller folder.');
  const project = await importProject(new File([zip], `${snapshot.repo}.zip`, { type: 'application/zip' }));
  aborted(options.signal);
  const source: GitHubSource = { kind: 'github', url: snapshot.url, commit: snapshot.commit, ref: snapshot.ref, directory };
  return { ...project, name: `${snapshot.repo}${directory ? ` / ${directory}` : ''}`, source };
}
