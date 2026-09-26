import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { chromium } from "playwright";
import { computeFingerprint } from "@ming/runner";
import type { PageContext, TargetConfig, TargetRecord } from "@ming/contracts";

export interface RegisteredTarget extends TargetRecord {
  route?: string;
  planPath?: string;
}

export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const EXCLUDED = new Set(["node_modules", ".git", ".hg", ".svn", "dist", "build", ".next", "coverage", "runtime", ".cache", ".venv", "venv"]);
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".html", ".htm", ".css", ".scss", ".less", ".vue", ".svelte", ".json", ".md", ".py", ".go", ".rs", ".java", ".cs", ".rb", ".php", ".yml", ".yaml", ".toml"]);

export function validateLocalUrl(value: unknown, port: number): string {
  if (typeof value !== "string" || value.length > 2048) throw new RequestError(400, "请输入本地项目 HTTP 地址");
  let url: URL;
  try { url = new URL(value); } catch { throw new RequestError(400, "项目地址不是有效 URL"); }
  const targetPort = Number(url.port || "80");
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !Number.isInteger(targetPort) || targetPort < 1024 || targetPort > 65535 ||
      [port, 4000, 4001].includes(targetPort) || url.username || url.password) {
    throw new RequestError(400, "仅支持 http://localhost 或 http://127.0.0.1 的 1024–65535 端口；不能使用 Ming 自身端口或带凭证的地址");
  }
  return url.href;
}

function localPath(value: unknown, kind: "file" | "directory"): string {
  if (typeof value !== "string" || !path.isAbsolute(value) || value.startsWith("\\\\")) throw new RequestError(400, "请提供本机绝对路径，不能使用网络共享路径");
  let resolved: string;
  try {
    resolved = fs.realpathSync(value);
    const st = fs.statSync(resolved);
    if (kind === "file" ? !st.isFile() : !st.isDirectory()) throw new Error("wrong type");
  } catch { throw new RequestError(400, kind === "file" ? "HTML 文件不存在或不可读取" : "源码目录不存在或不可读取"); }
  if (kind === "directory" && path.parse(resolved).root === resolved) throw new RequestError(400, "请选择具体项目目录，不能使用整个磁盘");
  return resolved;
}

export function readTargetHtml(target: RegisteredTarget): string {
  if (!target.htmlPath) throw new RequestError(422, "目标没有 HTML 文件");
  const stat = fs.lstatSync(target.htmlPath);
  if (!stat.isFile() || stat.size > MAX_HTML_BYTES) throw new RequestError(422, "单个 HTML 文件必须小于 2 MB");
  return fs.readFileSync(target.htmlPath, "utf-8");
}

/** Bounded observation only. No file content is persisted or sent to the browser/model. */
export function sourceFingerprint(sourceDir: string): string {
  const hash = createHash("sha256");
  let files = 0, totalBytes = 0, entries = 0;
  const visit = (dir: string, depth: number) => {
    if (depth > 20) throw new Error("source tree too deep");
    for (const name of fs.readdirSync(dir).sort()) {
      if (++entries > 10000) throw new Error("source tree too large");
      const lower = name.toLowerCase();
      if (EXCLUDED.has(lower) || lower.startsWith(".env") || /secret|credential|private[-_]?key/i.test(name)) continue;
      const full = path.join(dir, name);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) { visit(full, depth + 1); continue; }
      if (!stat.isFile() || !SOURCE_EXT.has(path.extname(name).toLowerCase())) continue;
      if (++files > 2000 || (totalBytes += stat.size) > MAX_SOURCE_BYTES || stat.size > MAX_HTML_BYTES) throw new Error("source size limit");
      hash.update(path.relative(sourceDir, full).replace(/\\/g, "/")).update("\0");
      hash.update(fs.readFileSync(full)).update("\0");
    }
  };
  try { visit(sourceDir, 0); return files ? hash.digest("hex").slice(0, 16) : "unknown"; }
  catch { return "unknown"; }
}

