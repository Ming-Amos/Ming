/**
 * OpenAI-compatible HTTP transport.
 *
 * Supports any provider that uses the /v1/chat/completions API:
 * OpenAI, DeepSeek, Moonshot, Qwen, local Ollama, etc.
 *
 * Configuration (all via environment / server config):
 *   PROVIDER_LABEL      — display label
 *   PROVIDER_BASE_URL   — e.g. https://api.openai.com
 *   PROVIDER_MODEL_ID   — e.g. gpt-4o
 *   PROVIDER_API_KEY    — kept server-side only
 *
 * Never expose the API key to the browser, logs, evidence files, or prompts.
 */

import https from "https";
import http from "http";
import { URL } from "url";
import { v4 as uuidv4 } from "uuid";
import { computeFingerprint } from "@ming/runner";
import type {
  AcceptancePlan,
  AcceptanceCriteria,
  PlanStep,
  GenerationUsage,
} from "@ming/contracts";
import type { ProviderTransport, GenerateRequest, GenerateOutcome } from "./types";
import { classifyHttpStatus } from "./types";

// ── Bounded limits ────────────────────────────────────────────────
/** Wall-clock deadline for the entire generate() call, including response streaming. */
const WALL_CLOCK_TIMEOUT_MS = 30_000;
/** Socket inactivity timeout (must be ≤ WALL_CLOCK_TIMEOUT_MS). */
const SOCKET_IDLE_TIMEOUT_MS = 25_000;
const MAX_RESPONSE_BYTES = 512 * 1024; // 512 KB

/** System prompt given to the model */
const SYSTEM_PROMPT = `You are a test-plan generator for a web acceptance tool called Ming.
Given a natural-language requirement and optional page context, output a JSON object that represents
an AcceptancePlan. The plan must follow the exact schema described below. Return ONLY the JSON object
with no surrounding markdown fences or commentary.

Write plan titles, descriptions, expectedBehavior, prerequisites, openQuestions, and step descriptions
in English. Preserve requirementRef quotations in their original language. Preserve the exact labels,
visible text, input values, selectors, and URLs needed to operate the target; do not translate those.

Schema rules:
- planId: string, e.g. "generated-<short-slug>"
- version: "1.0.0"
- source: "generated"
- transportProvenance: "TO_BE_SET_BY_TRANSPORT" (the transport sets this; the model must not control it)
- title: short string
- description: string
- fingerprint: "TO_BE_COMPUTED"
- createdAt: ISO timestamp
- criteria: array of AcceptanceCriteria, at least 1
  - id: e.g. "AC-01"
  - title: short string
  - description: string
  - requirementRef: quote the relevant part of the requirement text
  - expectedBehavior: string
  - prerequisites: string or omit
  - openQuestions: array of strings for ambiguities; omit if none
  - dependsOn: array of prior criteria ids; omit if none
  - contextMode: "fresh" | "inherit"
  - steps: array of PlanStep, at least 1; MUST include at least one assertion step
    - id: e.g. "AC-01-S1"
    - type: one of navigate|fill|click|reload|selectOption|check|uncheck|assertVisible|assertVisibleIn|assertNotVisible|assertCount|assertInputEnabled|assertInputDisabled|assertValue|assertUrl
    - locator: plain accessible label, or an explicit CSS selector prefixed with "css=" (required for fill/click/selectOption/check/uncheck/assertVisibleIn/assertCount/assertInputEnabled/assertInputDisabled/assertValue). Never treat arbitrary CSS as an accessible label.
    - value: text to fill or assert (required for fill/assertVisible/assertVisibleIn/assertNotVisible/assertValue). For selectOption, use the option's value attribute. For assertUrl, use the exact pathname beginning with / or the exact full URL (including any query/hash when using a full URL).
    - url: URL (required for navigate; use {{TARGET_URL}} for the configured target)
    - expected: non-negative integer (required for assertCount, must be a JSON number not string)
    - description: human-readable step description

Only use template variables {{TARGET_URL}} and {{UNIQUE_CONTENT}}. Do not use any other {{VAR}}.
Do not include script, eval, or any unknown fields. Do not include navigation outside {{TARGET_URL}}.
Mark ambiguous business rules in openQuestions; do not invent answers.`;

