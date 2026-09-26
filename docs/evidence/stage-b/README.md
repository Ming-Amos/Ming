# Stage B browser evidence

Captured 2026-09-26 by the actual Playwright webpage review, then copied unchanged from the local runtime directory by Codex. These images document **local test-transport plan generation and real browser execution**, not a live external model call or an automated repair.

- `first-run-evidence.png`: the first run's real screenshot opened inside Ming; the test checked image loading and ownership by run ID.
- `confirmed-plan-rerun.png`: the webpage displays the second run after clicking the same execution control, without confirming a new plan.

First run: `cf5e5b5a-0620-4ad1-9b06-c3f0c60b75aa`. Rerun: `dcc4d971-8066-47c8-bf6f-1323fd369392`. Both used confirmation `2c20dbec-d2ea-4c35-8ee8-3298e656509a` and plan fingerprint `aa4979d12bab2cba`; all three normal-target criteria passed. This is a rerun, not a repair comparison.

Original folder: `runtime/screenshots/stage-b-ui-2026-09-26T06-26-06/`. Verification script: `scripts/run-stage-b-ui-tests.mjs` (39 assertions passed). The yellow provider banner is expected: no real provider credentials were configured. See `docs/STAGE_B_RESULTS.md` for scope and contribution attribution.
