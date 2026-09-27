# Ming Application X-ray — design QA

## Simple novice workflow — 2026-09-27

**final result: passed.** Add app → Describe → Review → Results now presents one current task and one checklist. **Approve and check** explicitly approves the visible plan and runs it; technical fields remain optional. The [source/implementation comparison](docs/evidence/simple-workflow/2026-09-27T04-03-10-108Z-after-4187825e/10-before-and-after-comparison.png), all eleven final workflow screenshots and two diagnostic captures were opened and inspected. Dark branding, ordinary readable controls and the uploaded app's independent light theme remain intact at 1484×1060 and 390×844. No actionable P0/P1/P2 finding remains.

**31/31 focused behavior checks** passed on `index-INkjc2n3.js`; **7/7 final copy-only checks** passed on `index-eLFffDhU.js`, both with `index-Bpw9X5ez.css`. Real uploaded source failed on reload, revised source passed the same approved plan, and the original baseline remained unchanged. Stale/questioned drafts, atomic approval, repeated clicks, cancellation/retry, optional manual checks and no automatic model calls were verified. The executing iframe remained laid out (>100×100 CSS pixels); the original failure's actual DOM capture is 675×450 pixels. Provider responses were local fixtures, with no paid calls or Bob credit used. [Review, exact reports, evidence links and limitations](docs/SIMPLE_WORKFLOW_REVIEW.md).

## Dark inner working pages — 2026-09-27

**final result: passed.** The inner pages now use the welcome scene's dark navy, blue and lavender palette with ordinary readable forms and restrained pixel decoration. The source reference and rendered implementation were opened together in this [comparison sheet](docs/evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/11-source-and-implementation-contact-sheet.png), then inspected through desktop/mobile and focused state captures. This is an intentional theme adaptation, not a geometry clone.

The exact compiled `index-B8I6HpVZ.js` / `index-C_AcDn7p.css` passed **35/35** targeted checks at 1484×1060 and 390×844, plus **7/7** read-only saved-evidence Studio checks. The real manually approved uploaded app failed on reload, its revised source passed the same five-step plan, and the failed baseline stayed unchanged. The uploaded light iframe and its snapshots retained their own colors. Forms, selected tabs, technical editor disclosure, focus states, red/green results, comparison cards, command/model dialogs and history sheets were visually inspected. No actionable P0/P1/P2 finding remains. No provider call was made and no key value was read.

[Upload desktop](docs/evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/01-upload-desktop.png), [mobile checklist](docs/evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/04-manual-checklist-mobile.png), [actual failure](docs/evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/05-real-failure-desktop.png), [three-column Evidence Studio](docs/evidence/dark-inner-ui/2026-09-27T03-38-48-198Z-studio-f20f5afc/03-recorded-workspace-desktop.png), [mobile history](docs/evidence/dark-inner-ui/2026-09-27T03-38-48-198Z-studio-f20f5afc/02-failed-history-mobile.png). The Studio supplement explicitly replays saved judge records because the local history lacked the matching Shipboard failure; it does not claim new acceptance execution. [Full review, sources, reports and limits](docs/DARK_INNER_UI_REVIEW.md).

## Welcome inspection animation — 2026-09-27

**Final mobile-width follow-up: 11/11 passed** on `index-D_bsmEyy.js` / `index-a-pOcckO.css`. The mobile Start control now measures 280 pixels wide; entry routes, sprite/control separation, and overflow checks remain correct. [Final mobile](docs/evidence/welcome-inspection/2026-09-26T19-40-23-800Z-6d10f73d/01-mobile-start-final.png) and [clearer late return-for-fix](docs/evidence/welcome-inspection/2026-09-26T19-40-23-800Z-6d10f73d/02-desktop-return-for-fix-final.png) captures were opened and inspected. [Focused report](docs/evidence/welcome-inspection/2026-09-26T19-40-23-800Z-6d10f73d/report.json) confirms no browser errors or mutation/provider/external requests. The preceding full 27-check report is preserved below; unchanged animation checks were not repeated for this CSS-only refinement.

