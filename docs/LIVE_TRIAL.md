# Live sample: execution and evidence boundary

Ming's `/#trial` route lets a visitor run acceptance checks immediately on the bundled Shipboard application. The existing `/#studio` recorded evidence and local project workflow remain separate.

## What happens on a run

1. A unique session opens the bundled same-origin sample in a browser frame.
2. Ming fills the task field, clicks its actual submit control, and reads the task list.
3. Ming reloads the frame and checks whether that same task survived.
4. An independent sample session checks empty and whitespace-only submissions.
5. The report retains actual observations, elapsed times, run identity and DOM-rendered captures. The report can be downloaded as JSON and failures copied into a repair brief.

The deliberately defective application omits persistence; no assertion is hard-coded to fail. The **prepared fix** selects the supplied implementation that saves and restores its own session's tasks. The same acceptance standard is then executed again with a new run identity. Applying this fix does not call a model, modify a repository or establish an autonomous AI repair. The original, separately recorded MCP repair by a coding assistant remains available in Evidence Studio; it was not performed by Bob.

## Capture and runtime limits

- Runs execute in the visitor's browser, not hosted Chromium. Browser storage must be available for the persistence check. Unsupported environments show an error or failed observation rather than substitute a stored result.
- Captures use html2canvas to render the current DOM into a PNG. They are labeled **DOM snapshots**; they are not native browser screenshots and may not reproduce every CSS feature exactly.
- Each run uses unique storage keys and removes only its own sample data. No global storage clearing or access to user project files occurs.
- Reports remain in page memory. Export evidence before reloading or leaving. Cancellation preserves completed observations in its report and does not claim unchecked criteria passed.
- Only the bundled trusted sample can be used. This route has no arbitrary URL, HTML upload, model credential or source-editing input.
- The hosted API remains read-only for historical records. The live trial requires no model calls, Bobcoins or local relay server.
- Passing three sample criteria does not establish general project correctness. For user-defined requirements and actual coding-agent repair, use the local Ming runner and MCP connection.

## Validation

`node scripts/review-live-trial.mjs` exercises the compiled hosted package in real Chromium. Its report and screenshots distinguish actual application observations from browser-automation checks of Ming itself. Existing judge evidence is checked independently and is never overwritten by trial runs.
