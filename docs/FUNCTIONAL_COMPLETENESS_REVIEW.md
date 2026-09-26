# Functional completeness review

Reviewed 2026-09-26 against the agreed product purpose: reduce repeated manual clicking, screenshots and failure explanations while an AI coding agent develops a web application. This review used the original PRD/development plan, implementation inspection, deliberately reproduced failures and isolated real-browser regression runs. It is broader than the previous visual review.

**Assessment:** the supported local-web acceptance and repair-handoff workflow is implemented and usable. It is not an unrestricted autonomous tester for every project. A real external model's plan-generation quality, actual Bob runtime repair integration, and remote browser execution are not established by this review. No Bobcoins or external paid-model calls were used.

**Later live sample update:** `/#trial` now executes a controlled same-origin Shipboard sample in the visitor's own browser, with fresh DOM assertions, DOM-rendered snapshots and prepared-fix comparison. Final browser UI review passed **40/40**, engine **10/10**, and boundary checks **5/5**. This adds a real interactive online trial; it does not establish hosted browser execution for arbitrary projects or live AI-generated repairs. [Scope and evidence boundary](LIVE_TRIAL.md).

## Capability matrix

| User need | Implementation and verified scope | Remaining boundary |
| --- | --- | --- |
| Connect an existing or newly developed app once | Saved local URL/self-contained HTML project, requirements and source association; independent multi-file apps exercised | App must already run. Native desktop apps, mini programs, complex login, public URLs and cross-origin dependencies are outside this version. |
| Turn requirements into acceptance checks | PRD upload/save/versioning, 15-action visual editor, import, revision and human confirmation; manual plans execute real checks | External model adapter exists and is fixture-tested, but no real provider key or generation-quality test has been supplied. |
| Check each completed feature again | Reuse a current confirmed standard from the UI or the 12-tool MCP adapter; invalidated standards cannot silently execute | The coding agent must be connected and instructed to call Ming. There is no automatic file watcher or ability to wake another editor. |
| See what actually happened | Recorded steps, expected/observed values, original screenshots, real console/page/network diagnostics, progress, history and export | Passing means the registered criteria passed. It does not prove exhaustive feature coverage or subjective design quality. |
| Preserve evidence if work stops | Cancellation, interrupted-run recovery, completed-step/criterion preservation, immutable historical runs | Already executed application mutations are not undone by cancellation. |
| Return a failure to the coding AI | Evidence-backed task, claim, original plan and reproduction details, late-failure-aware MCP evidence with truncation disclosure | A task alone does not perform or falsely claim a repair. The connected coding agent needs its own authorized editing tools. |
| Verify the repair fairly | Same-standard rerun, bounded repair attempts, source/runner/target checks, original and follow-up evidence | Strict source-bound verification applies to captured self-contained HTML; live app reruns remain observed acceptance requiring review. |
| Let judges inspect the product online | Fresh in-browser Shipboard trial plus English recorded Evidence Studio | The trial operates only on its bundled sample; DOM renders differ from native browser screenshots. Hosted preview remains private pending access review. Own projects run through local Ming. |

## Reproduced defects fixed in this review

