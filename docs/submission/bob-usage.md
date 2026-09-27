# IBM Bob Usage Statement

Review copy updated 2026-09-27 for the guided workflow and verified hosted model integration. Statement body: **357 English words** (whitespace-delimited; under 500). Copy only the text below the divider into the submission field. This file is not a submitted entry or an eligibility determination.

---

IBM Bob built the initial core of Ming: browser acceptance checks, execution evidence, reviewed plans, and the foundations for handing failures back to a coding agent.

In Stage A, Bob implemented the TypeScript workspace, shared acceptance contracts, Playwright runner, local service, and initial React interface. Checks could inherit browser context, retain run history, and link screenshots to executed assertions. Bob also created normal and deliberately defective daily-report samples and validation scripts. Codex independently compiled and reviewed the implementation.

In Stage B, Bob implemented a configurable model-provider adapter, bounded page inspection, draft validation, human confirmation, and execution of confirmed plans. Independent review found sensitive-error redaction and repeat-run issues, which Bob corrected. Stage B validation used clearly identified local provider fixtures; those responses are not claimed as real external model output.

Bob began Stage C with repair-task contracts and HTTP routes, runner identity recording, project MCP configuration, and a stdio adapter exposing five tools. The Bob settings screenshot shows the adapter connected and its tools discovered. It does not show Bob calling those tools or completing a source repair. Bob's trial quota ended before that stage was complete.

The user then authorized Codex to finish and extend the product. Codex completed source-binding and comparison integrity, expanded the adapter to 12 MCP tools, and added project registration, cancellation, recovery, model settings, and report export. Codex also implemented the English Evidence Studio, static HTML/ZIP uploads, public GitHub imports, the simplified guided workflow, and the later Doubao Seed 2.0 Pro integration. The hosted model's real nine-step Shipboard verification is documented separately from Bob's earlier fixture tests.

The recorded local Shipboard repair is attributed to Codex: it used actual stdio MCP to retrieve and claim the failure, edited the same target's persistence logic, and reran the unchanged three-criterion plan. All three criteria passed with verified repair. These later extensions and repairs used no additional Bob calls.

Original Bob task-session summary screenshots remain unchanged in bob_sessions, with task IDs, contribution details, and links to the stage records in its README. The repository preserves Bob-assisted source files alongside separately attributed later work. Neither IBM watsonx.ai nor IBM watsonx Orchestrate was used in the verified implementation.
