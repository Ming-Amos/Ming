# Stage C checkpoint — incomplete

Recorded by Codex, 2026-09-26. Bob task `df9086562f51a115ee3a91b661b0e968` stopped at 14:43 Beijing with `TrialExpiredError / Budget Exceeded`. Its IDE summary shows 10.12 Bobcoins. No paid upgrade or overage was enabled by Codex.

Bob implemented repair-task contracts and HTTP routes, an official-SDK STDIO MCP adapter, project-scoped `.bob/mcp.json`, and runner fingerprint recording. The frontend only has preparatory imports/types; its repair panel is not implemented. The self-contained HTML snapshot fields were added to contracts, but navigation still uses the live target. See the 14:41 recheck in `docs/STAGE_C_CORE_REVIEW.md` for unresolved source-version, shared comparison predicate and confirmation-integrity requirements.

## Independent checks after the interruption

- Runner/server build passed; MCP build passed. These are compilation results, not full acceptance.
- Whole-workspace typecheck failed in `apps/web/src/App.tsx`: unused `RepairTaskRecord` and `RepairComparison` imports from the interrupted UI implementation. Codex has not silently completed that core implementation.
- `scripts/review-repair-api.mjs` ran against a temporary, owned local server: **49 passed, 0 failed**. It created genuine browser runs through the API, checked duplicate creation/claims and a stale source-fingerprint rejection, then reran the unchanged buggy target. Persistence still failed and `verifiedRepair` stayed false. Original baseline bytes and target source were unchanged. The owned server was stopped afterward.
- Baseline: `143b3dd0-6a4e-4c5e-b34b-033e27a06e3b`; repair task: `5aeb0cce-5983-4f10-862d-fc20860c41eb`; rerun: `05d83486-6b93-4b3b-9927-8b00df6cda68`. Owner explicitly identifies Codex independent API testing, not Bob.
- Report: `runtime/review-repair-api-2026-09-26T09-24-54-471Z-cab7e0b0.json`. This check does not cover or close the remaining review findings.
- After compiling the adapter, Codex restarted the configured MCP server through Bob Settings. The actual Bob IDE displayed **Connected**, version 0.1.0, and discovered its tools. Screenshot: `bob_sessions/ming_mcp_connected_tools.png`. No AI prompt, paid upgrade, or Bob tool execution was performed during this connection check.

## Required next work

Finish the three focused core-review gaps and the minimal repair UI; rerun relevant verification; then record a fresh baseline, have an authorized coding agent retrieve/claim its evidence, actually edit the same buggy source, rerun the same confirmed plan, and verify comparable results. A genuine Bob repair demonstration still requires available Bob account quota. Do not present the present API test or Connected screenshot as that demonstration.

Stage D visual work, second-project proof, live external model validation, deployment and final submission materials also remain. The complete project is not finished.