export function targetFingerprint(target: RegisteredTarget): string {
  try {
    return target.kind === "html" ? computeFingerprint(readTargetHtml(target)) : target.sourceDir ? sourceFingerprint(target.sourceDir) : "unknown";
  } catch { return "unknown"; }
}

export function captureTarget(target: RegisteredTarget): TargetConfig {
  if (target.kind === "html") {
    const htmlSnapshot = readTargetHtml(target);
    return { variant: target.variant, url: target.url, fingerprint: computeFingerprint(htmlSnapshot), htmlSnapshot, sourceBinding: "self-contained-html-snapshot" };
  }
  return { variant: target.variant, url: target.url, fingerprint: targetFingerprint(target), sourceBinding: "live-url-observed" };
}

export class TargetRegistry {
  readonly targets: Record<string, RegisteredTarget> = Object.create(null);
  readonly directory: string;
  constructor(private root: string, private runtimeDir: string, private port: number, registryPath: string) {
    this.directory = path.join(runtimeDir, "targets");
    fs.mkdirSync(this.directory, { recursive: true });
    const entries: Array<{variant: string; route: string; label: string; htmlPath: string; planPath?: string}> = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, "utf-8")) : [
      { variant: "normal", route: "/normal", label: "日报 · 正常示例", htmlPath: "examples/daily-report/normal/index.html" },
      { variant: "buggy", route: "/buggy", label: "日报 · 缺陷示例", htmlPath: "examples/daily-report/buggy/index.html" },
    ];
    const routes = new Set<string>();
    const repoFile = (relative: string) => {
      const resolved = path.resolve(root, relative), rel = path.relative(root, resolved);
      if (path.isAbsolute(relative) || !rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Registry path escapes repository");
      return resolved;
    };
    for (const entry of entries) {
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(entry.variant) || !/^\/[a-z][a-z0-9-]{0,63}$/.test(entry.route) || ["/api", "/admin"].includes(entry.route) || this.targets[entry.variant] || routes.has(entry.route)) throw new Error("Invalid target registry");
      routes.add(entry.route);
      this.targets[entry.variant] = { variant: entry.variant, label: entry.label, url: `http://localhost:${port}${entry.route}`, route: entry.route, htmlPath: repoFile(entry.htmlPath), planPath: repoFile(entry.planPath ?? "fixtures/stage-a-plan.json"), kind: "html", isSample: true, archived: false };
    }
    for (const filename of fs.readdirSync(this.directory).filter(f => /^custom-[a-zA-Z0-9-]+\.json$/.test(f))) {
      try {
        const target = JSON.parse(fs.readFileSync(path.join(this.directory, filename), "utf-8")) as RegisteredTarget;
        if (target.variant !== filename.slice(0, -5) || !["url", "html"].includes(target.kind) || target.isSample !== false || !target.projectId || this.targets[target.variant]) throw new Error("Invalid persisted target");
        if (target.kind === "url") target.url = validateLocalUrl(target.url, port);
        else {
          if (!target.htmlPath || !path.isAbsolute(target.htmlPath)) throw new Error("Invalid HTML path");
          target.route = `/local-target/${target.variant}`;
          target.url = `http://localhost:${port}${target.route}`;
        }
        this.targets[target.variant] = target;
      } catch (error) { console.warn(`[targets] Skipped invalid registration ${filename}: ${String(error)}`); }
    }
  }
  create(body: Record<string, unknown>, projectId: string): RegisteredTarget {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 120) throw new RequestError(400, "项目名称须为 1–120 个字符");
    if (body.kind !== "url" && body.kind !== "html") throw new RequestError(400, "kind 必须为 url 或 html");
    const variant = `custom-${randomUUID()}`;
    const target: RegisteredTarget = { variant, label: body.name.trim(), kind: body.kind, projectId, url: "", isSample: false, archived: false, createdAt: new Date().toISOString() };
    if (body.kind === "url") target.url = validateLocalUrl(body.url, this.port);
    else {
      target.htmlPath = localPath(body.htmlPath, "file");
      if (!/\.html?$/i.test(target.htmlPath)) throw new RequestError(400, "仅能登记 .html 或 .htm 文件；多文件项目请通过本地 URL 接入");
      readTargetHtml(target);
      target.route = `/local-target/${variant}`;
      target.url = `http://localhost:${this.port}${target.route}`;
    }
    if (body.sourceDir !== undefined && body.sourceDir !== "") target.sourceDir = localPath(body.sourceDir, "directory");
    if (Object.values(this.targets).filter(t => !t.isSample && !t.archived).length >= 50) throw new RequestError(409, "最多可登记 50 个活跃项目，请先归档不再使用的项目");
    if (Object.values(this.targets).some(t => !t.archived && (target.kind === "url" ? t.url === target.url : t.htmlPath === target.htmlPath))) throw new RequestError(409, "该目标已登记，请使用已有项目");
    this.persist(target);
    this.targets[variant] = target;
    return target;
  }
  persist(target: RegisteredTarget): void {
    const file = path.join(this.directory, `${target.variant}.json`), tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(target, null, 2), "utf-8");
    fs.renameSync(tmp, file);
  }
  list(): TargetRecord[] {
    return Object.values(this.targets).map(target => ({ ...target, fingerprint: targetFingerprint(target), sourceBinding: target.kind === "html" ? "self-contained-html-snapshot" : "live-url-observed" }));
  }
}

