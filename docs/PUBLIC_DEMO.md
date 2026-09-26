# Public demo and local application

Ming has two explicit modes. The local app runs real browser checks and exposes
MCP tools to a coding agent. The public demo is an interactive, read-only viewer
of reviewed real local runs. It does not connect to the visitor's computer or
pretend a replay is a new browser execution.

## Free hosting package

`render.yaml` selects Render's **Free** web service and `Dockerfile` builds the
same React app and API. No model API key or paid database is required. The
launcher seeds only `docs/demo-evidence/runtime`, never arbitrary local data.
The service rejects mutations in `MING_PUBLIC_DEMO=1` mode. Run this mode locally
before publishing to verify that screenshots, run history and comparisons load.

The published URL must be copied from the actual hosting dashboard after a
successful deployment. There is no deployed URL at the time this file is created.

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
