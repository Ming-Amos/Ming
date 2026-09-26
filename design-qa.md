# Ming Application X-ray — design QA

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