/** Bounded, isolated page inspection; unregistered origins and redirects cannot be followed. */
export async function inspectRegisteredTarget(target: RegisteredTarget, projectId: string): Promise<PageContext> {
  const base = { projectId, targetVariant: target.variant, targetUrl: target.url, title: "", elements: [], visibleTextSummary: "", capturedAt: new Date().toISOString() };
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  try {
    browser = await chromium.launch({ headless: true, timeout: 10000 });
    timeout = setTimeout(() => { timedOut = true; void browser?.close(); }, 15000);
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
    const origin = new URL(target.url).origin;
    const snapshot = target.kind === "html" ? readTargetHtml(target) : undefined;
    await context.route("**/*", async route => {
      try {
        const requested = new URL(route.request().url());
        if (requested.protocol !== "http:" || requested.origin !== origin || requested.username || requested.password) { await route.abort(); return; }
        if (snapshot !== undefined) {
          if (requested.href === target.url && route.request().resourceType() === "document") await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: snapshot });
          else await route.abort();
          return;
        }
        const response = await route.fetch({ maxRedirects: 0, timeout: 10000 });
        if (response.status() >= 300 && response.status() < 400) { await response.dispose(); await route.abort("blockedbyclient"); return; }
        await route.fulfill({ response });
        await response.dispose();
      } catch { await route.abort().catch(() => {}); }
    });
    await context.routeWebSocket("**/*", socket => {
      try {
        const url = new URL(socket.url());
        if (snapshot !== undefined || url.protocol !== "ws:" || `http://${url.host}` !== origin) socket.close();
        else socket.connectToServer();
      } catch { socket.close(); }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const response = await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 10000 });
    if (!response || response.status() >= 400) throw new Error(`HTTP ${response?.status() ?? "no response"}`);
    const title = (await page.title()).slice(0, 200);
    const info = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("input, textarea, select, button, [role=button]")).slice(0, 40).map(el => {
        const node = el as HTMLInputElement;
        const label = node.labels?.[0]?.textContent || node.getAttribute("aria-label") || node.getAttribute("placeholder") || node.textContent || node.name || "";
        return { label: label.trim().slice(0, 100), role: node.getAttribute("role") || (node.tagName.toLowerCase() === "button" ? "button" : "textbox"), selector: node.id ? `#${CSS.escape(node.id)}` : undefined };
      });
      return { elements, visibleTextSummary: document.body.innerText.slice(0, 1500) };
    });
    return { ...base, title, ...info };
  } catch (error) { return { ...base, error: timedOut ? "页面检查超时（15 秒）" : `页面检查失败：${error instanceof Error ? error.message : String(error)}` }; }
  finally { if (timeout) clearTimeout(timeout); await browser?.close().catch(() => {}); }
}
