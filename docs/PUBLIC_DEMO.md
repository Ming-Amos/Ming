# Public demo and local application

Ming's hosted frontend offers an own-project static upload workspace (`/#upload`),
a fresh bundled browser sample (`/#trial`), and a read-only viewer of reviewed
local runs (`/#studio`). Upload and sample checks execute in the visitor's browser;
the hosted server APIs remain read-only. The local app additionally runs Playwright
and exposes MCP tools to a coding agent. Recorded playback is identified separately
from fresh execution. See [uploaded-project workflow](UPLOADED_PROJECTS.md).

## Free hosting package

The Sites viewer was successfully deployed on 2026-09-26 at
https://ming-acceptance-proof.amosming.chatgpt.site . Its current audience is
owner-private, pending an explicit public-access decision. This is a working
private preview, not yet a public judging link. The packaged Worker serves the
allowlisted recorded responses and screenshots; it cannot invoke a browser or model.

## Alternative Render package

`render.yaml` selects Render's **Free** web service and `Dockerfile` builds the
same React app and API. No model API key or paid database is required. The
launcher seeds only `docs/demo-evidence/runtime`, never arbitrary local data.
The service rejects mutations in `MING_PUBLIC_DEMO=1` mode. Run this mode locally
before publishing to verify that screenshots, run history and comparisons load.

The Render package has not been deployed or Docker-build-tested. Use the actual
Sites preview above for the prepared remote viewer; do not claim a Render URL.

Render's free web services sleep after 15 minutes of inactivity and may take
about a minute to wake. Their filesystem is ephemeral. Bundling selected evidence
allows the viewer to rebuild it after each restart. Monthly quotas still apply.
Do not upgrade the plan or add paid storage to publish this viewer.

Source checked 2026-09-26: https://render.com/docs/free

## Full local experience

Use `pnpm install`, `pnpm --filter @ming/runner exec playwright install chromium`,
`pnpm build`, then `pnpm start`. Keep `MING_PUBLIC_DEMO` unset. The server serves
the built UI and sample targets together at http://127.0.0.1:4001.

Model generation requires a compatible API configured in `apps/server/.env`.
Without credentials, reviewed built-in sample plans still execute real checks.
The normal app does not silently replace model generation with a fixture.

MCP is local and deliberately fixed to port 4001. A public URL is not a remote
code-editing service. See `docs/MCP_SETUP.md` for the actual agent workflow.
