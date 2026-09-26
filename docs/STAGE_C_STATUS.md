# Stage C checkpoint — incomplete

Recorded by Codex, 2026-09-26. Bob task `df9086562f51a115ee3a91b661b0e968` stopped at 14:43 Beijing with `TrialExpiredError / Budget Exceeded`. Its IDE summary shows 10.12 Bobcoins. No paid upgrade or overage was enabled by Codex.

Bob implemented repair-task contracts and HTTP routes, an official-SDK STDIO MCP adapter, project-scoped `.bob/mcp.json`, and runner fingerprint recording. The frontend only has preparatory imports/types; its repair panel is not implemented. The self-contained HTML snapshot fields were added to contracts, but navigation still uses the live target. See the 14:41 recheck in `docs/STAGE_C_CORE_REVIEW.md` for unresolved source-version, shared comparison predicate and confirmation-integrity requirements.

## Independent checks after the interruption

- Runner/server build passed; MCP build passed. These are compilation results, not full acceptance.
- Whole-workspace typecheck failed in `apps/web/src/App.tsx`: unused `RepairTaskRecord` and `RepairComparison` imports from the interrupted UI implementation. Codex has not silently completed that core implementation.
- `scripts/review-repair-api.mjs` ran against a temporary, owned local server: **49 passed, 0 failed**. It created genuine browser runs through the API, checked duplicate creation/claims and a stale source-fingerprint rejection, then reran the unchanged buggy target. Persistence still failed and `verifiedRepair` stayed false. Original baseline bytes and target source were unchanged. The owned server was stopped afterward.
- Baseline: `143b3dd0-6a4e-4c5e-b34b-033e27a06e3b`; repair task: `5aeb0cce-5983-4f10-862d-fc20860c41eb`; rerun: `05d83486-6b93-4b3b-9927-8b00df6cda68`. Owner explicitly identifies Codex independent API testing, not Bob.
- Report: `runtime/review-repair-api-2026-09-26T09-24-54-471Z-cab7e0b0.json`. This check does not cover or close the remaining review findings.
- After compiling the adapter, Codex restarted the configured MCP server through Bob Settings. The actual Bob IDE displayed **Connected**, version 0.1.0, and discovered its tools. Screenshot: `bob_sessions/ming_mcp_connected_tools.png`. No AI prompt, paid upgrade, or Bob tool execution was performed during this connection check.

## Required next work

Finish the three focused core-review gaps and the minimal repair UI; rerun relevant verification; then record a fresh baseline, have an authorized coding agent retrieve/claim its evidence, actually edit the same buggy source, rerun the same confirmed plan, and verify comparable results. A genuine Bob repair demonstration still requires available Bob account quota. Do not present the present API test or Connected screenshot as that demonstration.

Stage D visual work, second-project proof, live external model validation, deployment and final submission materials also remain. The complete project is not finished.

## Codex takeover and core verification — 2026-09-26, 17:40 Beijing

The checkpoint above is historical. The user subsequently explicitly authorized Codex to complete the remaining implementation. No further Bob AI request, paid upgrade, or live model call was used for the following work. Bob retains attribution for the initial Stage C scaffold; these additions are Codex's work.

All three focused core-review findings now have implementations and focused verification:

- Every browser context intercepts the registered self-contained HTML document and its reloads using the exact captured HTML, whose hash is checked again inside the runner. Runs retain the exact plan snapshot and source-binding marker. A directory watcher and a final file-hash comparison detect writes/atomic saves during execution. This freezes only the HTML document; it does **not** claim to freeze arbitrary external assets, APIs, or remotely deployed applications.
- Task completion and the comparison endpoint call the same strict comparison function. Verified repair requires a genuine baseline assertion failure, the complete criterion/step identities, a fully passed terminal rerun, matching known plan/runner/target identities, changed and correctly bound source fingerprints, and no source-change or fatal-error blocker. Missing provenance and infrastructure-only recovery cannot become a verified repair.
- Confirmation integrity is recomputed from plan content. Confirmation, original draft, requirement text/identity, project and target bindings must agree before execution and repair. Fixture baselines remain an explicitly separate path, with their own recorded plan snapshot. Two unsuccessful repair reruns now end in `blocked`; attempt run IDs remain available.

Additional integration work: local target registration is loaded from `fixtures/targets.json`; `GET /api/plan?variant=...` selects the registered fixture without app-specific runner code. `PORT`, `HOST`, and an isolated runtime directory are supported. The server can serve the built UI and exposes a read-only public evidence mode (`MING_PUBLIC_DEMO=1`), which rejects mutation requests instead of pretending to execute new acceptance runs.

Validation actually executed:

- `pnpm --filter @ming/server... run build`: passed.
- `node scripts/review-repair-integrity.mjs`: **32 checks passed, exit 0**. This uses its own copied HTML, registry, and runtime on port 4411. It verifies real browser baseline/rerun success and consistent task/comparison results; all-context snapshot execution while the disk source changes; tampered plan and record linkage rejection; incomplete results, unknown runner, infrastructure-only baseline and source-change rejection; and the two-attempt stop. Adversarial records exist only inside that isolated test directory. The success case mechanically replaces an isolated broken fixture with the known-good fixture; it is an integrity test, **not** the actual coding-agent repair demonstration.
- Integrity report: `runtime/integrity-13886cad-33fd-4663-8122-55e7bd9119b4/review-report.json`, started 09:38:43 UTC and finished 09:38:51 UTC. The owned server was stopped afterward.
- Existing Stage A three-run regression was executed through a temporary copy with only port 4412 and the evidence filename adjusted. Normal target passed AC-01/02/03; both fresh buggy runs passed AC-01/03 and failed AC-02 as expected. Exit 0. Evidence: `runtime/review-stage-a-after-integrity.json`; log: `runtime/review-stage-a-after-integrity.log`. No example source was changed by that regression; its owned server was stopped.

The genuine coding-agent MCP repair demonstration, final visual UI, public evidence package and submission assets are handled separately. These core checks do not establish a live external model invocation, Bob's participation in the later repair, or resolved hackathon account eligibility.

### Additional regression and local API boundary review

The existing Stage B route/contract suite was executed through a temporary script copy on port 4414, with an isolated runtime and empty provider environment configuration: **79 checks passed, exit 0**. Log: `runtime/review-stage-b-after-integrity.log`. The suite uses a local test transport, not a live model. Its minimal `assertVisible("日报")` fixture matches several elements and ends with a browser execution error; the suite checks terminal completion and confirmation/requirement linkage, so these 79 results must not be described as a successful product acceptance run. The separate 32-check integrity suite above uses precise selectors and verifies real browser outcomes. No Stage B linkage regression was found.

The local API previously granted arbitrary browser origins CORS access. Codex restricted local browser callers to HTTP loopback origins on the Ming UI port 4000 or the configured server port. Local API requests also require a loopback Host header; hostile/opaque origins and cross-site resource requests are rejected. Requests from local CLI/MCP clients without an Origin header continue to work. Public evidence mode remains readable and rejects mutations and new browser inspections.

`node scripts/review-repair-integrity-origin.mjs`: **12 checks passed, exit 0**. It verifies CLI/MCP access, same-process UI, Vite preflight, hostile preflight/direct requests, opaque origins, unexpected ports, cross-site resource requests, a DNS-rebinding Host header, and public read-only behavior. Report: `runtime/review-origin-boundary.json`. Both owned test servers on port 4415 were stopped. Runner code and its fingerprint were unchanged by this additional server-only work.
