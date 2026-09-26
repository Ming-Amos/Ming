# Application X-ray UI integration review

Codex ran `node scripts/review-xray-ui.mjs` on 2026-09-26 at 09:50:53-09:51:11 UTC. **43 checks passed, exit 0.** The script launched its own server on port 4416, used a separate browser profile and runtime directory, and stopped its browser/server afterward. It did not touch the running development server on port 4001, modify example source, invoke Bob, or call an external model.

Machine-readable result: [`evidence/xray-ui-integration/review-report.json`](evidence/xray-ui-integration/review-report.json).

## Verified through the actual web interface

- A new sample session shows fixture provenance and disables execution until the user explicitly confirms the plan.
- The buggy daily-report sample runs through the real browser. AC-01 and AC-03 pass; persistence AC-02 fails. The interface selects that failure and shows real loaded PNGs whose URLs contain the displayed run ID.
- Creating a repair task produces a `waiting` task. Its English handoff contains the exact task ID, baseline ID, plan fingerprint, and MCP instructions. The UI explicitly states that task creation does not automatically wake an AI agent. No repair was performed by this UI test.
- Reload restores the same baseline, screenshots and waiting task. A previously confirmed sample plan remains eligible for another run when its fingerprint still matches. At 390px width, the document has no horizontal page overflow.
- Generating a custom plan without provider configuration returns a real HTTP 503 and displays the configuration error. No hidden fixture fallback occurs.
- With an explicitly injected **local test transport**, the user enters requirements, generates a draft, reviews three criteria, confirms the exact fingerprint and starts a real browser run. The interface visibly labels the plan as test-generated, not a real model output.
- The normal sample passes all three checks. The second run also passes, uses the same confirmation, plan and runner, and receives a new run ID. The first run's JSON bytes remain unchanged.
- Opening a fixture run from history restores its fixture target/provenance and removes the unrelated generated requirement. Opening generated history restores the right target, original requirement and test provenance. Reload retains the confirmed generated plan and rerun ability.
- No browser JavaScript exceptions occurred. The original buggy sample file hash remained unchanged.

## Exact records

| Record | ID |
| --- | --- |
| Buggy sample run | `0ebf668c-047b-4c7d-b3f0-6bd6dbf0bf10` |
| Waiting repair task | `e1326af6-42dd-469d-a34c-1efad697d79d` |
| Test-generated draft | `2ed06ac0-c306-419d-8bf3-ef3345c92294` |
| Confirmation | `062de44c-3a38-4b61-91b2-250aaa8d2a75` |
| Generated-plan first run | `30014ca4-a758-42ef-847f-6798084f7e68` |
| Generated-plan rerun | `da11f32a-ab64-4325-9881-cbddeb7ec6a2` |

The private runtime and screenshots are under `runtime/xray-ui-cf8050fb-eca7-483f-8446-f2bc6db26482/`. Four screenshots were visually reviewed: desktop persistence failure, narrow restored workspace, missing-model configuration error and successful generated-plan rerun. These are integration-test records, separate from the exported product demonstration's actual coding-agent repair.

## Limits

This review establishes end-to-end UI behavior with a local fixture transport and real browser execution. It does not establish live model quality, arbitrary-project support, a successful repair by Bob, or public hosting availability. The separate official-SDK MCP demonstration supplies the actual repair evidence. The earlier Stage B 79-check route suite tested route/contract behavior; this review additionally demonstrates successful UI-driven browser acceptance with precise selectors.

To reproduce, build the server and web app, then run `node scripts/review-xray-ui.mjs`. The script refuses to attach if its configured review port is already in use. It explicitly empties provider API settings in its owned server and enables test fixtures only for that process.
