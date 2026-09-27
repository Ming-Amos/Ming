# Dark inner UI — independent review

Date: 2026-09-27. **final result: passed**

The requested adaptation connects the working pages to the dark welcome scene while keeping ordinary, readable forms. Pixel art remains a small accent rather than the interaction language. No actionable P0/P1/P2 issue was found in the reviewed states.

## Source, build and method

- Visual reference: [dark welcome scene](evidence/welcome-inspection/2026-09-26T19-40-23-800Z-6d10f73d/02-desktop-return-for-fix-final.png), 1536 × 1024 pixels. The user's [previous light inner page](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/source-previous-light-ui.png), 1917 × 887 pixels, is preserved as an unchanged copy.
- Reviewed build: `index-B8I6HpVZ.js` and `index-C_AcDn7p.css`, served locally on port 4001. The browser report checks that the served script matches the current compiled file.
- All main screenshots use a 1484 × 1060 CSS viewport or 390 × 844 mobile viewport, at device scale 1. The contact sheet proportionally scales the originals into labeled panels; it is a comparison aid, not a claim of matching geometry. Individual captures were opened for legibility and state inspection.
- The [combined source-and-implementation comparison](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/11-source-and-implementation-contact-sheet.png) was opened alongside focused screenshots. This is a theme adaptation, not a screenshot clone.
- In-app Browser bootstrap was attempted and failed because its installed `browser-service.mjs` was missing. The authorized fallback was standalone Chromium through the repository's existing Playwright dependency. No service-worker blocking was enabled, so uploaded opaque-origin previews used their normal runtime.

## Verified behavior

**35/35 current-build checks passed**, with [full machine-readable results](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/report.json). The three inner routes, checklist, observed failure, revision comparison and mobile model dialog have no horizontal overflow. All three application canvases are `rgb(8, 11, 22)`.

The independent review uploaded a harmless light “Field Notes” application and manually defined five actions: enter a unique task, submit it, confirm the text, reload, confirm the same text. The original app failed after reload. A revised file with persistence passed exactly the same plan. The original failure remained byte-for-byte unchanged in the exported baseline. The UI generated genuine current browser evidence; no model created this plan and no result was replayed for this test.

- [Actual original run](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/manual-failure.json): `e9364414-2e12-4e4e-8217-4e991b7b9d96`, four steps passed and the final assertion failed.
- [Actual revised run](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/manual-fixed.json): `cf204398-64a7-4e71-b5a0-9849c34e7cda`, all five steps passed. Both use plan fingerprint `d1fc12633d36bcd3b57bf3b89158b2e0e89e6d28a100e87a71837513c647db11`; source fingerprints differ.
- The uploaded iframe retained its own `rgb(248, 249, 251)` background. The surrounding theme did not recolor the inspected app or its DOM snapshots.
- The plain checklist keeps technical fields collapsed. Keyboard Enter opens and closes the optional editor; focus outlines remain visible. Original Start and guided-sample links still open `#upload` and `#trial`, and both inner Cover links return to the welcome route.
- The model dialog was opened only to inspect its controls. No key value was read or returned. The paid generation button was disabled through an explicit unavailable-status fixture. All external and mutating requests were blocked and the report confirms zero attempted requests of either kind.

## Visual review

| Surface | Observed result |
| --- | --- |
| Typography | Readable Segoe UI forms and headlines replace the light page's large italic serif headlines. The Ming wordmark remains recognizable. Technical fields use normal controls, not pixel fonts. |
| Layout and spacing | Source/requirements, app preview and evidence retain their hierarchy. Desktop columns stack cleanly at 390 pixels. Dialogs stay within the viewport; long model settings scroll inside the sheet. |
| Color and state | Navy canvas and panels connect to the welcome scene, with blue/lavender accents. White primary text, muted labels, selected tabs, keyboard focus, red failure and green pass states remain distinguishable. This was visual inspection, not a claim of a complete WCAG contrast audit. |
| Images | The small inspector decorates the empty upload preview; it does not overlap controls. The actual uploaded page and preserved screenshots keep their original light appearance. No screenshot was altered to suggest a result. |
| Content | English requirements, observed results, model-cost notices and the distinction between current runs and recorded evidence remain explicit. The theme does not change acceptance behavior. |

Focused evidence: [upload desktop](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/01-upload-desktop.png), [upload mobile](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/02-upload-mobile.png), [live sample](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/01-trial-desktop.png), [plain checklist](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/04-manual-checklist-mobile.png), [actual failure desktop](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/05-real-failure-desktop.png), [failure mobile](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/05b-real-failure-mobile.png), [comparison mobile](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/06b-real-comparison-mobile.png), [command dialog](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/08-studio-command-dialog.png), [model dialog mobile](evidence/dark-inner-ui/2026-09-27T03-34-39-210Z-after-332bb5d8/10-studio-model-dialog-mobile.png).

## Evidence Studio supplement

**7/7 additional checks passed** against the same compiled UI. The local API contained no matching failed Shipboard history entry, so this supplement used the exact previously saved `docs/judge-evidence/api-responses.json` and its native screenshots through the existing read-only Worker policy. This is explicitly saved-evidence replay for visual review, not a new browser acceptance run.

The three-column workspace, failed and passed observations, screenshot browser frames, selected criterion, timeline and Run history filters were opened. All six supplementary screenshots were inspected; the 390-pixel history dialog and failure/repair cards remain readable with no horizontal overflow. No external request, backend execution, mutation or browser error occurred.

[Supplement report](evidence/dark-inner-ui/2026-09-27T03-38-48-198Z-studio-f20f5afc/report.json), [three-column workspace](evidence/dark-inner-ui/2026-09-27T03-38-48-198Z-studio-f20f5afc/03-recorded-workspace-desktop.png), [history desktop](evidence/dark-inner-ui/2026-09-27T03-38-48-198Z-studio-f20f5afc/01-failed-history-desktop.png), [history mobile](evidence/dark-inner-ui/2026-09-27T03-38-48-198Z-studio-f20f5afc/02-failed-history-mobile.png), [failed observation](evidence/dark-inner-ui/2026-09-27T03-38-48-198Z-studio-f20f5afc/04-failed-observation-desktop.png), [failed observation mobile](evidence/dark-inner-ui/2026-09-27T03-38-48-198Z-studio-f20f5afc/05-failed-observation-mobile.png), [passed observation](evidence/dark-inner-ui/2026-09-27T03-38-48-198Z-studio-f20f5afc/06-passed-observation-desktop.png).

## Review history and limits

1. The [light baseline](evidence/dark-inner-ui/2026-09-27T03-27-50-679Z-before-41aceacd/report.json) preserves all three routes at desktop/mobile; eight baseline checks passed.
2. The first dark pass completed 31 checks. No app defect was found. The harness then captured the selected failing assertion and mobile comparison more precisely; the final unchanged build passed 35 checks. Both evidence folders remain immutable.
3. A local-history-only supplement stopped because no matching English failed record was available. The explicit saved-evidence fallback passed seven checks. This was an environment/data condition, not a theme failure. A harness-only missing screenshot-list initialization was corrected before the successful replay.

Scope is the requested styling change and its affected working states. It is not a new provider, GitHub, full backend, security or complete accessibility audit. No application source was edited by this independent reviewer. Deployment verification belongs to the parent task.