**Passed: 27/27 local browser checks.** The selected cover is now an illustrated inspection queue: a visitor approaches, the inspector writes, and PASS or NEEDS FIX produces a different exit route. The current visual source is the user's [1887 × 891 screenshot](docs/evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/source-reference.png), compared with the [same-size rendered implementation](docs/evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/05b-reference-sized-desktop.png). All seven new screenshots were opened and visually inspected. The older welcome section below is a preserved historical checkpoint; its login-reference, original-GIF playback, and `#studio` Start target do not describe the latest welcome page.

The Ming wordmark, bold English title, white Start pill, purple doorway, amber lamp, and wet pixel-art palette remain. Controls deliberately sit above the action so moving characters do not obscure them. A new empty room background and separate cast atlas replace the old crowd GIF in this view; the original GIF stays preserved. Start now opens `#upload`, while the guided sample opens `#trial`.

[Desktop writing](docs/evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/01-desktop-writing.png), [PASS](docs/evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/02-desktop-pass.png), [NEEDS FIX](docs/evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/03-desktop-needs-fix.png), [wide desktop](docs/evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/05-wide-desktop.png), and [390-pixel mobile](docs/evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/06-mobile-writing.png) show complete active characters, unobstructed controls, and no horizontal overflow. Mobile intentionally crops part of the decorative waiting queue, while the active inspection remains visible. No actionable P0/P1/P2 finding remains in this bounded review.

Pause freezes both timeline-driven writing/positions and the CSS walking motion; resume continues the saved elapsed time. Reduced motion starts paused. Visibility handling passed a synthetic `visibilitychange` test, not a native OS tab-switch test. No API is requested before entry; no POST, provider call, external request, failed resource, or uncaught browser error occurred. The welcome verdicts are explicitly illustrative and do not assert results for an uploaded project. No Bob or paid-model credit was used.

Exact compiled bundle: `index-Buwe4vzp.js` / `index-CWB5hoeW.css`. Full scope and asset provenance: [WELCOME_INSPECTION_REVIEW](docs/WELCOME_INSPECTION_REVIEW.md). [Machine-readable report](docs/evidence/welcome-inspection/2026-09-26T19-14-31-628Z-7f52d352/report.json). Local verification only; deployment is outside this review.

## Pixel-art welcome page — 2026-09-26

**Final result: passed.** The user selected the existing platform login-cover screenshot and requested the same initial composition with a **Start** action. The app now owns a welcome page at `/`; Start opens `/#studio`. The platform's private authentication gate is separate and was not changed.

Source visual truth: [reference](docs/evidence/welcome-page/reference.png), 1908×890 pixels. Implementation: [desktop](docs/evidence/welcome-page/01-desktop-welcome.png), at the same 1908×890 CSS viewport and deviceScaleFactor 1. Full-view comparison: [reference above implementation](docs/evidence/welcome-page/03-reference-and-implementation.png), 1908×1780, with both originals at 1:1 density. [Focused side-by-side comparison](docs/evidence/welcome-page/04-focused-comparison.png) shows the central heading, button and helper text without rescaling. The source is an animated-frame screenshot; implementation capture pauses an original frame, so flame/character animation phases can differ.

Required fidelity surfaces reviewed:

- **Typography:** centered 32px bold sans-serif two-line title and 22px Start label preserve the reference hierarchy. The new Ming wordmark uses the existing Georgia brand family. Narrow layouts wrap the title without clipping.
- **Spacing:** the 302×64px white pill, central alignment, title-to-button rhythm, dark full-height canvas and bottom-anchored scene retain the selected composition. The mobile control stays above the fold at 390×844.
- **Colors:** original black, blue/purple and warm reflected light are preserved. White controls keep strong contrast. Helper text now has a dark backing instead of sitting directly over a bright animated character.
- **Assets:** the original 1536×1024, 15-frame, 3-second GIF is reused byte-identically (SHA-256 in the provenance record). No invented pixel-art replacement. Pause/reduced motion displays a copied original frame, with no alterations to its artwork.
- **Copy:** `Log in to access` becomes `Welcome to`; the button becomes `Start`. OpenAI login/privacy text and logo are replaced by Ming branding and a short product promise. These are intentional user-requested changes, not a claim that the platform login UI itself was edited.

Comparison history:

1. Initial desktop matched the selected composition. [Initial focused capture](docs/evidence/welcome-page/04-focused-before.png) exposed a **P2 helper-text contrast issue** over the fox; a dark backing fixed it. [Initial mobile capture](docs/evidence/welcome-page/02-mobile-before.png) showed **P2 excessive scene cropping**; reducing the mobile scene width preserved the character lineup. No functionality was changed by these adjustments.
2. Final combined/focused comparisons and [mobile capture](docs/evidence/welcome-page/02-mobile-welcome.png) were opened and visually reviewed after both fixes. No actionable P0/P1/P2 findings remain. P3: the edge of the leftmost character is slightly cropped on a 390px screen, an intentional responsive crop with all controls visible.

Validation: **13/13** entry, keyboard, Back, refresh, animation-pause, reduced-motion and mobile checks; final compiled **54/54** Studio checks; own-project workflow **32/32**. No uncaught browser errors or mutation requests. App APIs are not requested before Start. Local browser automation was used because an in-app Browser tool is unavailable in this session. No Bob or paid model calls occurred.

final result: passed

## Functional follow-up, 2026-09-26

The same English composition now shows completed browser observations during a running check, preserves the selected step, and excludes unexecuted steps from replay. Open editors also survive the global command shortcut. The compiled viewer passed **50/50** checks; editor/live-progress regressions passed **17/17**. Root visually inspected the actual running-state captures. See [functional review](docs/FUNCTIONAL_COMPLETENESS_REVIEW.md) for the wider lifecycle audit and its scope. The sections below retain their dated visual-release results.

## English Evidence Studio — current review, 2026-09-26

**Final result: passed.** The latest revision retains the selected three-column Application X-ray composition and adds an English editorial project hub, an actual recorded-step timeline, evidence focus, command navigation and direct before/after image comparison. The earlier sections below describe historical checkpoints, including their original Chinese UI; they do not describe the current interface.

The source audit captured the previous working hub, history and failed evidence workspace before changes. Root review opened the [workspace pair](docs/evidence/english-studio/workspace-comparison.png) and [hub pair](docs/evidence/english-studio/hub-comparison.png) as combined before/after inputs at identical 1484×1060 viewport and 1× density. No source image was rescaled. Both use the same product workflow; the English Shipboard fixture is an intentional replacement for the Chinese daily-report presentation. The previous raw execution bundle remains unchanged.

**Visual and interaction findings resolved:**

1. **P1 — judge-facing language gap:** product navigation, editors, settings, errors and new report copy are English. A separately executed English example supplies English screenshot/repair evidence instead of relabelling old screenshots.
2. **P2 — weak first-use hierarchy:** the large empty placeholder is replaced by a concise project entry, a serif-led product promise and keyboard-operable Define/Inspect/Resolve tabs. Sample cards expose working, defective and repair variants; legacy examples are grouped separately.
3. **P2 — hard-to-follow execution evidence:** a scrubber and Play/Pause follow actual saved actions and keep the criterion, observation and evidence selection synchronized. Focus mode enlarges the evidence area. The above-fold Explore repair action opens the verified comparison without searching the side panel.
4. **P2 — static repair comparison:** a draggable divider and keyboard range reveal original captures. Same-standard comparison checks and original-image links remain available. No invented pixels or execution steps are displayed.
5. **P2 — readability and loading:** explanatory copy was darkened (measured paragraph contrast 5.45:1), the missing banner text gap and millisecond casing were corrected, and remote font imports were removed. Native Segoe UI/Arial and Georgia stacks load without a font-network dependency. Reduced motion is honored.

The final compiled interface passed **47/47** creative/read-only checks and **32/32** independent own-project checks. All seven stable final Studio captures, the independent project workflow captures, and both visual pairs were inspected. Desktop and 390px layouts have no horizontal document overflow. No uncaught browser errors, failed resources or external requests occurred in the read-only review. Type checking and the full production build passed.

The real screenshots remain the primary imagery; Phosphor icons provide controls. Ink text, warm neutral surfaces and cobalt actions retain the existing palette, with green/red status words and icons rather than color alone. Operational screenshots can scroll, zoom and open at original size. The new timeline adds vertical space deliberately; the top comparison entry and focus mode provide a direct route to the relevant proof.

