# Ming delivery status

Checkpoint: 2026-09-26. The current presentation is the English **Evidence Studio**, with new Shipboard execution evidence. This checklist separates implementation, recorded proof, earlier validation, and work still awaiting review. No automatic competition submission or public publication has occurred.

**Live online sample update:** Start now opens `/#trial`. Visitors can execute 16 fresh DOM actions/assertions on the bundled Shipboard sample, inspect current captures, copy the actual failure brief, apply a prepared sample fix, rerun the same standard, compare both results, and export JSON. This runs in the visitor's browser; images are explicitly DOM-rendered snapshots, and the prepared fix is not described as a live AI repair. No hosted Chromium, personal-computer relay, Bob or external model is used. Own-project execution remains local. [Scope](LIVE_TRIAL.md).

**Live sample validation:** final compiled UI **40/40** across eight real runs, isolated engine **10/10**, load/storage/cancellation boundaries **5/5**, recorded Studio **55/55**, Worker **8/8**; type checking and production build passed. A counterfactual test disabled the real submit button and changed the outcome to creation failure with reload unchecked. DOM capture task rows are visible without nested scrolling. Frontend: `index-BTynln7k.js`. [Final UI report](evidence/live-trial/2026-09-26T14-33-39-458Z-c853317e/report.json), [engine](evidence/live-trial/engine-report.json), [boundaries](evidence/live-trial/engine-boundary-report.json), [recorded regression](evidence/live-trial/recorded-studio-report.json). Older publication entries below describe their own checkpoints.

**Welcome-page update:** the app root now opens the user's selected original pixel-art scene with **Start**, then enters `/#studio`. Final compiled Studio **54/54**, welcome/navigation/accessibility **13/13**, and own-project workflow **32/32** passed. The original background animation is preserved and can be paused. Current frontend: `index-ChhqwjQZ.js`. This entry is owned by Ming and does not modify or bypass the hosting platform's private login gate. [Visual review](../design-qa.md) · [validation](evidence/welcome-page/compiled-studio.json).

**Latest private publication:** version **5** deployed successfully at **2026-09-26 13:54 UTC**, from application commit `73347267e97c684bde82c98ec21e804282e390d1`; deployment `appgdep_6ab7ce82c6b48191942c8c9977db9bfb`. An authenticated production browser verified the Start cover, exact original animation bytes, transition to recorded evidence and no browser exceptions (**5/5**). Both GitHub and the Site remain private. [Production report](evidence/welcome-page/production-report.json). Version-4 details below are the preceding functional-audit checkpoint.

**Latest functional audit:** [FUNCTIONAL_COMPLETENESS_REVIEW](FUNCTIONAL_COMPLETENESS_REVIEW.md) records 12 reproduced defects and fixes, including Windows storage locks, live evidence, interruption recovery, screenshot identity, editor/import state and late failures in AI handoffs. Final own-project UI **32/32**, editor/live UI **17/17**, lifecycle **17/17**, storage durability **14/14**, and compiled viewer **50/50** passed. Type checking and build passed; the local launcher serves `index-BIVHrbt9.js`. This audit used no Bob or commercial model calls. The version-3 details below remain a historical publication checkpoint.

**Current private release:** version **4** deployed successfully at **2026-09-26 12:08 UTC**, from application commit `8f6b8d9261d9ec75931755b6c6a69551d1aac4c0`. Deployment: `appgdep_6ab7b5989d2c8191a2ba9f75a000d3e0`. Authenticated production verification confirmed the latest frontend, read-only behavior and original featured baseline. The existing site remains owner-private. Source review checked **298 candidate files**, all **60 preserved evidence hashes** and unchanged Bob records, with no findings. Later documentation-only commits record this outcome.

Still needed for the current submission: record a current-interface video and refresh the deck, user approval for public repository/site access, organizer confirmation of account eligibility, and the final submission review. An external model key and a real generation/review/run are also needed if the entry will claim demonstrated live plan generation; manual acceptance already works without one.

## Updated local product

