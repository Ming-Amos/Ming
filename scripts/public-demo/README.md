# Hosted live sample and reviewed evidence adapter

This adapter serves two separate experiences: a **live sample executed in the visitor's browser** at `/#trial`, and the **read-only recorded-evidence viewer** at `/#studio`. The Worker itself does not launch a browser, invoke a model, modify source, or create repair tasks. The live sample performs fresh DOM interactions and observations against the bundled Shipboard frame, with DOM-rendered snapshots and a clearly labeled prepared fix. Full project execution and coding-agent repair remain available in the local application. See [execution boundary](../../docs/LIVE_TRIAL.md).

## Export contract

The separately reviewed English export at `docs/judge-evidence/api-responses.json` must have this structure:

```json
{
  "schemaVersion": 1,
  "responses": {
    "/api/history": { "ok": true, "runs": [] },
    "/api/targets": { "ok": true, "targets": [] },
    "/api/plan": { "ok": true, "plan": {} },
    "/api/plan?variant=todo-normal": { "ok": true, "plan": {} },
    "/api/repair-tasks": { "ok": true, "tasks": [] }
  }
}
```

The shape above is illustrative, not acceptance evidence. The actual export must contain complete response bodies copied from selected real API records. Include `/api/run/:id`, optional terminal progress responses, `/api/repair-tasks/:id`, and `/api/repair-tasks/:id/comparison` for every visible run/task. Comparison results are served unchanged, never recomputed by the public adapter. Requirements, confirmations, and draft GET responses can also be included if needed by the final frontend.

Only reviewed screenshots in `docs/judge-evidence/runtime/screenshots/` are copied. Packaging fails if a recorded `screenshotPath` refers to an image absent from that directory. Live local `runtime/`, model configuration, `.env`, and credentials are not included. The legacy `docs/demo-evidence` is preserved unchanged as a historical checkpoint; the current viewer packages 20 English response routes and 12 original Shipboard captures.

## Local validation and packaging

After the normal frontend build and reviewed export:

```text
node --test scripts/public-demo/worker.test.mjs
node scripts/public-demo/build.mjs
node scripts/public-demo/preview.mjs
```

Output is isolated at `dist/sites/client`, `dist/sites/server/index.js`, and `dist/sites/.openai/hosting.json`. The existing app's source and build are not replaced. Worker tests use visibly labeled unit-test fixtures, not claims about real acceptance outcomes.

The preview serves the exact compiled Worker and its static assets at `http://127.0.0.1:4182`; set `MING_PREVIEW_PORT` to change that port. It is separate from the local writable application and never starts the Express backend.

Deployment metadata is machine-local and ignored by Git. A fresh clone can build and preview without it. Archive publication requires the actual project ID supplied by the hosting service in the local `.openai/hosting.json`; keep that local association for subsequent deployments. Once it is available, rebuild and package:

```text
node scripts/public-demo/build.mjs --archive C:\absolute\path\ming-sites.tar.gz
```

The archive follows the Sites helper's contract: `dist/client/`, `dist/server/index.js`, and `dist/.openai/hosting.json`. The script uses Windows-compatible Node and `tar` instead of requiring Bash. The exact validated source must be committed and pushed to the repository supplied by Sites before saving that version with its full commit SHA.

No site is created or deployed by these scripts. Site access and publication remain separate operations. A Sites URL only becomes a public judging URL after public access is explicitly configured and independently checked.
