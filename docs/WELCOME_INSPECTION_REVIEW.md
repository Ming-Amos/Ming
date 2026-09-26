# Welcome inspection animation review

**Final CSS follow-up: 11/11 passed**, 2026-09-27 Beijing time (19:40 UTC on September 26), on `index-D_bsmEyy.js` / `index-a-pOcckO.css`. This focused run verified the final 280-pixel mobile Start width, visible entry controls, complete active sprites, no horizontal overflow, and both working entry routes. It also captured the real failed visitor later in the return animation. [Final report](evidence/welcome-inspection/2026-09-26T19-40-23-800Z-6d10f73d/report.json), [final mobile screenshot](evidence/welcome-inspection/2026-09-26T19-40-23-800Z-6d10f73d/01-mobile-start-final.png), and [late return-for-fix screenshot](evidence/welcome-inspection/2026-09-26T19-40-23-800Z-6d10f73d/02-desktop-return-for-fix-final.png) were opened and inspected. No browser error, failed resource, external request, or mutation/model request occurred. Set `MING_WELCOME_FOLLOWUP=1` when running the harness to reproduce this focused scope. The full animation checks below remain preserved for the prior bundle; they were not redundantly repeated after the mobile-width-only CSS change.

**Passed: 27/27 local browser checks.** Reviewed on 2026-09-27 Beijing time (2026-09-26 19:14 UTC), using the compiled application at `http://127.0.0.1:4001/`, JavaScript `index-Buwe4vzp.js` and stylesheet `index-CWB5hoeW.css`. This is a welcome-scene review, not a rerun of every application workflow or a production-deployment verification.

The reproducible harness is [review-welcome-inspection.mjs](../scripts/review-welcome-inspection.mjs). [Machine-readable results](evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/report.json) preserve checks, viewport measurements, asset dimensions, screenshot hashes, requests, and review limitations. All seven implementation screenshots and the reference were opened and visually inspected.

## Source and visual result

The current source of visual truth is the user's [selected screenshot](evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/source-reference.png), **1887 × 891**. It was compared with the [current implementation at the same viewport and 1× density](evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/05b-reference-sized-desktop.png). The older platform-login reference in historical QA sections is not the reference for this iteration.

- **Typography and copy:** the serif Ming wordmark, bold two-line “Welcome to / Ming — Every done comes with proof” heading, white Start pill, guided-sample link, and short product promise retain the selected cover's character. The stage's PASS and NEEDS FIX labels communicate outcomes with words as well as color.
- **Spacing:** the entry controls intentionally move above the inspection scene. Characters no longer sit behind the Start/helper text. On wide screens the content and scene use centered bounds; this is an intentional composition change, not a pixel-identical clone of the screenshot. The measured desktop Start control is 302 × 67 CSS pixels.
- **Color and assets:** the near-black night setting, purple doorway, amber light, teal vegetation, and wet pixel-art floor remain. The empty background is an AI edit of the original artwork; independently positioned characters come from the new cast atlas. The original GIF remains preserved on disk, but the welcome page now loads `inspection-room.png` (1536 × 1024) and `inspection-cast.png` (1448 × 1086), not the old crowd GIF.
- **Completeness:** the active visitor, inspector's entire head and feet, writing hand, and clipboard fit in the inspected desktop and mobile frames. Their bounds do not overlap the entry controls. The six waiting visitors remain visible on desktop; narrow-screen framing intentionally reveals only the end of the waiting queue.

## Evidence from actual browser rendering

| View | Evidence |
| --- | --- |
| Desktop 1536 × 1024, inspector writing | [Writing](evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/01-desktop-writing.png) |
| Passing visitor | [PASS](evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/02-desktop-pass.png) |
| Failed visitor | [NEEDS FIX](evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/03-desktop-needs-fix.png) |
| Distinct repair route | [Return for fix](evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/04-desktop-return-for-fix.png) |
| Desktop 1856 × 900 | [Wide desktop](evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/05-wide-desktop.png) |
| Mobile 390 × 844 | [Mobile](evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/06-mobile-writing.png) |

The harness waited for the real animation timeline rather than setting outcome attributes or replacing its clock. It observed the inspector change writing frames, a passing Duck move toward the doorway, and a Flame with NEEDS FIX move toward the highlighted return area. The static screenshots show moments from that execution; motion assertions and elapsed values are in the report.

Pause was checked both while writing and while a visitor was walking. Elapsed time, sprite frames, actor positions, computed transforms, and the walking CSS animation's current time remained frozen. Resume continued from the saved elapsed time without restarting. Reduced-motion preference began with a paused scene and an available Play control.

The hidden-page check used an explicit `document.visibilityState` override and `visibilitychange` event, then checked freeze/resume. It verifies the application's visibility handler, **not native operating-system tab switching**.

## Entry behavior and limits

Start remained fully visible and touch sized at 1536 × 1024, 1856 × 900, and 390 × 844, with no horizontal document overflow. Mobile Start and keyboard Start opened the actual `#upload` workflow. The guided link opened `#trial`; browser Back returned to the cover.

No application API was requested before entering a workflow. After Start, the upload page made its expected read-only planner-status request. There were **no POST requests, model/provider calls, external requests, failed resources, or uncaught browser errors**. No Bob credit was used. Standalone local Playwright was used after the in-app browser bootstrap was unavailable.

No actionable P0/P1/P2 visual issue was found in these views. Minor responsive tradeoff: the left side of the decorative waiting queue is cropped on a 390-pixel screen; the active visitor, inspector, verdict, Start, and motion control remain visible. Tiny floor captions are decorative and do not carry essential instructions. This review does not claim complete accessibility, every possible viewport, every browser, or a full seven-visitor-cycle recording.

The animation is explicitly labeled an **illustrated scene**. Its PASS/NEEDS FIX sequence explains the product and is not presented as evidence that a user's uploaded project has passed. Real checks start in the upload or guided workflow. This implementation and review are Codex work and are separate from preserved Bob usage evidence.
