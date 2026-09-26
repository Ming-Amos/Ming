# IBM Bob Usage Statement

**Review copy based on original Bob summaries and separately attributed Codex work. Current English own-project UI: 32/32 passed; Evidence Studio and compiled read-only viewer: 47/47 passed.** Statement body: **375 English words**. Copy only the text below the divider into the submission field. This file is not a submitted entry or an eligibility determination.

---

IBM Bob built the initial core of Ming, a local application for checking AI-developed features through real browser actions and structured evidence.

In Stage A, Bob implemented the TypeScript workspace, shared acceptance contracts, Playwright runner, local service and initial React interface. This included dependent acceptance conditions, run history, and screenshots linked to executed checks. Bob also created normal and deliberately defective daily-report samples and validation scripts. Codex independently built and reviewed that implementation.

In Stage B, Bob implemented the configurable model-provider adapter, bounded page inspection, draft validation, human confirmation, and execution of confirmed plans. Codex's review identified sensitive-error redaction and repeat-run issues; Bob corrected them. These tests used explicitly identified local provider fixtures, not an external model. Their responses are not presented as live model-generated plans.

Bob began Stage C with repair-task contracts and service routes, comparison, and a stdio MCP adapter exposing five tools for evidence, claiming, rerunning and comparison. Bob's settings showed the adapter connected and its tools discovered. That screenshot demonstrates registration, not Bob executing a repair.

When Bob's trial quota ended, the user authorized Codex to finish and extend Ming. Codex completed source-binding and comparison integrity, user-project registration, multi-file local URL support, manual plan editing and revisions, model-settings controls, cancellation and recovery, report export, and the expanded 12-tool MCP workflow.

Codex also implemented the English Evidence Studio, recorded-step playback, focus mode, command menu, original-image comparison slider, and the English Shipboard examples. The new Shipboard repair evidence is entirely attributed to Codex: an actual stdio MCP client retrieved and claimed the failed task; Codex changed the same target's persistence code; the original plan then passed all three criteria with matching runner identity and strict verified repair. No new Bob calls were used for these additions or repairs.

Original task-session summary screenshots remain in the repository's bob_sessions directory, with task IDs and contribution details in its README. They were not replaced or altered. Earlier daily-report repair evidence is also preserved separately. The existing 164-second video and five-slide deck document the previous checkpoint; a new recording and presentation refresh are still needed for the current interface.

No external model provider has been configured or quality-tested. Manual and demonstration plans are clearly identified. Neither IBM watsonx.ai nor watsonx Orchestrate was used in the verified implementation.
