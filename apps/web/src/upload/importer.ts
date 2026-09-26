import { Inflate } from 'fflate';
import { parse } from 'acorn';
import type { PreparedDocument, UploadedFile, UploadedProject } from './types';

export const IMPORT_LIMITS = { inputBytes: 10 * 1024 * 1024, unpackedBytes: 20 * 1024 * 1024, files: 100 } as const;
const MAX_PREPARED = 40 * 1024 * 1024;
const BUILD_HELP = 'Build the project first, then ZIP the generated dist/build folder, or upload one self-contained HTML file. Server code and uncompiled source cannot run in this online browser sandbox.';
const MIME: Record<string, string> = {
  html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', txt: 'text/plain', md: 'text/markdown',
};
const utf8 = new TextDecoder('utf-8', { fatal: true });
const encode = new TextEncoder();
const ext = (path: string) => path.split('.').pop()?.toLowerCase() ?? '';
function fail(message: string): never { throw new Error(message); }
function text(bytes: Uint8Array, label: string): string {
  try { return utf8.decode(bytes); } catch { return fail(`${label} must use UTF-8 text encoding.`); }
}

function safePath(raw: string): string {
  if (!raw || raw.length > 400 || /[\\\u0000-\u001f\u007f:]/.test(raw) || raw.startsWith('/') || raw.includes('%')) {
    fail(`Unsafe archive path: ${raw.slice(0, 100)}. Use ordinary relative file paths without backslashes, drives, or encoded path segments.`);
  }
  const path = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part.trim() !== part)) fail(`Unsafe archive path: ${raw.slice(0, 100)}. Parent traversal and ambiguous paths are not supported.`);
  if (parts.some(part => /^\.env(?:\.|$)|^\.git$|^\.ssh$|^credentials(?:\.|$)|^secrets?(?:\.|$)|^id_(?:rsa|ed25519|ecdsa)(?:\.|$)/i.test(part)) || /\.(?:pem|key|p12|pfx|keystore)$/i.test(path)) {
    fail(`Remove private configuration or secrets before importing: ${path}.`);
  }
  if (parts.some(part => part === 'node_modules' || part === '.next' || part === '.venv')) fail(`This archive contains ${path}. ${BUILD_HELP}`);
  return path;
}