function buildUserPrompt(req: GenerateRequest): string {
  const parts: string[] = [`Requirement:\n${req.requirement}`];
  if (req.pageContext && !req.pageContext.error) {
    parts.push(`Page title: ${req.pageContext.title}`);
    if (req.pageContext.elements.length > 0) {
      const els = req.pageContext.elements
        .slice(0, 30)
        .map((e) => `  - [${e.role}] "${e.label}"${e.selector ? ` (${e.selector})` : ""}`)
        .join("\n");
      parts.push(`Interactive elements:\n${els}`);
    }
    if (req.pageContext.visibleTextSummary) {
      parts.push(`Visible text (truncated):\n${req.pageContext.visibleTextSummary.slice(0, 800)}`);
    }
  } else if (req.pageContext?.error) {
    parts.push(`Page context unavailable: ${req.pageContext.error}`);
  }
  parts.push(`Project ID: ${req.projectId}`);
  parts.push(`Requirement ID: ${req.requirementId}`);
  return parts.join("\n\n");
}

/**
 * Redact any occurrence of the given secret from a string.
 * Used to prevent API keys from appearing in error messages or logs.
 */
function redactSecret(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join("[REDACTED]").split(encodeURIComponent(secret)).join("[REDACTED]");
}

function makeUsage(
  label: string,
  modelId: string,
  invokedAt: string,
  durationMs: number,
  isLive: boolean,
  raw?: { usage?: { prompt_tokens?: number; completion_tokens?: number } }
): GenerationUsage {
  return {
    providerLabel: label,
    modelId,
    invokedAt,
    durationMs,
    isLive,
    status: "success",
    inputTokens: raw?.usage?.prompt_tokens ?? null,
    outputTokens: raw?.usage?.completion_tokens ?? null,
  };
}

function errorUsage(
  label: string,
  modelId: string,
  invokedAt: string,
  durationMs: number,
  category: GenerationUsage["errorCategory"],
  message: string,
  isLive = true
): GenerationUsage {
  return {
    providerLabel: label,
    modelId,
    invokedAt,
    durationMs,
    isLive,
    status: "error",
    errorCategory: category,
    errorMessage: message,
    inputTokens: null,
    outputTokens: null,
  };
}

/**
 * Perform an HTTP/HTTPS POST with:
 *  - a hard wall-clock deadline (wallClockMs) covering the entire call
 *  - a socket idle timeout (socketIdleMs)
 *  - a response byte cap (maxBytes)
 * Returns { statusCode, body } or throws on network / timeout / oversize error.
 */
export function httpRequest(opts: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  wallClockMs: number;
  socketIdleMs: number;
  maxBytes: number;
}): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let req: http.ClientRequest | undefined;
    let response: http.IncomingMessage | undefined;
    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(wallTimer);
      fn();
    }
    function fail(error: Error): void {
      settle(() => {
        // Reject once, then close both streams without emitting a second socket error.
        // Passing the same error to destroy() can escape through a reused keep-alive socket.
        response?.destroy();
        req?.destroy();
        reject(error);
      });
    }

    // Hard wall-clock timer — destroys the request unconditionally
    const wallTimer = setTimeout(() => {
      fail(Object.assign(new Error("Request timed out"), { _isTimeout: true }));
    }, opts.wallClockMs);

    const parsed = new URL(opts.url);
    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? https : http;

    const reqOpts = {
      hostname: parsed.hostname.replace(/^\[|\]$/g, ""),
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: opts.method,
      headers: opts.headers,
    };

    try { req = transport.request(reqOpts, (res) => {
      response = res;
      let received = 0;
      const chunks: Buffer[] = [];

      res.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > opts.maxBytes) {
          fail(new Error(`The response exceeds the ${opts.maxBytes}-byte limit`));
          return;
        }
        chunks.push(chunk);
      });

      res.on("end", () => {
        settle(() =>
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf-8"),
          })
        );
      });

      res.on("error", fail);
      res.on("aborted", () => fail(new Error("The provider closed the response early")));
    }); } catch (error) {
      fail(error instanceof Error ? error : new Error("The request could not be created"));
      return;
    }

    // Socket idle timeout (covers read stalls; wall-clock timer is the final backstop)
    req.setTimeout(opts.socketIdleMs, () => {
      fail(Object.assign(new Error("Request timed out"), { _isTimeout: true }));
    });

    req.on("error", (err) => {
      const isTimeout = (err as { _isTimeout?: boolean })._isTimeout === true || err.message === "Request timed out";
      fail(Object.assign(err, { _isTimeout: isTimeout }));
    });

    req.write(opts.body);
    req.end();
  });
}