- [x] Register a running local development URL or self-contained HTML file; optionally associate a source directory.
- [x] Persist projects, requirements, plan revisions and human confirmations; keep historical records separate from current approval.
- [x] Manual editor for 15 browser actions/assertions; revised generated plans are identified as manual revisions.
- [x] Confirmed acceptance execution, progress, cancellation, history, failed-run handoff and JSON/Markdown/HTML exports.
- [x] Local provider settings: save/replace/delete key, explicit environment precedence, activation without restart, no request on save/start.
- [x] Explicit bounded connection test and actual token-usage ledger. No external model key has been configured; no live model quality claim.
- [x] Extend stdio MCP to 12 tools for discovery, confirmed execution, progress/cancellation, repair and comparison.
- [x] Implement the English Evidence Studio: recorded-step scrubber with Play/Pause, evidence focus, Ctrl+K command menu, and a before/after slider showing original captures. Playback navigates stored evidence; it is not a new execution or generated video.
- [x] Add English Shipboard working/defective/repair-workspace examples and the three-criterion plan. Default fixture: `shipboard-buggy`.
- [x] Record a new real source repair through actual stdio MCP: **21/21 evidence checks passed**, all three rerun criteria passed, `verifiedRepair: true`, and no blockers. Original plan, runner and target identities match; old evidence remains byte-identical.
- [x] Visually inspect actual Shipboard before/after and validation screenshots. Separate 390px app check confirms persistence after reload, English text, no overflow and no browser errors.
- [x] Current English own-project workflow: **32/32 browser checks passed**, with no browser exceptions.
- [x] Current Evidence Studio and compiled read-only viewer: **50/50 checks passed**, including playback, focus, keyboard commands, direct comparison-slider interaction, original-image identity and 390px layout. [Final report](evidence/functional-review/evidence-studio.json).
- [x] Full type checking and production build passed. **7 Worker unit tests** passed. Current frontend bundle: `index-BIVHrbt9.js`.
- [x] Bounded publication review: **270 candidate files**, **60 evidence hashes** (26 legacy + 34 new), unchanged Bob files and no findings.
- [x] Updated the existing owner-private Sites preview to English Evidence Studio **version 3**, with deployment status **succeeded** at 2026-09-26 11:31 UTC. Source: `a25103de008777601c08bcac80b46f29e483ce19`; deployment: `appgdep_6ab7ad01c1dc8191b1627324e4b96ad8`. This source checkpoint includes the reviewed application, 20-route bundle and 12 original screenshots. Later documentation-only changes record the release outcome.

## Earlier English visual-release verification

- **47/47 Evidence Studio and compiled read-only checks:** original evidence, recorded-step playback, focus, command navigation, mouse and keyboard image comparison, project/history navigation and 390px layouts. No browser errors, missing resources, external requests or mutation requests; reviewed text contrast is at least 4.5:1. Report and captured screens: [English Studio review](evidence/english-studio/review-report.json), [desktop baseline](evidence/english-studio/01-featured-baseline.png), [repair comparison](evidence/english-studio/03-repair-comparison.png), [mobile workspace](evidence/english-studio/05-mobile-workspace.png).
- **32/32 own-project browser checks:** registration, Markdown PRD upload, model-missing fallback, manual plans, confirmation, real runs, immutable revisions, history, reload recovery, cancellation and 390px layout. No browser exceptions. Report: [English own-project review](evidence/english-product-ui/review-report.json).
- **36/36 backend integration:** report `runtime/real-targets-95e47b77-1632-4afd-bd23-c4096f3aae51/review-report.json`.
- **13/13 runner:** report `runtime/product-runner-3f86148a-672c-4d8d-bf70-0fb9ee9326c4/report.json`.
- **16/16 actual-SDK MCP/report:** report `runtime/product-mcp-85a66e10-862b-444d-8994-edce3ca1c49b/review-report.json`.
- Fresh English **13/13 provider** and **32/32 repair-integrity** suites also passed.

These fresh checks used no Bob calls or external model provider. A successful live-URL rerun remains acceptance evidence requiring review, with `verifiedRepair: false`; only the captured-document path can satisfy strict source-bound repair verification. These results do not establish an external model's generation quality.

The earlier **27/27 compiled read-only review** describes its prior build, `index-CtFySXMn.js`. The current presentation is covered by the fresh 47-check review above. Selected current UI reports and captures are copied under `docs/evidence/`; other reports under `runtime/` remain local.

