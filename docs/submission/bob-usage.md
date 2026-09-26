# IBM Bob Usage Statement

**Review copy — contribution attribution is based on saved Bob sessions and the recorded Codex repair.** The statement below is under 500 English words. Copy only the text below the divider into the submission field.

---

IBM Bob was used to build the core of Ming, a web application for verifying AI-developed features through real browser acceptance checks and structured failure evidence.

In Stage A, Bob implemented the TypeScript workspace, shared acceptance contracts, Playwright runner, local service, and initial React interface. This included real browser actions, dependent acceptance conditions, run history, and screenshots linked to executed checks. Bob also created the normal and deliberately defective daily-report samples and validation scripts. The resulting implementation was independently built and reviewed with Codex.

In Stage B, Bob implemented the configurable model-provider adapter, bounded page inspection, draft-plan validation, user confirmation, and execution of the confirmed plan. Codex's independent review found issues in sensitive-error redaction and repeat-run availability; Bob corrected them, and the changes were tested again. The recorded provider tests use local simulated responses rather than a live external model. We do not present those responses as genuine model-generated acceptance plans.

Bob also began Stage C: repair-task contracts and service routes, run comparison, and a stdio MCP adapter exposing five tools for retrieving evidence, claiming a repair task, rerunning a plan, and reading the comparison. The adapter connected to Bob and its tools were discovered. This confirms tool registration; it does not establish that Bob executed a target repair.

After Bob's trial quota ended, Codex completed the core integrity constraints, independent todo sample, Application X-ray interface implementation, and public evidence adapter, and prepared the delivery materials. The final interface passed 43 integration checks. These additions are attributed to Codex rather than Bob.

The recorded target repair was also performed by Codex: it retrieved and claimed the task through the real stdio MCP adapter, edited the same target's persistence logic, and reran the original plan. The comparison reports a verified repair with unchanged acceptance and runner fingerprints. This evidence demonstrates the MCP workflow without claiming that Bob performed the later repair.

The repository's `bob_sessions` directory contains genuine task-session summary screenshots, with task IDs and contributions documented in its README. Stage A and B result reports provide further implementation and validation records. Neither IBM watsonx.ai nor watsonx Orchestrate was used in the verified implementation.
