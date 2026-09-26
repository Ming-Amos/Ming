/** Local provider settings. Secrets stay in the ignored runtime directory. */
import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import type { ProviderStatus, GenerationUsage } from "@ming/contracts";
import type { ProviderTransport } from "./types";
import { OpenAICompatibleTransport, buildEndpointUrl, httpRequest } from "./openai-transport";
import { classifyHttpStatus } from "./types";

function loadDotEnv(): void {
  try {
    for (const line of fs.readFileSync(path.resolve(__dirname, "../../.env"), "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!(key in process.env)) process.env[key] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* A local .env file is optional. */ }
}
loadDotEnv();

interface ProviderConfig { providerLabel: string; baseUrl: string; modelId: string; apiKey: string }
type ConfigSource = "environment" | "local" | "none";
type Purpose = "generation" | "connection-test";
export interface ConnectionTestResult {
  ok: boolean; testedAt: string; durationMs: number; category?: GenerationUsage["errorCategory"];
  message: string; inputTokens: number | null; outputTokens: number | null;
}
interface UsageEvent {
  purpose: Purpose; providerLabel: string; modelId: string; invokedAt: string; durationMs: number;
  status: "success" | "error"; inputTokens: number | null; outputTokens: number | null;
}
interface TestRecord { configurationId: string; result: ConnectionTestResult }
export interface ProviderUsageSummary {
  retainedCalls: number; successfulCalls: number; failedCalls: number; generationCalls: number; connectionTestCalls: number;
  knownInputTokens: number; knownOutputTokens: number; callsWithUnreportedTokens: number; retentionLimit: number;
}
export interface LocalProviderStatus extends ProviderStatus {
  hasKey: boolean; keyStored: boolean; configSource: ConfigSource; environmentOverride: boolean; readOnly: boolean;
  lastTest?: ConnectionTestResult; usageSummary: ProviderUsageSummary; storageWarning?: string;
}
export class ProviderConfigError extends Error {
  constructor(message: string, readonly statusCode = 400) { super(message); }
}
const RETENTION_LIMIT = 200;
let storageDir: string | undefined;
let localConfig: ProviderConfig | null = null;
let usageEvents: UsageEvent[] = [];
let lastTest: TestRecord | undefined;
let storageWarning: string | undefined;
let testing = false;
const env = (name: string) => (process.env[name] ?? "").trim();
const emptyConfig = (): ProviderConfig => ({ providerLabel: "OpenAI-compatible", baseUrl: "", modelId: "", apiKey: "" });
function environmentConfig(): ProviderConfig | null {
  const config = { providerLabel: env("PROVIDER_LABEL") || "OpenAI-compatible", baseUrl: env("PROVIDER_BASE_URL"), modelId: env("PROVIDER_MODEL_ID"), apiKey: env("PROVIDER_API_KEY") };
  return config.baseUrl || config.modelId || config.apiKey ? config : null;
}
function activeConfig(): { config: ProviderConfig; source: ConfigSource } {
  const external = environmentConfig();
  return external ? { config: external, source: "environment" } : localConfig ? { config: localConfig, source: "local" } : { config: emptyConfig(), source: "none" };
}
function configurationId(config: ProviderConfig): string { return createHash("sha256").update(JSON.stringify(config)).digest("hex"); }
function tokenCount(value: unknown): number | null { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null; }
function safeText(value: string, secrets: string[]): string {
  let output = value;
  for (const secret of secrets) if (secret) for (const candidate of [secret, encodeURIComponent(secret)]) output = output.split(candidate).join("[REDACTED]");
  return output;
}
export function validateProviderBaseUrl(value: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new ProviderConfigError("Invalid API URL. Enter a complete HTTPS URL."); }
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "[::1]" || /^127\.(\d{1,3}\.){2}\d{1,3}$/.test(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) throw new ProviderConfigError("Remote APIs must use HTTPS. HTTP is only allowed for local localhost, 127.x.x.x, or ::1 addresses.");
  if (parsed.username || parsed.password || value.includes("?") || value.includes("#")) throw new ProviderConfigError("The API URL must not contain a username, password, query, or fragment. Enter the key in its separate field.");
  return parsed.toString().replace(/\/+$/, "");
}
function textField(value: unknown, name: string, maximum: number, required = true): string {
  if (typeof value !== "string") throw new ProviderConfigError(`${name} must be text.`);
  const result = value.trim();
  if ((required && !result) || result.length > maximum || /[\u0000-\u001f\u007f]/.test(result)) throw new ProviderConfigError(`${name} is empty, too long, or contains invalid characters.`);
  return result;
}
function validateConfig(value: unknown, existingKey: string): ProviderConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProviderConfigError("Invalid configuration format.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !["providerLabel", "baseUrl", "modelId", "apiKey"].includes(key))) throw new ProviderConfigError("The configuration contains unknown fields.");
  const providerLabel = textField(input.providerLabel ?? "OpenAI-compatible", "Provider name", 100);
  const baseUrl = validateProviderBaseUrl(textField(input.baseUrl, "API URL", 2048));
  const modelId = textField(input.modelId, "Model ID", 200);
  const suppliedKey = input.apiKey === undefined ? "" : textField(input.apiKey, "API Key", 8192, false);
  const apiKey = suppliedKey || existingKey;
  if (apiKey && [providerLabel, baseUrl, modelId].some(field => field.includes(apiKey) || field.includes(encodeURIComponent(apiKey)))) throw new ProviderConfigError("Enter the key only in the API Key field, not in the name, model ID, or URL.");
  return { providerLabel, baseUrl, modelId, apiKey };
}
function writePrivateJson(name: string, value: unknown): void {
  if (!storageDir) throw new ProviderConfigError("Local configuration storage has not been initialized.", 503);
  const temporary = path.join(storageDir, `.${name}.${randomUUID()}.tmp`);
  try {
    fs.mkdirSync(storageDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, path.join(storageDir, name));
  } catch {
    try { fs.unlinkSync(temporary); } catch { /* No temporary file was written. */ }
    throw new ProviderConfigError("Could not save the local model configuration. Check write permissions for the runtime directory.", 500);
  }
}
function persistUsage(): void {
  try { writePrivateJson("provider-usage.json", { events: usageEvents, lastTest }); }
  catch { storageWarning = "Usage records could not be saved to disk. This session still displays known usage."; }
}
/** Reload persisted local settings on server startup. Never makes a model request. */
export function configureProviderStorage(runtimeDir: string): void {
  storageDir = path.resolve(runtimeDir); localConfig = null; usageEvents = []; lastTest = undefined; storageWarning = undefined;
  const file = path.join(storageDir, "provider-config.json");
  if (fs.existsSync(file)) {
    try { localConfig = validateConfig(JSON.parse(fs.readFileSync(file, "utf8")), ""); }
    catch { storageWarning = "The local model configuration could not be read. Save the configuration again."; }
  }
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(storageDir, "provider-usage.json"), "utf8"));
    if (Array.isArray(saved.events)) usageEvents = saved.events.filter((item: UsageEvent) =>
      item && ["generation", "connection-test"].includes(item.purpose) && ["success", "error"].includes(item.status) &&
      typeof item.invokedAt === "string" && typeof item.providerLabel === "string" && typeof item.modelId === "string" &&
      typeof item.durationMs === "number" && (item.inputTokens === null || tokenCount(item.inputTokens) !== null) &&
      (item.outputTokens === null || tokenCount(item.outputTokens) !== null)).slice(-RETENTION_LIMIT);
    if (saved.lastTest?.configurationId && typeof saved.lastTest.result?.ok === "boolean") lastTest = saved.lastTest;
  } catch { /* First use has no usage ledger. */ }
}
export function getProviderUsageSummary(): ProviderUsageSummary {
  return {
    retainedCalls: usageEvents.length, successfulCalls: usageEvents.filter(e => e.status === "success").length,
    failedCalls: usageEvents.filter(e => e.status === "error").length,
    generationCalls: usageEvents.filter(e => e.purpose === "generation").length,
    connectionTestCalls: usageEvents.filter(e => e.purpose === "connection-test").length,
    knownInputTokens: usageEvents.reduce((sum, e) => sum + (e.inputTokens ?? 0), 0),
    knownOutputTokens: usageEvents.reduce((sum, e) => sum + (e.outputTokens ?? 0), 0),
    callsWithUnreportedTokens: usageEvents.filter(e => e.inputTokens === null || e.outputTokens === null).length,
    retentionLimit: RETENTION_LIMIT,
  };
}
/** Only actual HTTP call outcomes count. TestFixtureTransport is intentionally excluded. */
export function recordProviderUsage(usage: GenerationUsage, purpose: Purpose = "generation"): void {
  if (!usage.isLive) return;
  const secrets = [activeConfig().config.apiKey, localConfig?.apiKey ?? ""];
  usageEvents.push({ purpose, providerLabel: safeText(usage.providerLabel, secrets).slice(0, 100), modelId: safeText(usage.modelId, secrets).slice(0, 200),
    invokedAt: usage.invokedAt, durationMs: usage.durationMs, status: usage.status,
    inputTokens: tokenCount(usage.inputTokens), outputTokens: tokenCount(usage.outputTokens) });
  usageEvents = usageEvents.slice(-RETENTION_LIMIT); persistUsage();
}
export function getProviderStatus(): LocalProviderStatus {
  const { config, source } = activeConfig();
  const missingFields: string[] = [];
  if (!config.baseUrl) missingFields.push("PROVIDER_BASE_URL");
  if (!config.modelId) missingFields.push("PROVIDER_MODEL_ID");
  if (!config.apiKey) missingFields.push("PROVIDER_API_KEY");
  let baseUrl = config.baseUrl;
  if (baseUrl) try { baseUrl = validateProviderBaseUrl(baseUrl); } catch { baseUrl = ""; missingFields.push("PROVIDER_BASE_URL_INVALID"); }
  if (/[\r\n]/.test(config.apiKey)) missingFields.push("PROVIDER_API_KEY_INVALID");
  return {
    configured: missingFields.length === 0, providerLabel: safeText(config.providerLabel, [config.apiKey]),
    baseUrl: safeText(baseUrl, [config.apiKey]), modelId: safeText(config.modelId, [config.apiKey]), missingFields,
    hasKey: !!config.apiKey, keyStored: !!localConfig?.apiKey, configSource: source, environmentOverride: source === "environment", readOnly: false,
    lastTest: lastTest?.configurationId === configurationId(config) ? lastTest.result : undefined,
    usageSummary: getProviderUsageSummary(), storageWarning,
  };
}
export function saveProviderConfig(input: unknown): LocalProviderStatus {
  if (environmentConfig()) throw new ProviderConfigError("Server environment variables currently take precedence. Remove the PROVIDER_* configuration and restart before saving settings here.", 409);
  const next = validateConfig(input, localConfig?.apiKey ?? "");
  writePrivateJson("provider-config.json", next); localConfig = next; storageWarning = undefined;
  return getProviderStatus();
}
export function clearProviderConfig(): LocalProviderStatus {
  if (!storageDir) throw new ProviderConfigError("Local configuration storage has not been initialized.", 503);
  try { fs.rmSync(path.join(storageDir, "provider-config.json"), { force: true }); }
  catch { throw new ProviderConfigError("Could not remove the local configuration. Check directory permissions.", 500); }
  localConfig = null; lastTest = undefined; persistUsage();
  return getProviderStatus();
}
export function createLiveTransport(): ProviderTransport | null {
  if (!getProviderStatus().configured) return null;
  const config = activeConfig().config;
  return new OpenAICompatibleTransport({ label: config.providerLabel, baseUrl: validateProviderBaseUrl(config.baseUrl), modelId: config.modelId, apiKey: config.apiKey });
}
/** Called only by the explicit local Test connection action. No retries or redirects. */
export async function testProviderConnection(): Promise<ConnectionTestResult> {
  if (!getProviderStatus().configured) throw new ProviderConfigError("Save a complete API URL, model ID, and API key first.", 409);
  if (testing) throw new ProviderConfigError("A connection test is already running. Wait for the current request to finish.", 409);
  testing = true;
  const config = activeConfig().config;
  const started = Date.now(); const testedAt = new Date().toISOString();
  let result: ConnectionTestResult = { ok: false, testedAt, durationMs: 0, inputTokens: null, outputTokens: null, message: "Connection failed." };
  try {
    const body = JSON.stringify({ model: config.modelId, messages: [{ role: "user", content: "Reply with OK." }], max_tokens: 8 });
    const response = await httpRequest({ url: buildEndpointUrl(validateProviderBaseUrl(config.baseUrl), "chat/completions"), method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}`, "Content-Length": String(Buffer.byteLength(body)) },
      body, wallClockMs: 10_000, socketIdleMs: 10_000, maxBytes: 32 * 1024 });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      const category = classifyHttpStatus(response.statusCode);
      const explanation = category === "auth" ? "The API key or account access could not be verified" : category === "quota" ? "The provider rate limit or quota was reached" : "The provider did not accept the request";
      result = { ...result, category, message: `${explanation} (HTTP ${response.statusCode}).` };
    } else {
      let data: { choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } };
      try { data = JSON.parse(response.body); } catch { data = {}; }
      const content = data?.choices?.[0]?.message?.content;
      result.inputTokens = tokenCount(data?.usage?.prompt_tokens); result.outputTokens = tokenCount(data?.usage?.completion_tokens);
      result = typeof content === "string" && content.trim() ? { ...result, ok: true, message: "The model returned a valid response. Connection successful." } : { ...result, category: "invalid_output", message: "The provider response does not match the Chat Completions format. Check the API URL and model ID." };
    }
  } catch (error) {
    const timedOut = (error as { _isTimeout?: boolean })._isTimeout === true;
    result = { ...result, category: timedOut ? "timeout" : "network", message: timedOut ? "The connection test exceeded 10 seconds and was stopped." : "The connection failed or its response exceeded the limit. Check the API URL, network, and service status." };
  } finally { testing = false; }
  result.durationMs = Date.now() - started; lastTest = { configurationId: configurationId(config), result };
  recordProviderUsage({ providerLabel: config.providerLabel, modelId: config.modelId, invokedAt: testedAt, durationMs: result.durationMs,
    isLive: true, status: result.ok ? "success" : "error", errorCategory: result.category, inputTokens: result.inputTokens, outputTokens: result.outputTokens }, "connection-test");
  return result;
}
