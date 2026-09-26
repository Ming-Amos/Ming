# English Evidence Studio review

**PASS — 2026-09-26.** The compiled English frontend passed 47 interaction checks against its read-only Worker and 32 separate checks against a writable local server and an independent English web application. These are actual browser checks, not synthetic acceptance results. No Bob or external model request was made.

## Current interaction coverage

- The featured Shipboard failure opens with its original criterion, observed result and screenshot. All visible product and featured evidence copy is English.
- Recorded-step selection, next/previous, scrubbing, Play/Pause and criterion changes follow the saved actions. Replay makes no new execution request and does not invent uncaptured frames.
- Evidence focus expands the center column; Escape restores the workspace. Ctrl+K opens a searchable command menu with arrow-key navigation and Enter activation.
- The repair comparison uses original before/after images. Pointer dragging and the keyboard-operable range control change the clipping boundary, preserving the actual image bytes and source links.
- Requirements, plan editing, confirmation, real passing/failing checks, project persistence, repair handoff, revision invalidation, history, restart restoration and cancellation passed against an independent local Clear Tasks app.
- Project method tabs, history search and recorded-run switching work. Exported JSON matches the chosen original record.
- Desktop 1484×1060 and mobile 390×844 browser views were captured and visually inspected. There was no horizontal document overflow, uncaught JavaScript error or failed resource. The recorded viewer made no mutation or external network request.
- Reduced-motion preferences suppress transitions. Explanatory paragraph contrast is 5.45:1; this bounded check is not a complete accessibility certification.

## Preserved review artifacts

- [47-check Studio report](evidence/english-studio/review-report.json)
- [32-check own-project report](evidence/english-product-ui/review-report.json)
- [Compiled package integrity report](evidence/english-studio/package-review-report.json): all 20 served API routes checked; 17 recorded responses are exact, while 3 hosted-mode metadata responses deliberately enforce read-only operation, no model configuration and no private projects. All 12 served PNG hashes match the originals.
- [Featured failure](evidence/english-studio/01-featured-baseline.png), [evidence focus](evidence/english-studio/02-evidence-focus.png), [repair comparison](evidence/english-studio/03-repair-comparison.png)
- [Project hub](evidence/english-studio/04-project-hub.png), [mobile workspace](evidence/english-studio/05-mobile-workspace.png), [mobile hub](evidence/english-studio/06-mobile-project-hub.png), [mobile command menu](evidence/english-studio/07-mobile-command-menu.png)
- [Workspace before/after](evidence/english-studio/workspace-comparison.png) and [hub before/after](evidence/english-studio/hub-comparison.png)

The paired visual comparisons place the previous working interface and the new interface at identical 1484×1060 CSS viewport size and 1× pixel density, without rescaling. They compare the equivalent failed-reload workflow and project hub. The older app has Chinese daily-report evidence; the newer viewer uses a newly executed English Shipboard example. This is an intentional content change, not a translation or alteration of the original captured evidence. The viewer also has an explicit read-only notice and disables execution.

The Studio report's absolute runtime paths are local provenance; the relative links above identify the copies retained with the source. Raw execution evidence is separately preserved at [judge-evidence](judge-evidence/README.md). All 34 new manifest files and 26 earlier manifest files remained byte-identical during packaging review. Genuine Bob session captures are unchanged. UI review images document the interface; they are not substitute browser-run evidence or Bob usage evidence.

## Scope and remaining work

These checks cover the implemented local web-app workflow and a read-only hosted replay. They do not establish support for arbitrary desktop/mobile applications, arbitrary external websites, or external model quality. A user-selected model still needs an actual key and a live generation/review/run before that capability can be demonstrated. Existing narrated video and slides show an earlier checkpoint and should be updated for this interface. Public repository/site access and competition submission remain separate from this local product review.

Reproduce the core reviews with `node scripts/review-product-ui.mjs` and `node scripts/review-english-studio.mjs` after building. Both use isolated runtime directories and owned temporary services. The final reviewed frontend assets are `index-Cw3An0o5.js` and `index-DP6x74j7.css`.
