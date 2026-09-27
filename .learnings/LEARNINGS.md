# Project learnings

## [LRN-20260927-UX3] correction

**Logged**: 2026-09-27
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
Readable labels alone do not remove an overly complicated workflow.

### Details
The user still found the workspace difficult after readable checklists were added. Presenting importing, describing, draft adoption, confirmation, execution and technical details together required unnecessary decisions. Use progressive Add app, Describe, Review and Results stages. Show exactly one checklist and combine its explicit approval with execution. Keep manual editing, source settings and diagnostics available through disclosures. An unresolved or stale candidate must remain blocked, never silently replaced with an old plan.

### Metadata
- Source: user_feedback
- Related Files: apps/web/src/components/UploadStudio.tsx, apps/web/src/components/UploadFlow.css
- Pattern-Key: ux.one-current-step-one-explicit-approval

## [LRN-20260927-UX2] correction

**Logged**: 2026-09-27
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
The selected cover is the visual reference for the inner workspace too, with restrained decoration.

### Details
An ambiguous negative in the user's prior message was interpreted as preserving the light interior. Their follow-up explicitly requests the inner style to change. The latest clarification limits pixel art to small decorative accents; readable ordinary typography and working forms take priority. Apply the dark palette across Upload, guided trial, Evidence Studio and dialogs, while preserving the colors of inspected applications and saved evidence.

### Metadata
- Source: user_feedback
- Related Files: apps/web/src/workbench-theme.css, apps/web/src/components/UploadStudio.css, apps/web/src/components/LiveTrial.css, apps/web/src/studio.css, apps/web/src/workspace.css
- Pattern-Key: ux.consistent-brand-restrained-decoration

## [LRN-20260927-UX1] correction

**Logged**: 2026-09-27
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
Acceptance review must be understandable without understanding a test runner.

### Details
The user could not understand the generated action/selector/assertion form even after two explanations. Asking them to decipher execution configuration moves work back to the person Ming is meant to help. A passing technical test alone does not establish a usable review flow.

### Resolution
Show readable check cards with actions and explicit passing conditions first. Hide technical editing behind a keyboard-accessible disclosure. Retain exact values, step ordering, explicit confirmation, and uncertainty about requirements coverage. Validate the review flow at desktop and mobile widths using actual rendered screenshots and a real browser run.

### Metadata
- Source: user_feedback
- Related Files: apps/web/src/components/UploadStudio.tsx, apps/web/src/upload/plan-summary.ts
- Pattern-Key: ux.review-outcomes-before-execution-details