**P3 follow-up:** compact provenance metadata and full-page source captures can remain small at narrow widths. Original-image access and focus/zoom controls are available. This does not prevent the reviewed workflow. No actionable P0/P1/P2 finding remains in the bounded review. See [ENGLISH_STUDIO_REVIEW](docs/ENGLISH_STUDIO_REVIEW.md) for current evidence, exact scope and limitations. All work in this upgrade is attributed to Codex, with no additional Bob usage.

## Product workflow extension — 2026-09-26

**PASS: own-project workflow and responsive visual review.** The frontend now adds a first-use project hub, local URL/HTML connection, PRD upload and persisted requirements, a visual manual acceptance editor, model configuration, and searchable history. These retain the original light Application X-ray styling while providing a complete entry path for a user's application.

The compiled UI passed **32/32** real browser checks against an independent multi-file task application. It covered actual passing and failing operations, evidence provenance, immutable plan revision, historical review, queued repair handoff, and cancellation after reloading an active run. No Bob or model calls were made. Both desktop and 390-pixel views had zero horizontal overflow and no browser exceptions.

Final captures and detailed scope: [PRODUCT_UI_REVIEW.md](docs/PRODUCT_UI_REVIEW.md) and [machine-readable report](docs/evidence/product-ui/review-report.json). The project hub, manual editor, failure workspace, and narrow layouts were opened and visually inspected. The manual editor's sticky save control was corrected to remain fully inside the dialog. Explicit accessible names were added to editable textareas and selects so their labels remain stable after file import and editing. The original source comparison below remains the visual basis; new workflow captures are actual browser renders, not regenerated concept imagery.

Reviewed by Codex on 2026-09-26. Core implementation and final visual work in this revision are by Codex; this report is not Bob usage evidence.

The final desktop, combined comparison, repair dialog, and mobile captures are also preserved in `docs/evidence/xray-final/`. The latest read-only browser review passed all 10 checks; its report is `docs/evidence/xray-final/public-ui-report.json`.

## Visual truth and rendered evidence

- Selected source: `assets/ming-application-xray-concept-v1.png`, 1484 × 1060 pixels.
- Local implementation: `http://127.0.0.1:4000/`, desktop viewport 1484 × 1060 CSS pixels, deviceScaleFactor 1.
- Final browser capture: `runtime/ui-xray-desktop-final.png`, 1484 × 1060 pixels.
- Equal-density, side-by-side comparison: `runtime/ui-xray-reference-comparison-final.png`, 2968 × 1060 pixels. Source is on the left; the actual app is on the right. Both were opened together and visually compared. No density scaling was applied.
- Focused requirement/criterion typography comparison: `runtime/ui-xray-focused-comparison.png`, 800 × 440 pixels, unscaled crops from both source and implementation. Different vertical crop origins align the functional content region rather than browser chrome.
- Actual repair comparison dialog: `runtime/ui-xray-comparison-final.png`, 1484 × 1060 pixels.
- Responsive capture: `runtime/ui-xray-mobile-final.png`, 390 × 2856 pixels, captured at 390 × 844 CSS pixels and deviceScaleFactor 1. Document width equals viewport width; no horizontal overflow.

The final state displays the real repair-demo baseline `65aece9c-b145-4045-8096-60331a4c6ae1`, where AC-02 failed. The linked task `7ed27f84-aa14-43f8-90e2-f84702dc21b0` subsequently passed a strict comparison against rerun `2cf3cc33-507f-41c2-8b9f-6a16c712a7ae`. Baseline failure evidence stays unchanged while the repair task shows its later outcome.

## Comparison history and fixes

