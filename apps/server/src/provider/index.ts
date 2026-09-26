/**
 * Provider factory and configuration loader.
 *
 * Reads PROVIDER_* env vars from process.env (or from apps/server/.env via dotenv).
 * Never exposes the API key to callers; ProviderStatus omits the key.
 *
 * Adding a new protocol:
 *   1. Implement ProviderTransport in a new *-transport.ts file.
 *   2. Add a PROVIDER_PROTOCOL env var (e.g. "anthropic").
 *   3. Add a branch in createTransport() below.
 *   4. Document in .env.example.
 */

import * as fs from "fs";
import * as path from "path";
import type { ProviderStatus } from "@ming/contracts";
import type { ProviderTransport } from "./types";
import { OpenAICompatibleTransport } from "./openai-transport";

// Load .env from apps/server/.env if it exists (simple key=value, no dependency on dotenv pkg)
function loadDotEnv(): void {
  const envPath = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(envPath)) return;
  try {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch {
    // best-effort; ignore errors
  }
}

// Load on module init
loadDotEnv();

function getEnv(key: string): string {
  return (process.env[key] ?? "").trim();
}

/** Return configuration status WITHOUT the API key */
export function getProviderStatus(): ProviderStatus {
  const label = getEnv("PROVIDER_LABEL") || "未配置提供商";
  const baseUrl = getEnv("PROVIDER_BASE_URL");
  const modelId = getEnv("PROVIDER_MODEL_ID");
  const apiKey = getEnv("PROVIDER_API_KEY");

  const missingFields: string[] = [];
  if (!baseUrl) missingFields.push("PROVIDER_BASE_URL");
  if (!modelId) missingFields.push("PROVIDER_MODEL_ID");
  if (!apiKey) missingFields.push("PROVIDER_API_KEY");

  return {
    configured: missingFields.length === 0,
    providerLabel: label,
    baseUrl: baseUrl || "(未设置)",
    modelId: modelId || "(未设置)",
    missingFields,
  };
}

/**
 * Create a live transport from environment configuration.
 * Returns null if configuration is incomplete.
 */
export function createLiveTransport(): ProviderTransport | null {
  const label = getEnv("PROVIDER_LABEL") || "openai-compatible";
  const baseUrl = getEnv("PROVIDER_BASE_URL");
  const modelId = getEnv("PROVIDER_MODEL_ID");
  const apiKey = getEnv("PROVIDER_API_KEY");

  if (!baseUrl || !modelId || !apiKey) return null;

  // Currently only OpenAI-compatible protocol is implemented.
  // Add PROVIDER_PROTOCOL branching here when new protocols are added.
  return new OpenAICompatibleTransport({ label, baseUrl, modelId, apiKey });
}
