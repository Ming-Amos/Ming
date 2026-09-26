# Own-project UI review

**PASS — 32/32 browser checks, 2026-09-26.** `scripts/review-product-ui.mjs` drove the compiled frontend, a separate Ming server on port 4450, and an independent multi-file task application on port 4451. All data and evidence used an isolated runtime. No Bob or model calls were made; the unconfigured model request returned the actual 503 response.

## What was exercised

- First-use project hub and local URL registration; entering Ming itself was rejected.
- Actual Markdown upload, persisted PRD version, model settings opening with an empty key field, and missing-model error followed by the manual alternative.
- Visual creation of two criteria, including input, click, visible-text assertion, inherited context, and refresh. The plan is explicitly marked `manual`; execution remains disabled until human confirmation.
- Real add-and-refresh acceptance against separate HTML, CSS, JavaScript and HTTP endpoints. The application's mutation endpoint received one POST for the first run. Screenshots loaded from that run's evidence URLs.
- Reload restoration of the project, PRD, plan, confirmation, and evidence; real reachability probing; reopening the saved project.
- An immutable plan revision invalidated its older confirmation for future runs while preserving historical evidence.
- A real persistence defect passed the add operation and failed the refresh requirement. Creating a repair task left it waiting for an actual agent.
- History filtering by project and outcome; old standards cannot execute after replacement.
- Reload during a slow active run restored progress and the cancellation control. Cancellation produced an incomplete error result, never a pass.
- Desktop 1484×1060 and narrow 390×844 layouts had no horizontal document overflow; no uncaught browser errors occurred.

## Evidence

Machine-readable checks and actual run identifiers are in [review-report.json](evidence/product-ui/review-report.json).

- [First-use project hub](evidence/product-ui/01-project-hub.png)
- [Visual acceptance editor](evidence/product-ui/02-manual-plan-editor.png)
- [Passing real application](evidence/product-ui/03-live-project-passed.png)
- [Real persistence failure](evidence/product-ui/04-live-project-failed.png)
- [Narrow acceptance workspace](evidence/product-ui/05-live-project-mobile.png)
- [Narrow project hub](evidence/product-ui/06-project-hub-mobile.png)

The screenshots were opened and visually reviewed. The acceptance workspace retains the selected Application X-ray composition: requirements left, actual browser evidence center, and observations/repair handoff right. The project hub and editors extend that design for real work. Screenshots are not substituted concept art. Long plan editing keeps the save control fully visible.

## Boundaries

This review verifies one realistic application and the stated flows, not every possible project. Live URL runs are labelled `live-url-observed`, not a frozen application snapshot. They can demonstrate passing acceptance without claiming strict verified repair. Browser access is constrained to the registered origin; external resources and APIs require a same-origin development proxy. Existing authentication, CAPTCHA, and external integrations still need an appropriate test environment.

The reviewed frontend build was `index-CtFySXMn.js`, SHA-256 `8a1494249ffa093a03f1150188ce0f46ac5769f909b47af58c48dfb92d1e199f`. Provider configuration and read-only hosting have separate independent reviews.
