# Reviewed real demonstration evidence

These are selected, unaltered local execution records and screenshots. They use
hand-authored fixture plans, not live LLM-generated plans. The defects were
intentionally seeded demonstration defects. This folder is safe sample data
prepared for an openly accessible viewer; it does not contain the user's real
daily-report project or its database.

## Actual repair

- Baseline: `65aece9c-b145-4045-8096-60331a4c6ae1`, AC-02 failed after reload.
- Task: `7ed27f84-aa14-43f8-90e2-f84702dc21b0`.
- Actor: **Codex via real stdio MCP**, after Bob's personal trial was exhausted.
- Rerun: `2cf3cc33-507f-41c2-8b9f-6a16c712a7ae`, all three criteria passed.
- Same target: `repair-demo` at the same logical URL.
- Same plan: `660582f7fbabccc5`; same runner: `b3ad939dcb5d51b5`.
- Source changed: `4d61d95b3ffbc28d` to `29ebdc69fb588289`.
- API comparison: `verifiedRepair: true`, no blockers, no new failures.

`repair-process/` contains the real SDK tool responses, exact HTML before and
after repair, and the source diff. Codex changed in-memory persistence to
localStorage. It did not switch to the known-good sample or weaken the plan.
The original `buggy` sample stays defective for repeatable detection demos.

## Cross-project checks

The normal daily-report sample passed all three criteria. Its defective version
failed AC-02 only. The independent Focus todo sample passed all three checks;
its defective version failed TODO-03 only, because completion did not persist.
Both used the same runner fingerprint. Full selected IDs and file SHA-256
digests are in `manifest.json`.

`api-responses.json` contains the selected real GET responses for an explicitly
read-only public viewer. Serving these responses is history exploration, not a
new test or remote agent execution. Local execution remains available in the
full application.
