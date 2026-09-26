# Problem & Solution Statement

**Review copy for the current local product. The statement distinguishes present capabilities from the earlier recorded demonstration.** Statement body: **428 English words**. Copy only the text below the divider into the submission field. This file is not a submitted entry or an eligibility determination.

---

AI can write a feature faster than a developer can verify it. After every “done,” someone still opens the application, checks each requirement, captures failures, explains them to the coding assistant, and repeats the process after the next edit.

Ming is a local acceptance workspace for developers and small teams building web applications with AI. It connects requirements, real browser behavior, failure evidence, and the coding agent's next action.

Start your development application, register its local URL or a self-contained HTML file, and save the feature requirements. Write an acceptance plan without a model API, or configure a compatible provider to propose a draft. Review the conditions, dependencies, locators, and expected results before confirming. Editing the standard or changing the requirement requires a new confirmation; previous records remain available.

Ming executes the confirmed plan in a real browser. Its visual workspace connects each condition to the actual steps, expected and observed behavior, and original screenshots. It distinguishes failed requirements from blocked prerequisites and execution errors. Runs can be cancelled, interrupted runs recover honestly after a restart, and completed evidence can be exported as JSON, Markdown, or a standalone HTML report.

A connected coding agent can use Ming's 12 MCP tools to discover projects, run an approved plan, read failures, claim a repair task, edit the target application, and rerun the original standard. Creating a task does not automatically wake an editor or authorize a different acceptance standard.

Ming separates a passing check from stronger repair proof. A live local URL can pass its rerun while remaining “acceptance passed, review required”: a source-folder fingerprint cannot prove which bytes the development server executed. Self-contained HTML runs use a captured document; strict repair verification additionally requires matching plan, runner, and target identities, changed source, complete passing results, and preserved baseline evidence.

The earlier recorded demonstration shows Codex using real stdio MCP to repair a daily-report persistence defect and pass the unchanged plan. Current independent tests also exercise a multi-file local application with a real HTTP API, manual-plan revisions, cancellation, and restart recovery. The existing video and deck show that earlier demonstration checkpoint, not every newly added feature.

The supported workflow is local, same-origin web development. Cross-origin requests and HTTP redirects are blocked; arbitrary websites and automatic login setup are outside its current scope. Model configuration is available, but no external provider has been quality-tested. Manual acceptance needs no model API. The hosted viewer presents reviewed historical evidence in read-only form; new execution runs locally.

Ming makes “done” inspectable, with a reusable standard and evidence the next development step can act on.