## Current English judge evidence

- Bundle: [judge-evidence/README.md](judge-evidence/README.md), [manifest](judge-evidence/manifest.json), and [21-check report](judge-evidence/review-report.json).
- Target: `shipboard-repair`; task: `bbc50e50-7838-4bec-8a2b-4ec386d98679`.
- Baseline: `33f7bcfb-5ffc-4c9c-bf6b-eb76cd6cef4c`; only SHIP-02 persistence failed.
- Rerun: `74ed3133-b62c-44cf-8b4a-042156180db5`; all three criteria passed.
- Unchanged plan: `9c1f3dcf7fd3f279`; unchanged runner: `0f4cf2cc5fc32e24`.
- Source: `c1775e6bfbafc41d` → `8426ca024fd0f7c4`; the same target executed its captured HTML snapshot. Strict comparison: `verifiedRepair: true`, no blockers.
- Four real runs, original screenshots, exact source diff, actual MCP responses, and SHA-256 manifest. Actor: **Codex via real stdio MCP**, with no Bob or model calls.
- `MING_PUBLIC_DEMO=1` startup and the read-only package use `docs/judge-evidence`. This changes which historical records are presented; it does not make the site a remote execution service.

## Preserved earlier evidence and materials

- [x] Genuine Bob task summaries retained in `bob_sessions/`. Bob built the initial core and partial repair foundations; Codex completed and extended the product after Bob's trial quota ended.
- [x] Real prior Codex source repair through stdio MCP, with unchanged acceptance standard and a successful strict comparison.
- [x] Reviewed demo bundle: six selected runs, 19 screenshots, source diff and manifest hashes. Original evidence was not rewritten for the new interface.
- [x] Earlier Application X-ray checkpoint: 43 UI integration checks and 10 read-only viewer checks passed. These counts describe that checkpoint, not the updated interface.
- [x] Existing concept cover, five-slide PDF, English statements and 164-second narrated video are present.
- [x] Existing video/deck and historical captures are clearly identified as the **previous prototype checkpoint**. They can remain as historical artifacts.
- [ ] Record a new video and refresh the presentation for the current English Evidence Studio and Shipboard demonstration. This remains required for an up-to-date presentation, although it does not block local product use.
- [x] Updated source review checked 212 candidate files, all 26 original evidence hashes and unchanged Bob files. Final local startup and AI-connection panel passed browser smoke checks.

Recorded repair: task `7ed27f84-aa14-43f8-90e2-f84702dc21b0`; baseline `65aece9c-b145-4045-8096-60331a4c6ae1`; rerun `2cf3cc33-507f-41c2-8b9f-6a16c712a7ae`. Its plan/runner identities match, source changes from `4d61d95b3ffbc28d` to `29ebdc69fb588289`, all three rerun criteria pass, and `verifiedRepair` is true. See [the manifest](demo-evidence/manifest.json).

## Before public sharing or submission

- [x] GitHub repository exists at https://github.com/Ming-Amos/Ming — **private**.
- [x] Sites preview exists at https://ming-acceptance-proof.amosming.chatgpt.site — **owner-private**, historical read-only evidence.
- [ ] Obtain final user review before changing either audience to public. Then verify signed-out access; a private URL is not a usable public judging link.
- [x] The new English read-only package passed its own 47-check review and bounded publication review. It presents reviewed Shipboard records and original captures; provider settings, keys and unreviewed runtime data are excluded. The same package is deployed privately as recorded above. All 17 evidence API responses and 12 served PNG hashes match the reviewed source; 3 hosted metadata endpoints deliberately enforce read-only settings.
- [ ] Obtain organizer confirmation of the account's event eligibility.
- [ ] If claiming live AI-generated plans, configure the user's chosen provider locally and perform an actual generation, human review and browser acceptance run.
- [ ] Review final statements, media, repository and application URL, then submit through the official event form before its deadline.

See [local onboarding](../README.md), [中文使用说明](../交付说明.md), and [AI connection](AI_CONNECTION.md). Historical PRD and stage reports remain dated development records.
