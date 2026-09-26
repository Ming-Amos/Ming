# Shipboard draft-format failure

At 2026-09-26 17:27:51 UTC the hosted `/api/upload/planner/draft` request `3606d3eee9be4da53a7c4e6960e9cdb2` returned HTTP 502. Its secret-safe diagnostic was `PLANNER_INVALID_DRAFT / JSON_SYNTAX`, with 702 input and 510 output tokens. The provider envelope was complete, but its message content was not valid JSON. No acceptance execution followed that rejected draft.

The raw failed content was not logged, so the exact syntax defect is unknown. A fresh local request using the stated three Shipboard requirements and the actual browser inventory succeeded, demonstrating that the failure was intermittent rather than a consistently invalid user requirement. The earlier successful counter example had not verified this more complex workflow.

## Correction

- Replace JSON-object mode with strict, closed JSON Schema structured output for the nine supported action types and required string fields.
- Keep independent strict JSON parsing and all existing limits, action checks, assertions and review/confirmation gates. No syntax guessing, hidden model retries or automatic execution.
- Display a clear draft-generation failure card with actual usage, safe diagnostic details and copy support, while preserving the existing project, requirements, plan, confirmation and evidence.
- Add the exact three-requirement Shipboard scenario to production verification: one actual generated plan, genuine persistence failure on the buggy upload, then the unchanged plan passing against the prepared corrected upload. This does not claim an AI-generated source repair.

Before publication, the provider accepted the strict schema for Seed 2.0 Pro and returned a valid nine-step Shipboard draft (966 input / 354 output tokens). Backend regression: 30/30; compiled planner UI regression: 29/29, using explicitly mocked provider responses and an actual browser run. [UI regression](evidence/upload-planner-ui/2026-09-26T17-44-19-904Z-d6057cad/report.json). Production verification is recorded after deployment.
