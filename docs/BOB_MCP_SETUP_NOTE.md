# Bob project MCP setup note

Verified: 2026-09-26. Research only; this note does not install or configure an MCP server. Use after Stage B.

## Project configuration and current UI

Open `C:\Bob\Projects\Ming` as the Bob workspace. The project configuration is `.bob/mcp.json`; its named servers override same-named global entries. The current global location is `~/.bob/settings/mcp.json`.

The installed Bob UI supports this route:

1. Open the command palette and run **Bob: Settings** (`bob-code.openSettings`), or use the Bob panel gear.
2. Select **MCP**, then **Add MCP server**.
3. Under **Configuration Scope**, select the Ming workspace.
4. Choose **Open Configuration File**.

The installed settings implementation opens or creates the selected workspace's `.bob/mcp.json`. Its MCP configuration watcher reloads saved changes while the workspace is open. Merge a new named entry into any existing `mcpServers` object; do not replace unrelated entries.

Older tutorials mention `mcp_settings.json` or a three-dot menu. Those are not the verified current UI/path above.

## Future STDIO example — adapter not built yet

STDIO is suitable for this local adapter: Bob starts it as a child process and exchanges MCP messages through stdin/stdout. The example entry point below is a **placeholder for a future build output**; this note does not assert that it exists or works. Use the actual output path after implementation.

```json
{
  "mcpServers": {
    "ming-local": {
      "command": "C:/Program Files/nodejs/node.exe",
      "args": ["C:/Bob/Projects/Ming/apps/mcp/dist/index.js"],
      "cwd": "C:/Bob/Projects/Ming",
      "disabled": false
    }
  }
}
```

`command`, `args`, and `cwd` are supported STDIO settings. No external model-provider API key is required for MCP transport or for an adapter that only calls Ming's deterministic local endpoints. Bob still uses its existing model account/Bobcoins; any separate model-dependent Ming feature retains its own requirements.

## Connection verification

After building the adapter and saving the real configuration, check the MCP panel for **Connected** and expand **Tools** to confirm the expected tool names and input schemas. Use **Refresh all servers** to refresh connections, or **Restart server** for the individual adapter when needed, including after rebuilding its executable. These controls reconnect servers; they do not implement or build the adapter. Verify one real read-only tool call in Bob before attempting state changes.

Suggested capabilities are reading failed-run evidence, retrieving/claiming a repair task, and requesting a rerun of the same plan. Suggested names are `ming_get_failed_run`, `ming_get_repair_task`, `ming_claim_repair_task`, and `ming_rerun_plan`; these are proposed contracts, not currently verified tools.

Keep normal tool approvals. Omit `alwaysAllow`; no global permission bypass is needed. Project scope controls where a server is registered, not its operating-system permissions: a local MCP child process runs with Bob's permissions. The adapter must enforce Ming-only paths, approved local service endpoints, and matching run/task/plan identifiers and plan fingerprints. It should not expose arbitrary filesystem paths or arbitrary command execution.

## Evidence

- [IBM: Using MCP in Bob](https://bob.ibm.com/docs/ide/configuration/mcp/mcp-in-bob) — project/global paths, STDIO schema, tool discovery, per-tool approval, local process permissions.
- [IBM: MCP server transports](https://bob.ibm.com/docs/ide/configuration/mcp/server-transports) — local STDIO lifecycle and transport behavior.
- Installed `C:\Bob\resources\app\extensions\bob-code\package.json` and `package.nls.json` — settings command ID/title.
- Installed `dist/web/assets/settings-Bbaq8ibE.js` and `index-B650KlTs.js` — current scope picker, configuration path construction, Connected/Tools and refresh/restart labels.
- Installed `dist/extension.js` — project MCP path and configuration file listeners.

Only public documentation and installed application code were inspected for this note; no credentials or unrelated task state were used.
