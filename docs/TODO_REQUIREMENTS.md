# Focus: independent todo acceptance sample

Focus is a small, self-contained browser application used to demonstrate that Ming's browser runner can execute a second product's requirements and selectors. It has different markup, accessible labels, and interactions from the daily-report sample. The same generic runner executes both applications.

## Product requirements

- **R1:** Adding a non-empty task displays that task in **Your tasks**.
- **R2:** Marking a task complete visibly identifies that same task as **Completed**.
- **R3:** Refreshing the browser preserves both task text and its completion state.

For this fixture, each run starts in a fresh browser context. A unique task name identifies the data created by that run. Completion and refresh checks inherit the context from the previous successful criterion. If a prerequisite fails, its dependent criteria must be blocked rather than silently recreated in another context.

## Samples and provenance

| Variant | Source | Intended behavior |
| --- | --- | --- |
| `todo-normal` | `examples/todo/normal/index.html` | Persist task creation and completion. All three criteria should pass. |
| `todo-buggy` | `examples/todo/buggy/index.html` | Persist task creation, but deliberately omit saving completion changes. TODO-01 and TODO-02 should pass; TODO-03 should fail after reload. |

`fixtures/todo-plan.json` is a **hand-authored development fixture**, not a model-generated plan. It uses the existing runner actions without adding task-specific behavior to the runner. The fixture is a second integration example, not evidence of support for every website or of reliable model generation.

The sample footer identifies its normal or defective variant. Both are ordinary local task interfaces; neither fabricates acceptance results. The defective sample intentionally omits `saveTasks()` inside the completion handler. Its creation handler still saves tasks, so the defect concerns the completion state specifically.

## Expected evidence

An actual run must capture the created task, its visible completed state, and the state after a real browser reload. For the defective sample, a failure should refer to TODO-03 and its requirement, retain the task text as evidence, and never substitute the normal variant to claim a repair. Repairing `todo-buggy` requires editing that same source file and rerunning the same plan against the same target identity.

This document describes expected outcomes. Recorded execution evidence and results are stored separately after browser verification.
