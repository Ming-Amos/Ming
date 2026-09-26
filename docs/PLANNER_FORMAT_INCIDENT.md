# Shipboard draft-format failure

At 2026-09-26 17:27:51 UTC the hosted `/api/upload/planner/draft` request `3606d3eee9be4da53a7c4e6960e9cdb2` returned HTTP 502. Its secret-safe diagnostic was `PLANNER_INVALID_DRAFT / JSON_SYNTAX`, with 702 input and 510 output tokens. The provider envelope was complete, but its message content was not valid JSON. No acceptance execution followed that rejected draft.

The raw failed content was not logged, so the exact syntax defect is unknown. A fresh local request using the stated three Shipboard requirements and the actual browser inventory succeeded, demonstrating that the failure was intermittent rather than a consistently invalid user requirement. The earlier successful counter example had not verified this more complex workflow.

## Correction

- Replace JSON-object mode with strict, closed JSON Schema structured output for the nine supported action types and required string fields.
- Keep independent strict JSON parsing and all existing limits, action checks, assertions and review/confirmation gates. No syntax guessing, hidden model retries or automatic execution.
- Display a clear draft-generation failure card with actual usage, safe diagnostic details and copy support, while preserving the existing project, requirements, plan, confirmation and evidence.
- Add the exact three-requirement Shipboard scenario to production verification: one actual generated plan, genuine persistence failure on the buggy upload, then the unchanged plan passing against the prepared corrected upload. This does not claim an AI-generated source repair.

Before publication, the provider accepted the strict schema for Seed 2.0 Pro and returned a valid nine-step Shipboard draft (966 input / 354 output tokens). Backend regression: 30/30; compiled planner UI regression: 29/29, using explicitly mocked provider responses and an actual browser run. [UI regression](evidence/upload-planner-ui/2026-09-26T17-44-19-904Z-d6057cad/report.json).

## Production verification

Private site version 11 deployed successfully at 2026-09-26 17:48:14 UTC from application commit `4e0bde45980b692a77b12130467f39522679fa72`. The exact deployed frontend is `index-BNIOEhlS.js`. A fresh browser verified **15/15 checks** using the stated Shipboard requirements and one actual model call (970 input / 497 output tokens). Its nine generated steps covered empty-input validation, task creation, and reload persistence. The buggy upload failed on persistence; the corrected upload passed all nine unchanged steps. Run IDs and source hashes changed, while the acceptance plan and original failed baseline remained intact. No browser exceptions, unexpected network requests or automatic model retries occurred.

[Production report](evidence/shipboard-doubao/2026-09-26T17-49-25-055Z-0db01f40/production-report.json) · [corrected-source comparison](evidence/shipboard-doubao/2026-09-26T17-49-25-055Z-0db01f40/03-shipboard-revision-accepted.png).

This repair used three successful diagnostic/verification requests (3,993 reported tokens) and no Bob calls; the user's earlier rejected draft separately reported 1,212 tokens. There were no automatic retries. Structured output constrains format; it does not establish semantic correctness for arbitrary requirements, so review remains mandatory.
