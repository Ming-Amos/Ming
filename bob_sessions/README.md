# IBM Bob task-session evidence

These eight original PNGs were captured from the IBM Bob IDE on September 26, 2026. They document four Bob tasks, three intermediate snapshots of those tasks, and one MCP connection check. The screenshots have not been cropped, annotated, regenerated, or otherwise altered for this evidence package.

## Four task summaries

| Stage | Original screenshot | Task ID | Contribution and limit |
| --- | --- | --- | --- |
| A — initial handoff | [Task 01 summary](ming_task01_stage_a_workspace_handoff_summary.png) | `6fbf911e3cfc7536758d59aec3e9fe17` | Initial Ming foundation work. The task was attached to the earlier daily-report workspace and was deliberately stopped; continuation moved to the Ming workspace. This task was not a completed validation. |
| A — implementation | [Task 02 summary](ming_task02_stage_a_final_summary.png) | `2b41a80061020f364f496c02d0c9c5e7` | Bob implemented the core browser runner, local service, initial interface, evidence/history and sample checks. Completion and independent review are recorded separately in [Stage A results](../docs/STAGE_A_RESULT.md). |
| B — reviewed plans | [Task 03 summary](ming_task03_stage_b_final_summary.png) | `bfa75e6b4e53cc8425e6754a8b69c8f3` | Bob implemented the configurable model-provider adapter, draft validation, human confirmation and confirmed-plan execution. [Stage B results](../docs/STAGE_B_RESULTS.md) distinguish local fixture/transport validation from later live-provider work. |
| C — interrupted foundation | [Task 04 summary](ming_task04_stage_c_budget_stop_summary.png) | `df9086562f51a115ee3a91b661b0e968` | Bob began repair-task contracts/routes and the stdio MCP adapter. The screenshot shows **Budget Exceeded** when the trial allowance ended. This was an incomplete handoff; see the [Stage C checkpoint and subsequent Codex takeover](../docs/STAGE_C_STATUS.md). |

The task ID, workspace and usage fields are visible in each image. A filename containing `final_summary` identifies the last retained summary snapshot for that task; it does not turn the conversation excerpt beneath it into proof that every command or test passed. Implementation and verification claims belong to the linked stage records.

## Intermediate and connection records

- [Stage A before compaction](ming_task02_stage_a_pre_compaction_summary.png) and [Stage A turn limit](ming_task02_stage_a_turn_limit_summary.png) are earlier snapshots of Task 02. The turn-limit image records a task-turn limit, distinct from the later Stage C trial-budget stop.
- [Stage B before compaction](ming_task03_stage_b_pre_compaction_summary.png) is an earlier snapshot of Task 03.
- [MCP connected and tool discovery](ming_mcp_connected_tools.png) shows Bob Settings reporting `ming-local` as **Connected**, with `ming_get_failed_run` visible. Codex performed this connection check after compiling the adapter. It establishes registration and discovery only; it does **not** show Bob calling a tool or repairing the target application.

Displayed Bobcoins are retained verbatim in the images and transcribed individually in the [manifest](manifest.json). Multiple snapshots of one task are not separate charges and must not be added together. No account balance, remaining allowance or total billing claim is inferred.

## Attribution and preservation

Bob built the initial Stage A/B core and started the Stage C repair/MCP foundation. After the quota interruption, the user authorized Codex to complete and extend the product. Later Codex implementation, interface work, integrations and recorded repairs are attributed separately; the [Bob usage statement](../docs/submission/bob-usage.md) and [current delivery record](../docs/DELIVERY_STATUS.md) describe that division. Historical screenshot text describes the state at capture time, not the current provider configuration.

The manifest lists all eight images with SHA-256, dimensions, task mapping, category and original Git commit. A September 27 visual review found no visible API keys, passwords or authorization tokens. Each image's bytes also matched its first committed Git version. This review and documentation update made no Bob requests and consumed no Bob credits.

For a presentation, use the complete [Stage B summary](ming_task03_stage_b_final_summary.png); the [Stage A summary](ming_task02_stage_a_final_summary.png) is an optional second image. Keep originals legible and describe their scope accurately. These files document Bob participation; they do not establish competition eligibility or imply that a final submission has been made.
