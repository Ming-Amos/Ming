# Connecting a coding agent to Ming

Start the built local server on port 4001. The stdio MCP adapter exposes bounded
evidence and repair actions. It never writes target source itself: the connected
coding agent uses its normal file-editing capabilities and calls Ming to verify.

IBM Bob already discovered the adapter and its five tools. That connection
screenshot is in `bob_sessions/ming_mcp_connected_tools.png`. Actual repair work
after Bob's trial exhaustion is performed by Codex and must be attributed to
Codex, not to a nonexistent Bob session.

For another checkout, update the absolute paths in the local MCP settings:

```json
{"mcpServers":{"ming-local":{"command":"node","args":["/absolute/path/to/Ming/apps/mcp/dist/index.js"]}}}
```

## Agent workflow

1. The user confirms a plan and runs it. A failed run creates a repair task from
   the web UI. Creating a task does not wake or claim an AI agent.
2. Read `ming_get_repair_task` and `ming_get_failed_run`. Inspect the stated
   expected behavior, actual observation, source and screenshot references.
3. Call `ming_claim_repair_task` with the real actor name. Repair the registered
   target source at the same location. Keep the plan and runner unchanged.
4. Compute the updated source fingerprint using Ming's canonical convention:
   SHA-256 of `JSON.stringify(utf8HtmlText)`, first 16 hex characters. Supply it
   to `ming_rerun_plan` as `expectedTargetFingerprint`.
5. Read `ming_get_comparison`. Only `verifiedRepair: true` supports a verified
   repair claim. An unchanged-source pass, altered test, missing criterion,
   source race, incomplete run or executor failure does not.

`node scripts/mcp-call.mjs --list` uses the actual MCP SDK client to discover
tools. Calling it is not an LLM request and uses no Bobcoins. Its results must
not be mislabeled as Bob's own tool calls. All source edits remain reviewable.

## Current scope

Targets are explicitly registered in `fixtures/targets.json`. Business-specific
steps live in plans, not in the browser runner. Snapshot provenance currently
covers self-contained HTML targets. Multi-file applications, authenticated
sessions, external assets and arbitrary remote URLs need additional integration.
