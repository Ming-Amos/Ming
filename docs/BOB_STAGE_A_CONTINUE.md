# Continue Ming Stage A in the correct workspace

This is a continuation, not a rewrite. The Bob workspace must be `C:\Bob\Projects\Ming`.

Read `BOB_START_HERE.md` and `docs/MING_PRD.md`, then inspect the existing implementation and complete Stage A only. The previous Bob task (`6fbf911e3cfc7536758d59aec3e9fe17`) generated partial foundation files, contracts, the healthy and intentionally buggy toy applications, a fixed acceptance plan, a runner and server. Its web implementation command was cancelled. Audit what actually exists before continuing; do not assume any part was validated.

We stopped that task because it was attached to the user's unrelated daily-report workspace. Do not reopen or inspect that project. Do not bypass workspace restrictions with terminal writes or disable the workspace sandbox. Work only in this Ming workspace, preserving existing documentation and genuine evidence. The first task's actual summary screenshot and measured consumption (1.29 Bobcoins) are already saved in `bob_sessions/`.

Complete implementation and meaningful validation, including:

- Use one unchanged fixture plan for both targets; target configuration is separate and included in its fingerprint. Never preset the result based on target name.
- Healthy target: AC-01/02/03 pass. Buggy target: AC-02 fails after refresh; AC-01/03 pass. Repeat the buggy run with fresh isolated data and retain history.
- Preserve dependencies, separate the empty/whitespace scenario, and distinguish business failure, execution error, blocked and not-run. Unreachable targets must not appear as passed.
- Real Playwright execution and screenshots, traceable to each run and step. Verify the actual Ming web UI, not only its API. Keep the interface simple and honest about using a fixture without a connected model.
- Validate restricted plans and require confirmation. Report actual progress, retaining run IDs, expected/observed values, plan and target fingerprints, and evidence paths.
- Install project dependencies as needed, run relevant checks/builds, and correct problems. No external model API, MCP, deployment, account changes, real database, or global environment changes in this stage.
- Inspect any text encoding issues in previously generated files. Preserve UTF-8.
- Update README and create `docs/STAGE_A_RESULT.md` with actual commands, URLs, run IDs, results, evidence, and remaining limitations. Initialize Git only inside Ming if absent; make a local commit, do not push. Attribute the initial planning documents to user/Codex and implementation to the actual Bob work.
- Stop at the completed Stage A review point. Do not continue to later stages. Report in Chinese, with precise evidence and any blockers. The operator will capture the genuine Bob task session consumption summary from the IDE.

The user has authorized ordinary reversible local development and validation. Continue autonomously without repeated routine questions. The personal Trial is working; competition eligibility is still awaiting the organizer. Do not claim that this has been approved or that the event enterprise account is active.
