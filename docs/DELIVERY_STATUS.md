# Ming delivery status

Checkpoint: 2026-09-26. This checklist distinguishes the updated local product from its earlier recorded prototype. No automatic competition submission or public publication has occurred.

## Updated local product

- [x] Register a running local development URL or self-contained HTML file; optionally associate a source directory.
- [x] Persist projects, requirements, plan revisions and human confirmations; keep historical records separate from current approval.
- [x] Manual editor for 15 browser actions/assertions; revised generated plans are identified as manual revisions.
- [x] Confirmed acceptance execution, progress, cancellation, history, failed-run handoff and JSON/Markdown/HTML exports.
- [x] Local provider settings: save/replace/delete key, explicit environment precedence, activation without restart, no request on save/start.
- [x] Explicit bounded connection test and actual token-usage ledger. No external model key has been configured; no live model quality claim.
- [x] Extend stdio MCP to 12 tools for discovery, confirmed execution, progress/cancellation, repair and comparison.
- [x] Provider suite: **13/13 passed**, including key retention/deletion, environment fallback, fresh-process persistence, atomic-write failure, response bounds, 10-second timeout and public-mode isolation.
- [x] ProviderSettings real-browser smoke: save/test/reopen/delete/read-only checks passed against a local HTTP fixture; no key readback or automatic model requests.
- [x] Backend integration: **36/36 passed**, including the live-URL review state and a responsive GET while reachability probing continues (16 ms in that check).
- [x] Runner checks: **13/13 passed** for its reported scope.
- [x] Final full-repository typecheck and build passed.
- [x] Updated own-project browser UI: **32/32 passed**, including restoring an in-flight run after reload and cancellation. See [PRODUCT_UI_REVIEW](PRODUCT_UI_REVIEW.md).
- [x] Latest compiled read-only viewer: **27/27 passed**. Exact baseline/rerun/comparison responses and all 19 screenshot hashes match the preserved bundle; history search/switch/reload, JSON export, read-only model/AI help, 390px layout and write rejection passed with no frontend JavaScript errors. Desktop and mobile captures were visually reviewed.
- [x] Actual-SDK MCP/report suite: **16/16 passed** across the expanded 12-tool workflow. A passing live-URL rerun remains “复验通过 · 待确认” with `verifiedRepair: false`.

These scoped tests do not establish compatibility or quality for an external model. Running local apps are observed live; only self-contained HTML is bound to the exact captured source snapshot. HTTP target redirects and cross-origin requests are blocked; separate backend services need a same-origin development proxy.

Local reports: `runtime/real-targets-047c1b1c-db4a-4cd2-9c44-af7e4e78423e/review-report.json` (backend), `runtime/product-runner-77b8c790-57f1-49b0-a9bf-91a8d28164ea/report.json` (runner), `runtime/product-mcp-15cad0a2-c4aa-4501-b9f8-223ab7294a12/review-report.json` (MCP/report), and `runtime/public-ui-15576ca0-9d23-402d-b54a-3526f8867f64/report.json` (compiled read-only viewer, with screenshots alongside). Runtime files remain local and are not automatically published. The compiled UI reviews used `index-CtFySXMn.js`; the final build's AI-help button-class adjustment is cosmetic.

## Preserved earlier evidence and materials

- [x] Genuine Bob task summaries retained in `bob_sessions/`. Bob built the initial core and partial repair foundations; Codex completed and extended the product after Bob's trial quota ended.
- [x] Real prior Codex source repair through stdio MCP, with unchanged acceptance standard and a successful strict comparison.
- [x] Reviewed demo bundle: six selected runs, 19 screenshots, source diff and manifest hashes. Original evidence was not rewritten for the new interface.
- [x] Earlier Application X-ray checkpoint: 43 UI integration checks and 10 read-only viewer checks passed. These counts describe that checkpoint, not the updated interface.
- [x] Existing concept cover, five-slide PDF, English statements and 164-second narrated video are present.
- [x] Existing video/deck and historical captures are clearly identified as the **previous prototype checkpoint** in current onboarding. A future recording of the expanded interface is optional and does not block local product use.
- [x] Updated source review checked 212 candidate files, all 26 original evidence hashes and unchanged Bob files. Final local startup and AI-connection panel passed browser smoke checks.

Recorded repair: task `7ed27f84-aa14-43f8-90e2-f84702dc21b0`; baseline `65aece9c-b145-4045-8096-60331a4c6ae1`; rerun `2cf3cc33-507f-41c2-8b9f-6a16c712a7ae`. Its plan/runner identities match, source changes from `4d61d95b3ffbc28d` to `29ebdc69fb588289`, all three rerun criteria pass, and `verifiedRepair` is true. See [the manifest](demo-evidence/manifest.json).

## Before public sharing or submission

- [x] GitHub repository exists at https://github.com/Ming-Amos/Ming — **private**.
- [x] Sites preview exists at https://ming-acceptance-proof.amosming.chatgpt.site — **owner-private**, historical read-only evidence.
- [ ] Obtain final user review before changing either audience to public. Then verify signed-out access; a private URL is not a usable public judging link.
- [x] Reviewed the refreshed package: compiled UI, an explicit 25-route recorded-response map and 19 original screenshots; no local provider settings, keys or unreviewed runtime data are included.
- [ ] Obtain organizer confirmation of the account's event eligibility.
- [ ] If claiming live AI-generated plans, configure the user's chosen provider locally and perform an actual generation, human review and browser acceptance run.
- [ ] Review final statements, media, repository and application URL, then submit through the official event form before its deadline.

See [local onboarding](../README.md), [中文使用说明](../交付说明.md), and [AI connection](AI_CONNECTION.md). Historical PRD and stage reports remain dated development records.