function mimeFor(path: string): string {
  const mime = MIME[ext(path)];
  if (!mime) fail(`Unsupported file: ${path}. ${BUILD_HELP}`);
  return mime;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const value of bytes) crc = crcTable[(crc ^ value) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry { path: string; mime: string; start: number; compressed: number; size: number; method: number; crc: number; }

/** Validate the complete central directory and every local header before inflation. */
function zipEntries(bytes: Uint8Array): ZipEntry[] {
  if (bytes.length < 22) fail('This ZIP is incomplete or invalid.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (offset: number) => view.getUint16(offset, true);
  const u32 = (offset: number) => view.getUint32(offset, true);
  let end = -1;
  for (let pos = bytes.length - 22; pos >= Math.max(0, bytes.length - 65557); pos--) {
    if (u32(pos) === 0x06054b50 && pos + 22 + u16(pos + 20) === bytes.length) { end = pos; break; }
  }
  if (end < 0) fail('This ZIP has no valid end record. Re-create it as a standard ZIP archive.');
  const count = u16(end + 10), centralSize = u32(end + 12), centralOffset = u32(end + 16);
  if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count) fail('Multi-part ZIP archives are not supported.');
  if (count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) fail('ZIP64 archives are not supported.');
  if (count > 500 || centralOffset + centralSize !== end) fail('The ZIP directory is invalid or contains too many entries.');
  const files: ZipEntry[] = [], names = new Set<string>(), ranges: Array<[number, number]> = [];
  let pos = centralOffset, total = 0;
  for (let index = 0; index < count; index++) {
    if (pos + 46 > end || u32(pos) !== 0x02014b50) fail('The ZIP directory is damaged.');
    const flags = u16(pos + 8), method = u16(pos + 10), crc = u32(pos + 16);
    const compressed = u32(pos + 20), size = u32(pos + 24), nameSize = u16(pos + 28), extraSize = u16(pos + 30), commentSize = u16(pos + 32);
    const local = u32(pos + 42), endEntry = pos + 46 + nameSize + extraSize + commentSize;
    if (endEntry > end || u16(pos + 34)) fail('The ZIP entry metadata is invalid.');
    if (flags & 0x41) fail('Encrypted ZIP files are not supported. Export an unencrypted static build.');
    if (![0, 8].includes(method)) fail('This ZIP compression method is not supported. Use standard ZIP Deflate or Store.');
    if ([compressed, size, local].includes(0xffffffff)) fail('ZIP64 files are not supported.');
    if (((u32(pos + 38) >>> 16) & 0xf000) === 0xa000) fail('ZIP symbolic links are not supported. Include real files.');
    const rawName = text(bytes.subarray(pos + 46, pos + 46 + nameSize), 'ZIP file names');
    const path = safePath(rawName), directory = rawName.endsWith('/');
    const normalized = path.normalize('NFC').toLowerCase();
    if (names.has(normalized)) fail(`Duplicate archive path: ${path}. File names must be unique, including letter case.`);
    names.add(normalized);
    if (local + 30 > centralOffset || u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== method) fail(`ZIP local header does not match ${path}.`);
    const localNameSize = u16(local + 26), localExtra = u16(local + 28), start = local + 30 + localNameSize + localExtra;
    if (start + compressed > centralOffset || text(bytes.subarray(local + 30, local + 30 + localNameSize), 'ZIP local file name') !== rawName) fail(`Invalid ZIP file bounds or name for ${path}.`);
    if (!(flags & 8) && (u32(local + 14) !== crc || u32(local + 18) !== compressed || u32(local + 22) !== size)) fail(`ZIP sizes or checksum metadata disagree for ${path}.`);
    if (ranges.some(([a, b]) => local < b && start + compressed > a)) fail('Overlapping ZIP entries are not supported.');
    ranges.push([local, start + compressed]);
    if (directory) {
      if (size !== 0) fail(`Directory ${path} unexpectedly contains file data.`);
    } else {
      total += size;
      if (total > IMPORT_LIMITS.unpackedBytes) fail('The unpacked project exceeds the 20 MB limit.');
      if (files.length >= IMPORT_LIMITS.files) fail('The project exceeds the 100-file limit.');
      if (method === 0 && compressed !== size) fail(`Invalid stored-file size for ${path}.`);
      files.push({ path, mime: mimeFor(path), start, compressed, size, method, crc });
    }
    pos = endEntry;
  }
  if (pos !== end || !files.length) fail('This ZIP contains no usable project files.');
  return files;
}

function unpack(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  const packed = bytes.subarray(entry.start, entry.start + entry.compressed);
  if (entry.method === 0) {
    const out = packed.slice();
    if (crc32(out) !== entry.crc) fail(`ZIP checksum failed for ${entry.path}.`);
    return out;
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  const stream = new Inflate(chunk => {
    length += chunk.byteLength;
    if (length > entry.size || length > IMPORT_LIMITS.unpackedBytes) fail(`Decompressed size exceeds the declared limit for ${entry.path}.`);
    chunks.push(chunk);
  });
  // Bounded compressed chunks prevent one forged stream from allocating an unlimited output.
  try {
    for (let offset = 0; offset < packed.length; offset += 1024) stream.push(packed.subarray(offset, offset + 1024), offset + 1024 >= packed.length);
    if (!packed.length) stream.push(new Uint8Array(), true);
  } catch (error) { fail(`Cannot safely unpack ${entry.path}: ${error instanceof Error ? error.message : 'invalid compressed data'}`); }
  if (length !== entry.size) fail(`Decompressed size does not match ${entry.path}.`);
  const out = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  if (crc32(out) !== entry.crc) fail(`ZIP checksum failed for ${entry.path}.`);
  return out;
}

async function fingerprint(files: UploadedFile[]): Promise<string> {
  const pieces: Uint8Array[] = [];
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) pieces.push(encode.encode(`${file.path}\0${file.bytes.length}\0`), file.bytes);
  const all = new Uint8Array(pieces.reduce((size, piece) => size + piece.length, 0));
  let offset = 0; for (const piece of pieces) { all.set(piece, offset); offset += piece.length; }
  const hash = await crypto.subtle.digest('SHA-256', all);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export async function importProject(file: File): Promise<UploadedProject> {
  if (!file.size) fail('The selected file is empty.');
  if (file.size > IMPORT_LIMITS.inputBytes) fail('The upload exceeds the 10 MB input limit.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = ext(file.name);
  let files: UploadedFile[];
  if (extension === 'zip') files = zipEntries(bytes).map(entry => ({ path: entry.path, mime: entry.mime, bytes: unpack(bytes, entry) }));
  else if (extension === 'html' || extension === 'htm') files = [{ path: safePath(file.name), mime: 'text/html', bytes }];
  else fail('Choose an HTML file or a static-project ZIP. ' + BUILD_HELP);
  const entries = files.filter(item => item.mime === 'text/html').map(item => item.path).sort((a, b) => {
    const rank = (path: string) => (/\/(?:dist|build)\/index\.html?$/i.test('/' + path) ? 0 : /(?:^|\/)index\.html?$/i.test(path) ? 1 : 2);
    return rank(a) - rank(b) || a.split('/').length - b.split('/').length || a.localeCompare(b);
  });
  if (!entries.length) fail('No HTML entry page was found. ' + BUILD_HELP);
  const project: UploadedProject = { id: crypto.randomUUID(), name: file.name.replace(/\.(?:zip|html?)$/i, ''), fingerprint: await fingerprint(files), files, entries, entry: entries[0], totalBytes: files.reduce((sum, item) => sum + item.bytes.length, 0), warnings: [] };
  // Validate the selected entry and its dependencies without attaching or executing them.
  const prepared = prepareDocument(project, project.entry);
  project.warnings = prepared.warnings;
  return project;
}

interface AstNode { type: string; start: number; end: number; [key: string]: unknown; }
interface Replacement { start: number; end: number; value: string; }
const networkNames = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'importScripts', 'sendBeacon']);
const imageFontData = /^data:(?:image\/(?:png|jpeg|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon)|font\/(?:woff2?|ttf)|application\/(?:font-woff|x-font-ttf))(?:;[^,]*)?,/i;
function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

// Resource tokens inside comments or quoted content are text, not CSS requests.
function cssCodePositions(source: string): Uint8Array {
  const code = new Uint8Array(source.length); code.fill(1);
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '/' && source[index + 1] === '*') {
      const start = index, end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length - 1 : end + 1; code.fill(0, start, index + 1);
    } else if (source[index] === '"' || source[index] === "'") {
      const start = index, quote = source[index++];
      while (index < source.length && source[index] !== quote) { if (source[index] === '\\') index++; index++; }
      code.fill(0, start, Math.min(index + 1, source.length));
    }
  }
  return code;
}