/**
 * Build the full endpoint URL from a configured API root.
 * Supports explicit roots like "https://host/v1" or "https://host/compatible-mode/v1":
 * normalizes trailing slashes and appends the endpoint exactly once.
 * Never appends "/v1" automatically — the root is taken as-is.
 */
export function buildEndpointUrl(apiRoot: string, endpoint: string): string {
  const root = apiRoot.replace(/\/+$/, "");
  const ep = endpoint.replace(/^\/+/, "");
  return `${root}/${ep}`;
}

/** Parse and lightly validate the JSON returned by the model */
function parsePlanFromJson(text: string): AcceptancePlan {
  // Strip accidental markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const obj = JSON.parse(cleaned) as unknown;

  if (typeof obj !== "object" || obj === null) {
    throw new Error("The model output is not a JSON object");
  }
  const plan = obj as Record<string, unknown>;

  if (typeof plan["planId"] !== "string" || !plan["planId"]) {
    throw new Error("The model plan is missing planId");
  }
  if (!Array.isArray(plan["criteria"]) || (plan["criteria"] as unknown[]).length === 0) {
    throw new Error("The model plan is missing the criteria array");
  }

  // Ensure required top-level fields exist.
  // transportProvenance is intentionally NOT taken from the model output —
  // the transport layer stamps it after parsing.
  const now = new Date().toISOString();
  return {
    planId: String(plan["planId"]),
    version: typeof plan["version"] === "string" ? plan["version"] : "1.0.0",
    source: "generated",
    transportProvenance: undefined, // stamped by the caller, never from model output
    title: typeof plan["title"] === "string" ? plan["title"] : "Generated acceptance plan",
    description: typeof plan["description"] === "string" ? plan["description"] : "",
    fingerprint: "TO_BE_COMPUTED",
    createdAt: typeof plan["createdAt"] === "string" ? plan["createdAt"] : now,
    criteria: plan["criteria"] as AcceptanceCriteria[],
    originalRequirement: undefined,
    projectId: undefined,
    requirementId: undefined,
  };
}

export class OpenAICompatibleTransport implements ProviderTransport {
  readonly label: string;
  readonly modelId: string;
  readonly baseUrl: string;
  private readonly apiKey: string;
  // Fix 4 (provider review): explicit trusted isLive flag — defaults to live, test harness sets false
  private readonly _isLive: boolean;

  constructor(opts: {
    label: string;
    baseUrl: string;
    modelId: string;
    apiKey: string;
    /** Set to false when testing against a local HTTP fixture server (not a real provider). */
    isLive?: boolean;
  }) {
    this.label = opts.label;
    this.baseUrl = opts.baseUrl;
    this.modelId = opts.modelId;
    this.apiKey = opts.apiKey;
    this._isLive = opts.isLive !== false; // default live
  }

  async generate(req: GenerateRequest): Promise<GenerateOutcome> {
    const invokedAt = new Date().toISOString();
    const start = Date.now();

    const requestBody = JSON.stringify({
      model: this.modelId,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(req) },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    });

    // Fix 3: build endpoint from explicit API root (no blind /v1 append)
    const endpointUrl = buildEndpointUrl(this.baseUrl, "chat/completions");

