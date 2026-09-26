# Connect your coding AI to Ming

Ming exposes a local **stdio MCP server with 12 tools**. A connected coding agent can run your confirmed checks after completing a feature, read failures, fix the application and rerun the same standard. Ming does not automatically wake another editor, approve a new standard or edit source files itself.

## Connect once

1. Install/build Ming using the [README](../README.md), start it, and open **http://127.0.0.1:4001**.
2. Start your development application. Register it in Ming, save its requirements and confirm an acceptance plan. A manual plan works without a model API.
3. Open **让编码 AI 调用 Ming** in the UI, or add the following server to an MCP-capable coding tool. Change the absolute adapter path when moving the repository.

```json
{
  "mcpServers": {
    "ming-local": {
      "command": "node",
      "args": ["C:/Bob/Projects/Ming/apps/mcp/dist/index.js"]
    }
  }
}
```

The existing [Bob project configuration](../.bob/mcp.json) also specifies this computer's Node executable and working directory. These paths must exist locally. The adapter defaults to `http://127.0.0.1:4001`; its optional `MING_BASE_URL` environment variable accepts another local HTTP origin, with no credentials, path, query or fragment. It does not connect to the private Sites viewer.

After configuring the coding tool, verify it discovers the Ming tools. Opening the Ming webpage alone does not establish the MCP connection.

## Give the agent this instruction

```text
After completing a feature, use Ming to verify it against my saved acceptance standard:

1. Call ming_list_projects and ming_get_targets to identify this application.
   Call ming_get_project and select its newest active human confirmation.
   If none exists, ask me to review a plan in Ming first.
   Do not create or approve a different standard yourself.

2. Call ming_run_acceptance with the confirmationId.
   Poll ming_get_run until it finishes.
   Browser actions may change test data: use only the registered development application.

3. If a requirement fails, call ming_create_repair_task with that runId,
   then ming_get_failed_run and ming_get_repair_task.
   Claim the task using ming_claim_repair_task and your actual agent/session name.

4. Fix the application's source, not Ming's checks.
   Read the updated fingerprint with ming_get_targets, call ming_rerun_plan,
   then poll ming_get_run and read ming_get_comparison.

5. Report the actual results and run IDs.
   A live URL passing its checks is acceptance evidence, not proof that a frozen source snapshot was repaired.
   Do not claim verifiedRepair unless Ming reports it.
   Stop and explain blocked or incomplete results.
   Never weaken the confirmed standard to turn a failure green.
```

You normally save and confirm the requirements once, then reuse that active confirmation after each code change. When the requirement or standard changes, review and confirm its new revision in Ming before asking the agent to use it. A browser cancellation or blocked check is not a passing result.

## Tool reference

| Tool | Purpose / input |
| --- | --- |
| `ming_list_projects` | Discover saved projects. |
| `ming_get_project` | Read a `projectId`'s requirements, drafts and human confirmations. |
| `ming_get_targets` | Read registered targets, source locations and current fingerprints. |
| `ming_run_acceptance` | Execute an existing active `confirmationId`; returns a run ID promptly. |
| `ming_get_run` | Read a `runId`'s progress and actual results. |
| `ming_create_repair_task` | Create a repair handoff from a completed failed `runId`. |
| `ming_cancel_run` | Stop remaining work for a `runId`; already performed browser actions are not undone. |
| `ming_get_failed_run` | Read bounded failure observations and screenshot references for a `runId`. |
| `ming_get_repair_task` | Read the task's immutable original plan and repair context. |
| `ming_claim_repair_task` | Claim a waiting task with the actual agent/session identity. |
| `ming_rerun_plan` | Rerun the claimed task's original standard with the current expected target fingerprint. |
| `ming_get_comparison` | Read the actual before/after comparison and its verification limits. |

Use the tool's discovered input schema and IDs returned by Ming. Do not invent IDs, source versions or a completed result. The coding agent needs its own authorized file-editing tools to make the repair; MCP does not grant an arbitrary remote edit capability.

## What the result proves

A self-contained HTML target runs from a captured source snapshot. A strict verified repair also requires the original target and standard to match, a real source change, and successful rerun evidence.

A running multi-file local URL is observed live. Even when its source folder has a fingerprint, that hash does not establish which exact code the development server executed. Its passing checks remain useful acceptance evidence; the comparison does not claim the stronger snapshot guarantee.

Ming's browser and MCP tools do not call a language model. Optional plan generation and the coding agent's own reasoning/edits use their respective model accounts. No external provider has yet been configured or quality-tested in this project.

## If connection fails

- Confirm the local Ming URL opens, the adapter's compiled file exists and the configured Node executable works.
- Rebuild after changing MCP code, then restart/reload the server connection in the coding tool.
- If no active confirmation exists, finish the plan review in Ming.
- Keep the target app running. Its page, scripts and backend requests must be same-origin; use a development proxy for a separate backend. HTTP redirects and cross-origin requests are blocked.
- The Sites preview is read-only and remains private; it cannot run checks on your computer.

The earlier genuine Codex MCP repair is recorded in [demo evidence](demo-evidence/README.md). The expanded 12-tool workflow passed 16 actual-SDK MCP/report checks; a passing live-URL rerun remains “复验通过 · 待确认” with `verifiedRepair: false`. Current validation is tracked separately in [delivery status](DELIVERY_STATUS.md).
