# Project learnings

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