    let res: { statusCode: number; body: string };
    try {
      res = await httpRequest({
        url: endpointUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Length": String(Buffer.byteLength(requestBody)),
        },
        body: requestBody,
        wallClockMs: WALL_CLOCK_TIMEOUT_MS,
        socketIdleMs: SOCKET_IDLE_TIMEOUT_MS,
        maxBytes: MAX_RESPONSE_BYTES,
      });
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const isTimeout = (err as { _isTimeout?: boolean })._isTimeout === true;
      // Fix 1: redact the key from any network-layer error message
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = redactSecret(rawMsg, this.apiKey);
      return {
        ok: false,
        usage: errorUsage(
          this.label, this.modelId, invokedAt, durationMs,
          isTimeout ? "timeout" : "network", safeMsg,
          this._isLive
        ),
      };
    }

    const durationMs = Date.now() - start;

    if (res.statusCode !== 200) {
      const category = classifyHttpStatus(res.statusCode);
      // Redact the full bounded body first, THEN truncate — prevents key leaking
      // at the slice boundary when the credential straddles position 200.
      const safeBody = redactSecret(res.body, this.apiKey).slice(0, 200);
      return {
        ok: false,
        usage: errorUsage(
          this.label, this.modelId, invokedAt, durationMs,
          category, `HTTP ${res.statusCode}: ${safeBody}`,
          this._isLive
        ),
      };
    }

    let rawJson: { choices?: Array<{ message?: { content?: string } }>; usage?: unknown };
    try {
      rawJson = JSON.parse(res.body) as typeof rawJson;
    } catch {
      const safeBody = redactSecret(res.body, this.apiKey).slice(0, 200);
      return {
        ok: false,
        usage: errorUsage(
          this.label, this.modelId, invokedAt, durationMs,
          "invalid_output", `The response is not valid JSON: ${safeBody}`,
          this._isLive
        ),
      };
    }

    const content = rawJson?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return {
        ok: false,
        usage: errorUsage(
          this.label, this.modelId, invokedAt, durationMs,
          "invalid_output", "The response has missing or empty choices[0].message.content",
          this._isLive
        ),
      };
    }

    let plan: AcceptancePlan;
    try {
      plan = parsePlanFromJson(content);
    } catch (parseErr: unknown) {
      const rawErrMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      return {
        ok: false,
        usage: errorUsage(
          this.label, this.modelId, invokedAt, durationMs,
          "invalid_output",
          // Redact key in case it somehow appeared in model content
          `Plan parsing failed: ${redactSecret(rawErrMsg, this.apiKey)}`,
          this._isLive
        ),
      };
    }

    // Fix 3+4: stamp transportProvenance from constructor flag, never from model output
    plan.transportProvenance = this._isLive ? "live" : "test";
    plan.projectId = req.projectId;
    plan.requirementId = req.requirementId;
    plan.originalRequirement = req.requirement;
    plan.fingerprint = computeFingerprint(plan);

    const usage = makeUsage(
      this.label, this.modelId, invokedAt, durationMs, this._isLive,
      rawJson as Parameters<typeof makeUsage>[5]
    );

    return { ok: true, plan, usage };
  }
}

/**
 * A purely local test transport that accepts a pre-built plan JSON.
 * Used by integration tests; NEVER used for production generation.
 * transportProvenance will be "test".
 */
/**
 * RawHttpFixture: controls what the fixture transport returns as raw HTTP
 * to exercise OpenAICompatibleTransport's response-parsing paths.
 * statusCode=200 with responseBody as a valid OpenAI envelope yields a plan parse attempt.
 * statusCode=4xx/5xx exercises classifyHttpStatus.
 * apiKey is used to verify redactSecret removes it from error outputs.
 */
export interface RawHttpFixture {
  statusCode: number;
  responseBody: string;
  apiKey?: string;
}

export class TestFixtureTransport implements ProviderTransport {
  readonly label = "test-fixture-transport";
  readonly modelId = "fixture";
  readonly baseUrl = "http://localhost";

  constructor(
    private readonly fixturePlan: AcceptancePlan | null,
    private readonly errorOverride?: {
      category: GenerationUsage["errorCategory"];
      message: string;
    },
    private readonly delayMs = 0,
    /** If true, the generate() promise never resolves (simulates hard timeout). */
    private readonly hangForever = false,
    /** If set, parse the raw HTTP response using OpenAICompatibleTransport logic. */
    private readonly rawHttpFixture?: RawHttpFixture
  ) {}

