# Codex provider review during Stage B

2026-09-26. Review notes, not implementation. Complete these before provider acceptance; avoid rewriting unrelated work.

1. **Secret redaction:** `provider/openai-transport.ts` currently puts HTTP response bodies into `usage.errorMessage`. Providers can echo credentials. Sanitize every error and parse exception before return, persistence or logging; prefer safe status/category text. Reject/sanitize credentials or query secrets in displayed provider URLs. Test a response that echoes the configured fake API key and verify no returned or stored usage contains it.
2. **Hard overall timeout:** `req.setTimeout` covers socket inactivity, not a continuously trickling response. Add a bounded wall-clock deadline for the entire invocation, destroy the request and clear the timer on every terminal path. Keep the existing response-byte cap. Focused tests should cover trickling responses and oversized responses as well as the ordinary timeout.
3. **API root and provenance:** Do not blindly append `/v1/chat/completions`: support an explicitly documented API root such as `https://host/v1` or `https://host/compatible-mode/v1`, normalize trailing slashes and append the endpoint exactly once. Mark test HTTP transport as test explicitly in trusted server configuration; it currently hardcodes `live` and `isLive: true`. The model must not control provenance. Preserve test/live distinction in plan, usage, saved records and webpage. Update `.env.example` to match implemented URL semantics.

The user has not selected a provider or supplied a key. Fixture-transport tests prove protocol handling, not live model quality.
