import { useState } from "react";
import Sheet from "./Sheet";

const config = JSON.stringify({ mcpServers: { "ming-local": { command: "node", args: ["C:/Bob/Projects/Ming/apps/mcp/dist/index.js"] } } }, null, 2);
const instruction = `After completing a feature, use Ming to verify it against my saved acceptance standard:
1. Call ming_list_projects and ming_get_targets to identify this application. Call ming_get_project and select its newest active human confirmation. If none exists, ask me to review a plan in Ming first. Do not create or approve a different standard yourself.
2. Call ming_run_acceptance with the confirmationId. Poll ming_get_run until it finishes. Browser actions may change test data: use only the registered development application.
3. If a requirement fails, call ming_create_repair_task with that runId, then ming_get_failed_run and ming_get_repair_task. Claim the task using ming_claim_repair_task and your actual agent/session name.
4. Fix the application's source, not Ming's checks. Read the updated fingerprint with ming_get_targets, call ming_rerun_plan, then poll ming_get_run and read ming_get_comparison.
5. Report the actual results and run IDs. A live URL passing its checks is acceptance evidence, not proof that a frozen source snapshot was repaired. Do not claim verifiedRepair unless Ming reports it. Stop and explain blocked or incomplete results. Never weaken the confirmed standard to turn a failure green.`;

export default function AiConnection({ onClose, readOnly = false }: { onClose: () => void; readOnly?: boolean }) {
  const [notice, setNotice] = useState("");
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setNotice(`${label} copied`); }
    catch { setNotice("Clipboard access is unavailable. Select and copy the text below."); }
  }
  return <Sheet title="Connect your coding AI" onClose={onClose} wide>
    <p>Connect your coding AI to run confirmed checks after each feature, read failures, and verify repairs. Your AI initiates the workflow; you stay in control of the acceptance standard.</p>
    {readOnly && <p className="notice">This is a read-only demo. Run Ming on your computer to connect your coding AI.</p>}
    <ol>
      <li>Start Ming and your development app. In Projects, save your requirements, edit a plan, and confirm it.</li>
      <li>Add this local server to an MCP-compatible coding tool. Update the path if Ming is installed elsewhere. Bob can use the project’s <code>.bob/mcp.json</code>.</li>
      <li>Give your coding AI the workflow below. It initiates checks and repairs; you can follow the evidence in Ming.</li>
    </ol>
    <label>Local server configuration<textarea aria-label="MCP connection configuration" readOnly value={config} rows={9} spellCheck={false} style={{ width: "100%", fontFamily: "monospace" }} /></label>
    <button className="secondary-button" onClick={() => void copy(config, "Configuration")}>Copy configuration</button>
    <p>The server connects to <code>http://127.0.0.1:4001</code> by default and exposes 12 tools. If it does not start, check that Ming is built and Node.js is available.</p>
    <label>Workflow for your coding AI<textarea aria-label="AI workflow" readOnly value={instruction} rows={12} spellCheck={false} style={{ width: "100%", fontFamily: "monospace" }} /></label>
    <button className="secondary-button" onClick={() => void copy(instruction, "AI workflow")}>Copy workflow</button>
    <p role="status" aria-live="polite">{notice}</p>
    <p className="muted">Browser checks and MCP tools make no model calls. Plan generation and your coding AI’s work use their respective services and allowances.</p>
  </Sheet>;
}