  async generate(req: GenerateRequest): Promise<GenerateOutcome> {
    const invokedAt = new Date().toISOString();
    const start = Date.now();

    if (this.hangForever) {
      // Immediately return a timeout error — matches what OpenAICompatibleTransport
      // returns when the wall-clock timer fires. This makes tests deterministic without
      // waiting for a real 30 s timeout.
      const durationMs = Date.now() - start;
      return {
        ok: false,
        usage: errorUsage(
          this.label, this.modelId, invokedAt, durationMs,
          "timeout", "TestFixtureTransport: Simulated timeout",
          false
        ),
      };
    }

    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }

    const durationMs = Date.now() - start;

    if (this.errorOverride) {
      return {
        ok: false,
        usage: errorUsage(
          this.label, this.modelId, invokedAt, durationMs,
          this.errorOverride.category, this.errorOverride.message,
          false // isLive = false for test transport
        ),
      };
    }

    // Raw HTTP fixture: simulate classifyHttpStatus + redactSecret + parse paths
    if (this.rawHttpFixture) {
      const { statusCode, responseBody, apiKey = "sk-fixture-key" } = this.rawHttpFixture;
      const redact = (s: string) => redactSecret(s, apiKey);

      if (statusCode !== 200) {
        const category = classifyHttpStatus(statusCode);
        return {
          ok: false,
          usage: errorUsage(
            this.label, this.modelId, invokedAt, durationMs,
            category, redact(`HTTP ${statusCode}: ${responseBody.slice(0, 200)}`),
            false
          ),
        };
      }

      // 200: try to parse as OpenAI envelope
      let rawJson: { choices?: Array<{ message?: { content?: string } }> };
      try {
        rawJson = JSON.parse(responseBody) as typeof rawJson;
      } catch {
        return {
          ok: false,
          usage: errorUsage(
            this.label, this.modelId, invokedAt, durationMs,
            "invalid_output", redact(`The response is not valid JSON: ${responseBody.slice(0, 200)}`),
            false
          ),
        };
      }

      const content = rawJson?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        return {
          ok: false,
          usage: errorUsage(
            this.label, this.modelId, invokedAt, durationMs,
            "invalid_output", "The response has missing or empty choices[0].message.content",
            false
          ),
        };
      }

      let plan: AcceptancePlan;
      try {
        plan = parsePlanFromJson(content);
      } catch (parseErr: unknown) {
        return {
          ok: false,
          usage: errorUsage(
            this.label, this.modelId, invokedAt, durationMs,
            "invalid_output", redact(`Plan parsing failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`),
            false
          ),
        };
      }

      plan.transportProvenance = "test";
      plan.projectId = req.projectId;
      plan.requirementId = req.requirementId;
      plan.originalRequirement = req.requirement;
      plan.fingerprint = computeFingerprint(plan);
      return {
        ok: true,
        plan,
        usage: { providerLabel: this.label, modelId: this.modelId, invokedAt, durationMs, isLive: false, status: "success", inputTokens: null, outputTokens: null },
      };
    }

    if (!this.fixturePlan) {
      return {
        ok: false,
        usage: errorUsage(
          this.label, this.modelId, invokedAt, durationMs,
          "invalid_output", "TestFixtureTransport: fixturePlan was not supplied",
          false
        ),
      };
    }

    const plan: AcceptancePlan = {
      ...this.fixturePlan,
      planId: this.fixturePlan.planId || `test-${uuidv4().slice(0, 8)}`,
      source: "generated",
      transportProvenance: "test",
      projectId: req.projectId,
      requirementId: req.requirementId,
      originalRequirement: req.requirement,
    };
    plan.fingerprint = computeFingerprint(plan);

    return {
      ok: true,
      plan,
      usage: {
        providerLabel: this.label,
        modelId: this.modelId,
        invokedAt,
        durationMs,
        isLive: false,
        status: "success",
        inputTokens: null,
        outputTokens: null,
      },
    };
  }
}
