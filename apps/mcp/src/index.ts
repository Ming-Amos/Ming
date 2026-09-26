#!/usr/bin/env node
/**
 * Ming MCP stdio adapter (Stage C)
 *
 * Exposes five bounded tools for Bob IDE:
 *   ming_get_failed_run     — read a failed run's evidence (size-bounded)
 *   ming_get_repair_task    — retrieve a repair task by ID
 *   ming_claim_repair_task  — atomically claim a waiting task
 *   ming_rerun_plan         — start the repair rerun, returns runId promptly
 *   ming_get_comparison     — poll comparison after rerun completes
 *
 * All calls go to http://127.0.0.1:4001 (fixed, local-only).
 * No arbitrary filesystem paths or external URLs are accepted.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";

const MING_BASE = "http://127.0.0.1:4001";
const MAX_EVIDENCE_STEPS = 20; // cap number of steps returned per criteria

// ── HTTP helper ───────────────────────────────────────────────────

async function mingFetch(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(new URL(path, MING_BASE), {
      method: opts.method ?? "GET",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.body) throw new Error("Empty response from Ming server");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024 * 1024) {
        controller.abort();
        throw new Error("Ming response exceeds the 1 MiB evidence limit");
      }
      chunks.push(value);
    }
    let data: Record<string, unknown>;
    try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new Error("Non-JSON response from Ming server"); }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${String(data?.error ?? "Ming request failed")}`);
    return data;
  } finally { clearTimeout(timer); }
}

// ── Server setup ──────────────────────────────────────────────────

const server = new McpServer({
  name: "ming-local",
  version: "0.1.0",
});

// ── Tool: ming_get_failed_run ─────────────────────────────────────

server.registerTool(
  "ming_get_failed_run",
  {
    description:
      "Retrieve size-bounded evidence from a Ming failed or error run. " +
      "Returns plan/target fingerprints, failed criteria with expected/actual values, " +
      "and resolvable screenshot references. Use to understand what needs to be repaired.",
    inputSchema: {
      runId: z.string().describe("The runId of a failed or error run"),
    },
  },
  async ({ runId }: { runId: string }) => {
    if (!runId || typeof runId !== "string" || !/^[0-9a-f-]{36}$/.test(runId)) {
      return { isError: true, content: [{ type: "text" as const, text: "Error: runId must be a UUID" }] };
    }

    let data: Record<string, unknown>;
    try {
      data = (await mingFetch(`/api/run/${runId}`)) as Record<string, unknown>;
    } catch (err) {
      return { isError: true, content: [{ type: "text" as const, text: `Error contacting Ming server: ${String(err)}` }] };
    }

    if (!data.ok) {
      return { isError: true, content: [{ type: "text" as const, text: `Ming error: ${data.error}` }] };
    }

    const run = data.run as Record<string, unknown>;

    // Return a bounded summary — full step lists are capped
    type CriteriaResult = {
      criteriaId: string;
      title: string;
      status: string;
      blockedReason?: string;
      steps: Array<{
        stepId: string;
        description: string;
        status: string;
        expected?: unknown;
        actual?: string;
        error?: string;
        screenshotPath?: string;
      }>;
    };

    const criteria = (run.criteria as CriteriaResult[] ?? []).map((c) => ({
      criteriaId: c.criteriaId,
      title: c.title,
      status: c.status,
      blockedReason: c.blockedReason,
      steps: (c.steps ?? []).slice(0, MAX_EVIDENCE_STEPS).map((s) => ({
        stepId: s.stepId,
        description: s.description,
        status: s.status,
        expected: s.expected,
        actual: s.actual,
        error: s.error,
        // Provide resolvable URL rather than bare path
        screenshotUrl: s.screenshotPath
          ? `${MING_BASE}/api/screenshots/${s.screenshotPath.split(/[\\/]/).pop()}`
          : undefined,
      })),
    }));

    const summary = {
      runId: run.runId,
      status: run.status,
      planId: run.planId,
      planVersion: run.planVersion,
      planFingerprint: run.planFingerprint,
      targetVariant: run.targetVariant,
      targetUrl: run.targetUrl,
      targetFingerprint: run.targetFingerprint,
      runnerFingerprint: run.runnerFingerprint,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      fatalError: run.fatalError,
      criteria,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
    };
  }
);

// ── Tool: ming_get_repair_task ────────────────────────────────────

server.registerTool(
  "ming_get_repair_task",
  {
    description:
      "Retrieve a Ming repair task by taskId. Returns baseline run evidence, " +
      "plan/target fingerprints, failed criteria summary and reproduction steps.",
    inputSchema: {
      taskId: z.string().describe("The taskId of the repair task"),
    },
  },
  async ({ taskId }: { taskId: string }) => {
    if (!taskId || !/^[0-9a-f-]{36}$/.test(taskId)) {
      return { isError: true, content: [{ type: "text" as const, text: "Error: taskId must be a UUID" }] };
    }

    let data: Record<string, unknown>;
    try {
      data = (await mingFetch(`/api/repair-tasks/${taskId}`)) as Record<string, unknown>;
    } catch (err) {
      return { isError: true, content: [{ type: "text" as const, text: `Error contacting Ming server: ${String(err)}` }] };
    }

    if (!data.ok) {
      return { isError: true, content: [{ type: "text" as const, text: `Ming error: ${data.error}` }] };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(data.task, null, 2) }],
    };
  }
);

// ── Tool: ming_claim_repair_task ──────────────────────────────────

server.registerTool(
  "ming_claim_repair_task",
  {
    description:
      "Claim a waiting repair task so the connected coding agent can work on it. " +
      "Repeat claims from the same owner are idempotent. " +
      "Competing owners are rejected with HTTP 409.",
    inputSchema: {
      taskId: z.string().describe("The taskId to claim"),
      claimedBy: z
        .string()
        .describe("Identifier for the claimant (e.g. 'bob-session-<id>')"),
    },
  },
  async ({ taskId, claimedBy }: { taskId: string; claimedBy: string }) => {
    if (!taskId || !/^[0-9a-f-]{36}$/.test(taskId)) {
      return { isError: true, content: [{ type: "text" as const, text: "Error: taskId must be a UUID" }] };
    }
    if (!claimedBy || !claimedBy.trim()) {
      return { isError: true, content: [{ type: "text" as const, text: "Error: claimedBy must not be empty" }] };
    }

    let data: Record<string, unknown>;
    try {
      data = (await mingFetch(`/api/repair-tasks/${taskId}/claim`, {
        method: "POST",
        body: { claimedBy: claimedBy.trim() },
      })) as Record<string, unknown>;
    } catch (err) {
      return { isError: true, content: [{ type: "text" as const, text: `Error contacting Ming server: ${String(err)}` }] };
    }

    if (!data.ok) {
      return { isError: true, content: [{ type: "text" as const, text: `Ming error: ${data.error}` }] };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(data.task, null, 2) }],
    };
  }
);

// ── Tool: ming_rerun_plan ─────────────────────────────────────────

server.registerTool(
  "ming_rerun_plan",
  {
    description:
      "Start a rerun of the same acceptance plan for a claimed repair task. " +
      "Returns a runId promptly; poll /api/run/:runId/progress for completion. " +
      "Validates that the plan fingerprint is unchanged and the source fingerprint " +
      "matches expectedTargetFingerprint (binding source version to execution). " +
      "Prevents duplicate concurrent reruns. " +
      "Supply expectedTargetFingerprint: compute it from the target file AFTER your " +
      "repair edit to confirm the exact source version you intend to test.",
    inputSchema: {
      taskId: z.string().describe("The taskId of the claimed repair task"),
      expectedTargetFingerprint: z
        .string()
        .describe(
          "Ming fingerprint of the repaired HTML source: SHA-256 of JSON.stringify(UTF-8 file text), first 16 hex characters (baselineTargetFingerprint from " +
          "the repair task if no change yet, or newly computed after your edit). " +
          "Binds the rerun to the exact source version you repaired."
        ),
    },
  },
  async ({ taskId, expectedTargetFingerprint }: { taskId: string; expectedTargetFingerprint: string }) => {
    if (!taskId || !/^[0-9a-f-]{36}$/.test(taskId)) {
      return { isError: true, content: [{ type: "text" as const, text: "Error: taskId must be a UUID" }] };
    }
    if (!expectedTargetFingerprint || !expectedTargetFingerprint.trim()) {
      return { isError: true, content: [{ type: "text" as const, text: "Error: expectedTargetFingerprint must not be empty" }] };
    }

    let data: Record<string, unknown>;
    try {
      data = (await mingFetch(`/api/repair-tasks/${taskId}/rerun`, {
        method: "POST",
        body: { expectedTargetFingerprint: expectedTargetFingerprint.trim() },
      })) as Record<string, unknown>;
    } catch (err) {
      return { isError: true, content: [{ type: "text" as const, text: `Error contacting Ming server: ${String(err)}` }] };
    }

    if (!data.ok) {
      return { isError: true, content: [{ type: "text" as const, text: `Ming error: ${data.error}` }] };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { runId: data.runId, taskId: data.taskId, progressUrl: `${MING_BASE}/api/run/${data.runId}/progress` },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Tool: ming_get_comparison ─────────────────────────────────────

server.registerTool(
  "ming_get_comparison",
  {
    description:
      "Get the comparison between baseline and repaired rerun for a repair task. " +
      "Returns plan/runner/target identity checks, fingerprint changes, " +
      "previously-failing criteria that now pass, and a verifiedRepair boolean. " +
      "Call after the rerun has completed.",
    inputSchema: {
      taskId: z.string().describe("The taskId whose comparison to retrieve"),
    },
  },
  async ({ taskId }: { taskId: string }) => {
    if (!taskId || !/^[0-9a-f-]{36}$/.test(taskId)) {
      return { isError: true, content: [{ type: "text" as const, text: "Error: taskId must be a UUID" }] };
    }

    let data: Record<string, unknown>;
    try {
      data = (await mingFetch(`/api/repair-tasks/${taskId}/comparison`)) as Record<string, unknown>;
    } catch (err) {
      return { isError: true, content: [{ type: "text" as const, text: `Error contacting Ming server: ${String(err)}` }] };
    }

    if (!data.ok) {
      return { isError: true, content: [{ type: "text" as const, text: `Ming error: ${data.error}` }] };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(data.comparison, null, 2) }],
    };
  }
);

// ── Start transport ───────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is reserved for MCP protocol
  process.stderr.write("[ming-mcp] Ming MCP adapter started\n");
}

main().catch((err) => {
  process.stderr.write(`[ming-mcp] Fatal: ${String(err)}\n`);
  process.exit(1);
});