/** Turn a static build into inert markup plus separately controlled scripts. */
export function prepareDocument(project: UploadedProject, entry: string): PreparedDocument {
  const byPath = new Map(project.files.map(file => [file.path, file]));
  const main = byPath.get(entry);
  if (!main || main.mime !== 'text/html') fail('Choose an HTML entry from this imported project.');
  const warnings = new Set<string>();
  const scriptList: PreparedDocument['scripts'] = [];
  const assetCache = new Map<string, string>(), moduleCache = new Map<string, string>();
  let expansion = 0;
  const budget = (value: string) => { expansion += value.length; if (expansion > MAX_PREPARED) fail('Inlining this project exceeds the 40 MB prepared-page limit. Reduce duplicated or large assets.'); return value; };
  function resolve(reference: string, from: string): { file: UploadedFile; fragment: string } {
    const ref = reference.trim();
    if (!ref || /^[a-z][a-z\d+.-]*:|^\/\//i.test(ref) || /[\\\u0000-\u001f]/.test(ref)) fail(`External or invalid resource “${ref.slice(0, 120)}” in ${from}. Include assets inside the ZIP; network requests are not supported.`);
    let clean: string;
    try { clean = decodeURIComponent(ref.split(/[?#]/)[0]); } catch { return fail(`Invalid encoded asset path in ${from}.`); }
    const fragment = ref.includes('#') ? '#' + ref.split('#').slice(1).join('#') : '';
    if (/[\\\u0000-\u001f:]/.test(clean)) fail(`Invalid resource path in ${from}.`);
    const normalize = (parts: string[]) => {
      const result: string[] = [];
      for (const part of parts) {
        if (!part || part === '.') continue;
        if (part === '..') { if (!result.length) fail(`Asset ${reference} escapes the project root.`); result.pop(); }
        else result.push(part);
      }
      return result.join('/');
    };
    let candidates: string[];
    if (clean.startsWith('/')) {
      const suffix = clean.replace(/^\/+/, '');
      const parents = entry.split('/').slice(0, -1);
      candidates = [normalize(suffix.split('/'))];
      for (let count = parents.length; count > 0; count--) candidates.push(normalize([...parents.slice(0, count), ...suffix.split('/')]));
    } else candidates = [normalize([...from.split('/').slice(0, -1), ...clean.split('/')])];
    const file = candidates.map(path => byPath.get(path)).find(Boolean);
    if (!file) fail(`Missing local asset “${reference}” referenced by ${from}. Include the complete static build folder. ${BUILD_HELP}`);
    return { file, fragment };
  }

  function data(file: UploadedFile, stack: string[] = []): string {
    const cached = assetCache.get(file.path); if (cached) return cached;
    if (stack.includes(file.path)) fail(`Circular asset reference: ${[...stack, file.path].join(' → ')}.`);
    let bytes = file.bytes;
    if (file.mime === 'image/svg+xml') {
      const svg = new DOMParser().parseFromString(text(bytes, file.path), 'image/svg+xml');
      if (svg.querySelector('parsererror,script,foreignObject')) fail(`SVG ${file.path} contains invalid or active embedded content. Use a static SVG image.`);
      for (const element of svg.querySelectorAll('*')) {
        for (const attr of [...element.attributes]) {
          if (/^on/i.test(attr.name)) fail(`SVG event handlers are not supported in ${file.path}.`);
          if (attr.name === 'href' || attr.name === 'xlink:href') {
            if (!attr.value.startsWith('#')) element.setAttribute(attr.name, asset(attr.value, file.path, [...stack, file.path]));
          } else if (attr.name === 'style' || /url\s*\(/i.test(attr.value)) element.setAttribute(attr.name, css(attr.value, file.path, [...stack, file.path]));
        }
      }
      for (const style of svg.querySelectorAll('style')) style.textContent = css(style.textContent ?? '', file.path, [...stack, file.path]);
      bytes = encode.encode(new XMLSerializer().serializeToString(svg));
    }
    const value = `data:${file.mime};base64,${base64(bytes)}`;
    if (value.length > MAX_PREPARED) fail(`Asset ${file.path} is too large to embed.`);
    assetCache.set(file.path, value); return value;
  }

  function asset(reference: string, from: string, stack: string[] = []): string {
    const value = reference.trim();
    if (value.startsWith('#')) return value;
    if (/^data:/i.test(value)) {
      if (!imageFontData.test(value)) fail(`Unsupported inline data resource in ${from}. Only image and font data URLs are allowed.`);
      return budget(value);
    }
    const { file, fragment } = resolve(value, from);
    if (!file.mime.startsWith('image/') && !file.mime.startsWith('font/')) fail(`Resource ${file.path} is not a supported image or font.`);
    return budget(data(file, stack) + fragment);
  }

  function css(source: string, from: string, stack: string[] = []): string {
    if (/expression\s*\(|-moz-binding|behavior\s*:/i.test(source)) fail(`Active CSS expressions are not supported in ${from}.`);
    const positions = cssCodePositions(source);
    for (const match of source.matchAll(/(?:@|[a-z])\\[0-9a-f]{1,6}/gi)) if (positions[match.index!]) fail(`Escaped CSS identifiers in ${from} must be normalized by a build step before upload.`);
    let result = source.replace(/@import\s+(?:url\(\s*(['"]?)([^)'"\s]+)\1\s*\)|(['"])(.*?)\3)\s*([^;]*);/gi, (whole, _q1: string, url1: string, _q2: string, url2: string, condition: string, offset: number) => {
      if (!positions[offset]) return whole;
      const { file } = resolve(url1 || url2, from);
      if (file.mime !== 'text/css') fail(`CSS import ${file.path} is not a stylesheet.`);
      if (stack.includes(file.path) || file.path === from) fail(`Circular CSS @import involving ${file.path}.`);
      const imported = css(text(file.bytes, file.path), file.path, [...stack, from]);
      if (/\blayer\b|\bsupports\s*\(/i.test(condition)) fail(`CSS @import layers/supports in ${from} must be bundled before upload.`);
      return condition.trim() ? `@media ${condition.trim()}{${imported}}` : imported;
    });
    const resolvedPositions = cssCodePositions(result);
    for (const match of result.matchAll(/@import\b/gi)) if (resolvedPositions[match.index!]) fail(`Unsupported CSS @import syntax in ${from}. Bundle the stylesheet before upload.`);
    result = result.replace(/url\(\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^)'"\s]*))\s*\)/gi, (whole, a: string, b: string, c: string, offset: number) => resolvedPositions[offset] ? `url("${asset(a ?? b ?? c, from, stack)}")` : whole);
    return budget(result);
  }

  function sourceCode(source: string, from: string, module: boolean, stack: string[], handler = false): string {
    let ast: AstNode;
    try { ast = parse(source, { ecmaVersion: 'latest', sourceType: module ? 'module' : 'script', allowReturnOutsideFunction: handler }) as unknown as AstNode; }
    catch (error) { return fail(`Cannot parse ${from} as browser JavaScript: ${error instanceof Error ? error.message : 'syntax error'}. ${BUILD_HELP}`); }
    const edits: Replacement[] = [], pending: AstNode[] = [ast];
    while (pending.length) {
      const node = pending.pop()!;
      if (node.type === 'MetaProperty' && (node.meta as AstNode)?.name === 'import') fail(`import.meta in ${from} requires a bundled, self-contained build. Replace runtime URL discovery with local static assets.`);
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type) && node.source) {
        const dependency = node.source as AstNode;
        if (dependency.type !== 'Literal' || typeof dependency.value !== 'string') fail(`Dynamic imports in ${from} must use a literal relative file path.`);
        const specifier = dependency.value;
        if (!specifier.startsWith('./') && !specifier.startsWith('../') && !specifier.startsWith('/')) fail(`Bare or external module import “${specifier}” in ${from}. ${BUILD_HELP}`);
        const { file } = resolve(specifier, from);
        edits.push({ start: dependency.start, end: dependency.end, value: JSON.stringify(moduleUrl(file, stack)) });
      }
      if (node.type === 'CallExpression' || node.type === 'NewExpression') {
        const callee = node.callee as AstNode;
        const member = callee?.type === 'MemberExpression' ? callee.property as AstNode : undefined;
        const name = callee?.type === 'Identifier' ? callee.name : member?.name ?? member?.value;
        if (typeof name === 'string' && networkNames.has(name)) warnings.add(`${from} references ${name}. Networking and workers are blocked in this preview; applications that need them require the local runner.`);
        if (name === 'require') fail(`${from} uses require(), which must be bundled for the browser. ${BUILD_HELP}`);
        if (['write', 'writeln'].includes(String(name)) && (callee.object as AstNode)?.name === 'document') fail(`document.${name} in ${from} is not supported. Use ordinary DOM methods.`);
      }
      if (node.type === 'Literal' && typeof node.value === 'string' && /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf)(?:[?#].*)?$/i.test(node.value) && !/^[a-z][a-z\d+.-]*:/i.test(node.value)) {
        if (!edits.some(edit => edit.start === node.start)) edits.push({ start: node.start, end: node.end, value: JSON.stringify(asset(node.value, from)) });
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) for (const child of value) { if (child && typeof child === 'object' && typeof child.type === 'string') pending.push(child); }
        else if (value && typeof value === 'object' && 'type' in value && typeof value.type === 'string') pending.push(value as AstNode);
      }
    }
    edits.sort((a, b) => b.start - a.start);
    let result = source;
    for (const edit of edits) result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
    return budget(result);
  }

  function moduleUrl(file: UploadedFile, stack: string[]): string {
    const known = moduleCache.get(file.path); if (known) return known;
    if (stack.includes(file.path)) fail(`Circular module imports are not supported: ${[...stack, file.path].join(' → ')}. Bundle these modules first.`);
    let code: string;
    if (file.mime === 'text/javascript') code = sourceCode(text(file.bytes, file.path), file.path, true, [...stack, file.path]);
    else if (file.mime === 'application/json') {
      try { code = 'export default ' + JSON.stringify(JSON.parse(text(file.bytes, file.path))) + ';'; } catch { return fail(`Invalid JSON module: ${file.path}.`); }
    } else if (file.mime === 'text/css') code = `const style=document.createElement('style');style.textContent=${JSON.stringify(css(text(file.bytes, file.path), file.path))};document.head.append(style);export default {};`;
    else if (file.mime.startsWith('image/') || file.mime.startsWith('font/')) code = 'export default ' + JSON.stringify(data(file)) + ';';
    else fail(`Unsupported module resource: ${file.path}.`);
    const url = 'data:text/javascript;base64,' + base64(encode.encode(code));
    budget(url); moduleCache.set(file.path, url); return url;
  }

  const original = text(main.bytes, entry);
  if (!/<[a-z!][^>]*>/i.test(original)) fail('The selected entry does not contain an HTML page.');
  const doc = new DOMParser().parseFromString(original, 'text/html');
  if (doc.querySelector('base,iframe,frame,frameset,object,embed')) fail('Embedded frames, objects, and <base> are not supported. Upload a self-contained page without nested browsing contexts.');
  for (const meta of doc.querySelectorAll('meta[http-equiv]')) {
    if (/refresh/i.test(meta.getAttribute('http-equiv') ?? '')) fail('Automatic page refresh/navigation is not supported in imported pages.');
    meta.remove(); warnings.add('Imported HTTP policy metadata was replaced by the isolated preview policy.');
  }
  for (const template of doc.querySelectorAll('template')) {
    if (template.content.querySelector('script,iframe,object,embed,base,link,style,[src],[srcset]')) fail('Templates with embedded scripts or external resources must be bundled into ordinary markup first.');
  }
  for (const script of [...doc.querySelectorAll('script')]) {
    const type = (script.getAttribute('type') ?? '').trim().toLowerCase();
    const module = type === 'module';
    if (type && !module && !['text/javascript', 'application/javascript'].includes(type)) fail(`Script type “${type}” is not supported. Embed JSON data in a JavaScript variable and bundle import maps first.`);
    if (script.hasAttribute('nomodule')) { script.remove(); warnings.add('Legacy nomodule fallback scripts were omitted because this browser supports modules.'); continue; }
    const reference = script.getAttribute('src');
    const file = reference ? resolve(reference, entry).file : main;
    if (reference && file.mime !== 'text/javascript') fail(`Script ${file.path} is not compiled JavaScript. ${BUILD_HELP}`);
    const code = sourceCode(reference ? text(file.bytes, file.path) : script.textContent ?? '', file.path, module, module ? [file.path] : []);
    scriptList.push({ code, module }); script.remove();
  }
  for (const link of [...doc.querySelectorAll('link')]) {
    const rel = (link.getAttribute('rel') ?? '').toLowerCase(), reference = link.getAttribute('href');
    if (rel === 'stylesheet' && reference) {
      const file = resolve(reference, entry).file;
      if (file.mime !== 'text/css') fail(`Stylesheet ${file.path} is not CSS.`);
      const style = doc.createElement('style'); style.textContent = css(text(file.bytes, file.path), file.path);
      if (link.hasAttribute('media')) style.setAttribute('media', link.getAttribute('media')!);
      link.replaceWith(style);
    } else if (/\bicon\b/.test(rel) && reference) link.setAttribute('href', asset(reference, entry));
    else { link.remove(); warnings.add('Resource hints, manifests, and metadata links are omitted in the isolated preview.'); }
  }
  for (const style of doc.querySelectorAll('style')) {
    // Styles created from linked CSS are already resolved; data URLs are accepted idempotently.
    style.textContent = css(style.textContent ?? '', entry);
  }
  for (const element of doc.querySelectorAll('*')) {
    for (const attr of [...element.attributes]) {
      const name = attr.name.toLowerCase(), value = attr.value;
      if (name === 'style' || (element.namespaceURI === 'http://www.w3.org/2000/svg' && /url\s*\(/i.test(value))) element.setAttribute(name, css(value, entry));
      else if (/^on/.test(name)) element.setAttribute(name, sourceCode(value, `${entry} ${name}`, false, [], true));
      else if (name === 'srcdoc') fail('Embedded HTML frames are not supported.');
      else if (['action', 'formaction'].includes(name) && value.trim()) fail('Form navigation/submission endpoints are not supported. Use client-side form handlers or the local runner.');
      else if (name === 'target' || name === 'ping' || name === 'integrity' || name === 'crossorigin') element.removeAttribute(attr.name);
      else if (name === 'srcset') {
        if (/data:/i.test(value)) fail('Inline data URLs in srcset are not supported. Use src or local image paths.');
        element.setAttribute(name, value.split(',').map(candidate => {
          const [reference, descriptor, ...extra] = candidate.trim().split(/\s+/);
          if (!reference || extra.length || (descriptor && !/^\d+(?:\.\d+)?[wx]$/.test(descriptor))) fail('Unsupported srcset syntax. Use ordinary local image paths.');
          return asset(reference, entry) + (descriptor ? ' ' + descriptor : '');
        }).join(', '));
      } else if (['src', 'poster', 'background'].includes(name)) {
        if (value.trim()) element.setAttribute(name, asset(value, entry));
        else element.removeAttribute(name);
      }
      else if (name === 'href' || name === 'xlink:href') {
        if (element.localName === 'a' || element.localName === 'area') {
          if (value && !value.startsWith('#')) { element.removeAttribute(attr.name); warnings.add('Links to other pages are disabled. Select each HTML entry separately to inspect it.'); }
        } else element.setAttribute(attr.name, asset(value, entry));
      }
    }
  }
  const html = '<!doctype html>\n' + doc.documentElement.outerHTML;
  if (html.length > MAX_PREPARED) fail('The prepared page exceeds the 40 MB limit. Reduce embedded assets.');
  return { html, scripts: scriptList, warnings: [...warnings] };
}
