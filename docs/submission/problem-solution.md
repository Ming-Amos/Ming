# Problem & Solution Statement

**Review copy — supported by the recorded core demonstration on 2026-09-26.** The statement below is under 500 English words. Copy only the text below the divider into the submission field. Publication and the narrated video are tracked separately in `docs/DELIVERY_STATUS.md`.

---

AI can write a feature faster than a developer can verify it. After every “done,” someone still has to open the application, click through the requirements, take screenshots, explain failures to the coding assistant, and repeat those checks after each change.

Ming turns that repetitive work into an evidence-based acceptance workflow for independent developers and small teams building web applications with AI.

The developer saves a requirement and reviews a structured acceptance plan. Each condition records its expected behavior, prerequisites, and browser steps. Once confirmed, Ming executes those steps in a real browser and retains the results and screenshots. Dependent checks are blocked when their prerequisites fail; execution errors are distinguished from unmet requirements.

The Application X-ray interface connects requirements, browser evidence, observed failures, and the repair handoff. A coding agent retrieves the structured evidence through Ming's MCP tools, claims the task, edits the target, and requests another check. Creating a task does not automatically wake the agent.

In the recorded demonstration, Codex retrieved a failed daily-report task through actual stdio MCP, repaired its persistence logic in the same source file, and reran the unchanged acceptance plan. The previously failing refresh check passed, alongside the other two criteria. The comparison verifies matching plan, runner, and target identities, changed source content, and preserved baseline evidence.

An independent todo application uses the same runner with different requirements and selectors: its normal version passes; its deliberately defective version fails completion-state persistence. Both examples are self-contained HTML applications with seeded demo defects. They do not establish support for arbitrary websites.

Ming separates interpretation from execution. Its configurable model adapter can propose a plan, but browser assertions determine the result. The recorded demonstration uses clearly labeled, hand-authored plans; live provider configuration and model-quality evaluation remain pending. The public-viewer mode provides read-only access to reviewed historical evidence, while the local application performs execution and repair handoff.

Ming's value is the traceable connection between what was requested, what the application actually did, and what the next development step needs to fix.