1. **P1: excessive desktop height and weak evidence hierarchy.** Initial `runtime/ui-xray-desktop.png` was about 1593 pixels tall. Large empty areas inside raw browser screenshots pushed the failure and repair controls below the intended viewport. Compact header spacing, larger UI type, and explicitly scrollable screenshot windows replaced the unrestricted images. Original images remain unchanged and openable.
2. **P2: clipping concealed the submitted entry.** A 200-pixel image window in `runtime/ui-xray-desktop-v4.png` clipped useful application content. Final windows use 238 pixels at the reference desktop width; redundant header content was removed to recover space. `runtime/ui-xray-desktop-final.png` visibly shows the submitted record before refresh and the empty list after refresh. The failure card ends at y=1031 and the repair comparison action ends at y=998 in the 1060-pixel viewport.
3. **P2: small operational text.** Initial detail labels used 9–11px in too many places. Requirement and actual-observation content now use 12–13px, selected requirement titles use 17px, and operational step text uses 12px. Metadata remains smaller. The focused paired comparison was inspected to check the resulting hierarchy and wrapping.
4. **P1: evidence caption could describe an uncaptured step.** Selecting an action with no screenshot previously showed the criterion's final image with the selected action's caption. Captions now identify the actual image step; a separate notice states when the selected action was not separately captured.
5. **P1: state drift between projects and comparisons.** Asynchronous generation now has epoch guards and disables context-changing controls. Switching to a sample clears the previous project's requirement text. Switching baseline to rerun reloads the same task's comparison. Historical plans that differ from the current plan cannot be silently confirmed; the user must inspect the current version first.

## Required fidelity surfaces

- **Fonts and typography:** serif Ming wordmark and Chinese display heading preserve the source hierarchy; sans-serif operational labels provide clearer dense interaction content. Chinese font fallbacks are supplied. The implementation is intentionally more compact than the presentation mock, with real criterion selection and provenance controls.
- **Spacing and layout rhythm:** desktop keeps the selected three-column composition: requirements and recorded steps on the left, the largest real screenshot area in the center, observed results and repair handoff on the right. Borders, moderate radii, white space, and restrained shadows match the chosen form. Narrow screens stack these regions without hiding their controls.
- **Colors and tokens:** warm near-white canvas, dark ink, indigo selection/actions, green verified passes, red failed assertions, and amber unverified explanations. State labels and icons supplement color. A completed repair uses a distinct verified result rather than leaving a stale speculative-root-cause message.
- **Image quality and asset fidelity:** all product evidence is the original runner PNG. Screenshot containers explicitly say they can scroll and open the original; a user-controlled magnification button helps inspect small application text. Standard Phosphor icons replace no bespoke image assets. The concept image is never shown as execution evidence.
- **Copy and content:** UI language is Chinese, with the Ming English tagline. Fixed sample plans, test transport, missing model configuration, queued AI work, execution errors, historical source changes, and public read-only replay are explicit. No invented HTTP requests, console logs, agent work, repair outcome, or model invocation is shown.

## Intentional differences from the concept

The source is a concept containing an illustrated TaskFlow application and example HTTP events. The actual implementation uses the existing daily-report and independent todo projects, original browser captures, and actual assertion results. Network/console collection is not implemented and is labeled as such. Decorative lines pointing into unrecorded screenshot coordinates are omitted. The added criterion selector, history, confirmation, model configuration, and real repair state are required functional controls. This is an implementation of the selected visual form, not a pixel clone of the fictional sample data.

## Interaction and error validation

- Independent full integration: **43/43 checks passed**, recorded in `docs/XRAY_UI_INTEGRATION_REVIEW.md` and `docs/evidence/xray-ui-integration/review-report.json`.
- Covered: initial confirmation gate, actual browser run, failed assertion/image provenance, repair-task creation, reload restore, missing-model error, explicitly labeled test-generated plan, confirmation, passing run, rerun, correct history context, 390px layout, and no JavaScript exceptions.
- Additional browser checks: comparison remains available after switching from baseline to rerun; images load successfully; desktop and mobile captured with zero page exceptions; mobile document and viewport widths both equal 390.
- Native dialogs support Escape, focus containment, accessible names, and explicit close controls. Buttons, form controls, and links have visible keyboard focus.
- Web TypeScript check and production build passed after implementation.

## Follow-up polish

- P3: raw application text is small inside a complete browser screenshot. Explicit magnification and original-image access are available; no evidence has been enlarged by inventing content or silently cropping a source file.
- P3: secondary metadata remains compact to keep the full evidence chain visible. This does not block the main task.

Root reviewer independently opened the final combined comparison and accepted the three-column composition, above-fold failure and repair action, and justified evidence-driven differences. No actionable P0/P1/P2 visual or interaction findings remain.

final result: passed