1. **Old PRD cache masked a newer saved requirement.** Unsaved text is now scoped to its requirement version and cleared after saving. A current server version is no longer replaced by stale browser text.
2. **Legal empty values could not be tested in the editor.** Empty input assertions and empty select-option values can now be saved and executed; explanatory help distinguishes these from missing content.
3. **Plan imports rejected valid prerequisite text.** Import matches the shared contract and strips server-owned plan identity fields before creating a new editable draft.
4. **Ctrl+K discarded an open editor.** The global command shortcut preserves open editors and in-flight dialogs.
5. **MCP omitted late failures.** A supported 24-step real browser check failed at the final step, but the previous 20-step summary hid that failure. Summaries now prioritize failures and screenshots, preserve useful setup/context, disclose omitted counts, and include real diagnostics and source scope. Passing runs are directed to the general run reader.
6. **Screenshot names collided across criteria.** Two different failures with the same step ID could reference a later overwritten image. Screenshot identities now include both criterion and step, with unambiguous separators.
7. **Cancellation lost completed work.** A stop between steps now retains already observed actions and marks the unfinished portion appropriately.
8. **Progress identified the previous criterion.** It now identifies the active criterion and persists each finished step/criterion.
9. **Restart discarded partial evidence.** Completed results and original screenshot references survive interruption; unfinished work is marked interrupted rather than passed.
10. **The standard test command failed on Windows.** It tried to execute a shell shim as JavaScript. The command now builds first and runs the actual MCP, runner, provider and Worker checks through cross-platform entry points.
11. **Live observations were invisible until the whole run finished.** The workspace now polls the actual partial record and progress without changing the user's selected step. Replay includes only executed actions/observations and waits until execution finishes; pending and skipped steps are not counted as performed actions.
12. **A Windows file lock could fail a run before its first browser action.** JSON replacements now use exclusive temporary files and bounded retries for sharing violations, preserving the previous record on failure. If the final write remains impossible, the server stays available and explicitly identifies the terminal result as unsaved and temporary; it does not claim durable success.

These were actual pre-fix failures, not speculative findings. [UI reproduction](evidence/functional-review/ui-before.json), [API/lifecycle reproduction](evidence/functional-review/api-before.json) and [late MCP failure](evidence/functional-review/mcp-before.json) are preserved alongside the post-fix reports.

## Current validation

- `pnpm test`: full build and **54 checks passed** — 21 actual-SDK MCP/report, 13 runner, 13 local-provider-fixture and 7 Worker tests.
- The later Windows storage fix passed **14/14 durability checks**, including an actual external sharing lock, 150 rapid replacements with a concurrent reader, preservation of prior evidence on failure, and an explicit unsaved terminal error without crashing the server. This suite is now included in the standard server test. See [storage report](evidence/functional-review/storage-durability.json) and [original failed run](evidence/functional-review/windows-write-before.json).
- Local target lifecycle: **36/36**; repair verification integrity: **32/32**; new screenshot/progress/cancel/restart regressions: **17/17**.
- Final own-project browser workflow: **32/32**, after the Windows durability fix; no browser exceptions. Editor and live-progress regressions: **17/17**. Final English Evidence Studio/compiled viewer: **50/50**, with no browser exceptions, external requests or mutation requests.
- Reports: [MCP](evidence/functional-review/mcp-after.json), [runner](evidence/functional-review/runner.json), [local targets](evidence/functional-review/local-targets.json), [repair integrity](evidence/functional-review/repair-integrity.json), [new API checks](evidence/functional-review/api-after.json), [own-project UI](evidence/functional-review/own-project-ui.json), [editor checks](evidence/functional-review/ui-after.json).
- Live evidence: [before-fix UI report](evidence/functional-review/live-ui-before.json), [recorded observations while running](evidence/functional-review/live-recorded-actions.png), [original capture while another criterion runs](evidence/functional-review/live-captured-evidence.png), and [50-check compiled viewer report](evidence/functional-review/evidence-studio.json).

All scenarios use isolated temporary applications and runtime folders. Original Bob records and both preserved judge-evidence bundles are not rewritten. New runner code has a new implementation fingerprint; historical comparisons retain the runner identities recorded when those runs occurred.

Release verification: the updated local service is running at `http://127.0.0.1:4001`; the existing owner-private online viewer is version 4. Authenticated production checks confirmed the reviewed frontend, read-only mode and original baseline evidence. No sharing permissions changed.

## Still required for a complete competition demonstration

Configure the selected provider locally and complete an actual generate → human review → browser execution flow before claiming live AI plan-generation quality. The Codex MCP repair is proven; an actual Bob runtime repair remains unverified and must not be inferred from Bob's genuine earlier implementation work. Update the video/deck for the current product, make approved links accessible to judges, and complete the submission separately. The online deployment is a recorded viewer, not a remote execution backend.

For repeatable local checks: `pnpm test`, then `pnpm test:integration` and `pnpm test:ui`. These checks are bounded evidence about the supported workflows; they do not establish that every possible application or edge case is supported.
