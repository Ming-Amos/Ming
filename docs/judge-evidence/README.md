# English judge evidence — Shipboard

This bundle contains **new, actual browser executions** of the English Shipboard sample application. It does not translate, repaint, or replace any earlier evidence. The previous `docs/demo-evidence` bundle was checked byte-for-byte before and after this recording and remained unchanged.

The application and its seeded persistence defect are demonstration fixtures. The acceptance plan is hand-authored and labelled `source: fixture`; no language model generated it. No Bob credits or model API requests were used for this recording. The repair actor was **Codex via real stdio MCP**.

## Real repair, same standard

| Item | Actual value |
| --- | --- |
| Target | `shipboard-repair` |
| Logical URL | `http://localhost:4480/shipboard-repair` |
| Failed baseline | `33f7bcfb-5ffc-4c9c-bf6b-eb76cd6cef4c` |
| Repair task | `bbc50e50-7838-4bec-8a2b-4ec386d98679` |
| Passing rerun | `74ed3133-b62c-44cf-8b4a-042156180db5` |
| Original plan fingerprint | `9c1f3dcf7fd3f279` |
| Original runner fingerprint | `0f4cf2cc5fc32e24` |
| Result | `verifiedRepair: true`, no blockers |

The first criterion added a task and found it in the task list. The second refreshed the same browser and failed because the task disappeared. Empty and whitespace-only submissions were correctly rejected by the third criterion.

The real stdio MCP client read the failed run, created the repair task, and claimed it using the actual actor name. The recorder then paused. Codex inspected the evidence and changed only `examples/shipboard/repair/index.html`: the page now restores tasks from `localStorage` and writes changes back to it. The recorder itself did not apply the repair.

The client read the updated target fingerprint, called `ming_rerun_plan`, and retrieved the comparison. All three criteria passed under the same plan and runner, against the same target and logical URL. The browser executed a captured, self-contained HTML snapshot. The failed baseline record was checked byte-for-byte and remained unchanged.

`repair-process/` preserves the exact HTML before and after the edit, its source diff, and actual MCP protocol responses. The `buggy` example remains defective; the separately recorded `normal` example passes. Neither reference example changed during the repair.

## Recorded runs

| Sample | Run | Outcome |
| --- | --- | --- |
| Working example | `62d46b46-2227-4ac9-8b15-72ba5bbe7fc3` | 3/3 passed |
| Repeatable persistence defect | `c001b117-8865-4084-bfa6-e04ddde1683d` | Only SHIP-02 failed |
| Repair workspace, before fix | `33f7bcfb-5ffc-4c9c-bf6b-eb76cd6cef4c` | Only SHIP-02 failed |
| Same workspace, after fix | `74ed3133-b62c-44cf-8b4a-042156180db5` | 3/3 passed; strict verified repair |

## Bundle and validation

- `runtime/runs`, `runtime/repair-tasks`, and `runtime/screenshots` are copied original records and PNGs.
- `raw-wire-responses.json` preserves the actual captured HTTP responses, including the complete target list.
- `api-responses.json` selects these three English targets and four runs for the public viewer. Capabilities declare read-only mode, and provider status describes an evidence viewer without a model connection. Run, task, comparison, plan, and screenshot content is not rewritten. These presentation settings are not claims that the public site can execute local projects.
- `manifest.json` contains SHA-256 hashes, the strict comparison, and featured baseline/rerun identifiers.
- `review-report.json` records **21/21 successful checks**, including unchanged reference examples and plan, unchanged old evidence, real MCP interaction, English-only judge-facing records, and strict repair verification.

The stored localhost URL describes where the actual run occurred. The recording server was stopped after export. The public viewer serves the captured records and images; it does not need that local server to remain running.

The actual add-task screenshot, missing-task screenshot after reload, repaired reload screenshot, and blank-input validation screenshot were opened and visually inspected. The interface and all observations are English. A separate [390-pixel browser capture](visual-review/shipboard-mobile.png) also verifies the working example's persisted task after reload, no horizontal overflow, and no browser errors; its checks are in [visual-review/report.json](visual-review/report.json). This supplemental capture is design QA, not substituted run evidence.

Recording entry point: `scripts/record-english-demo.mjs`. It refuses to overwrite a reviewed bundle or start from an already repaired source. Reproduction should use a separate clean workspace, with the original seeded repair source, and produce a separate evidence bundle.
