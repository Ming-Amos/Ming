import type { Application } from "express";
import type { RunRecord } from "@ming/contracts";
import fs from "node:fs";
import path from "node:path";

const esc = (v: unknown): string => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const markdownText = (v: unknown): string => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const text = (v: unknown): string => markdownText(v ?? "—").replace(/[\r\n|]/g, " ");
const status: Record<string,string> = { passed: "Passed", failed: "Failed", error: "Execution error", blocked: "Blocked", not_run: "Not run", skipped: "Skipped" };

export function mountRunReportRoutes(app: Application, options: { loadRun: (id: string) => RunRecord | null; screenshotsDir: string }): void {
  app.get("/api/run/:runId/report", (req, res) => {
    const id = req.params.runId;
    if (!/^[0-9a-f-]{36}$/.test(id)) { res.status(400).json({ ok: false, error: "Invalid run ID" }); return; }
    const run = options.loadRun(id);
    if (!run) { res.status(404).json({ ok: false, error: "This run was not found" }); return; }
    if (["pending", "running"].includes(run.status)) { res.status(409).json({ ok: false, error: "Wait for the run to finish or cancel it before exporting" }); return; }
    const format = req.query.format ?? "html";
    if (!["html", "json", "markdown"].includes(String(format))) { res.status(400).json({ ok: false, error: "Supported report formats: HTML, JSON, and Markdown" }); return; }
    const ext = format === "markdown" ? "md" : String(format);
    res.setHeader("Content-Disposition", `attachment; filename="ming-${id}.${ext}"`);
    res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Content-Type-Options", "nosniff");
    const scope = run.sourceBinding === "self-contained-html-snapshot" ? "HTML document snapshot. Features outside the registered criteria are not covered." : run.sourceBinding === "live-url-observed" ? "Live website observation. Source, backend, and external state are not frozen; this does not establish source-level repair provenance." : "This historical record does not separately identify its source scope. Interpret it using the original run and repair comparison evidence without extending its conclusions.";
    if (format === "json") { res.type("application/json").send(JSON.stringify({ exportedAt: new Date().toISOString(), scope, run }, null, 2)); return; }
    if (format === "markdown") {
      const lines = ["# Ming Acceptance Report", "", `Result: ${status[run.status] ?? run.status}`, `Run: ${run.runId}`, `Target: ${text(run.targetUrl)}`, `Time: ${run.startedAt} — ${run.finishedAt}`, `Plan fingerprint: ${run.planFingerprint}`, "", `Scope: ${scope}`, "", "## Original requirements", "", markdownText(run.planSnapshot?.originalRequirement ?? "Preset example acceptance criteria."), ""];
      if (run.fatalError) lines.push(`Execution note: ${markdownText(run.fatalError)}`, "");
      for (const criterion of run.criteria) {
        lines.push(`## ${text(criterion.criteriaId)} · ${text(criterion.title)}`, `Status: ${status[criterion.status] ?? criterion.status}`, "", "| Step | Result | Expected | Observed |", "| --- | --- | --- | --- |");
        for (const step of criterion.steps) lines.push(`| ${text(step.description)} | ${status[step.status] ?? step.status} | ${text(step.expected)} | ${text(step.actual ?? step.error)} |`);
        lines.push("");
      }
      lines.push("Screenshots are retained in the original run; the HTML report embeds selected originals. Passing the registered criteria does not mean the whole product is free of defects.");
      res.type("text/markdown; charset=utf-8").send(lines.join("\n")); return;
    }
    const captured = new Set<string>(); let embeddedBytes = 0;
    const sections = run.criteria.map(criterion => {
      const rows = criterion.steps.map(s => `<tr><td>${esc(s.description)}</td><td>${esc(status[s.status] ?? s.status)}</td><td>${esc(s.expected)}</td><td>${esc(s.actual ?? s.error)}</td></tr>`).join("");
      const pictures: string[] = [];
      for (const s of criterion.steps) {
        const name = s.screenshotPath;
        if (!name || captured.has(name) || captured.size >= 12 || !/^[A-Za-z0-9_-]+\.png$/.test(name) || !name.startsWith(run.runId + "_")) continue;
        const filename = path.join(options.screenshotsDir, name);
        try {
          const stat = fs.statSync(filename);
          if (!stat.isFile() || stat.size > 2_000_000 || embeddedBytes + stat.size > 12_000_000) continue;
          const bytes = fs.readFileSync(filename); captured.add(name); embeddedBytes += bytes.length;
          pictures.push(`<figure><img src="data:image/png;base64,${bytes.toString("base64")}" alt="${esc(s.description)}"><figcaption>${esc(s.stepId)} · Original browser capture; password and other sensitive input fields are masked</figcaption></figure>`);
        } catch { pictures.push("<p>The original screenshot is unavailable. No substitute image is supplied.</p>"); }
      }
      return `<section><h2>${esc(criterion.criteriaId)} · ${esc(criterion.title)}</h2><p>${esc(status[criterion.status] ?? criterion.status)} ${esc(criterion.blockedReason)}</p><table><thead><tr><th>Step</th><th>Result</th><th>Expected</th><th>Observed</th></tr></thead><tbody>${rows}</tbody></table>${pictures.join("")}</section>`;
    }).join("");
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
    res.type("text/html").send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Ming Acceptance Report</title><style>body{max-width:1040px;margin:36px auto;padding:0 24px;font:16px/1.6 system-ui,sans-serif;color:#182438;background:#fafaf8}h1{font-family:Georgia,serif}section{background:white;border:1px solid #dce2e9;border-radius:12px;margin:24px 0;padding:22px}p,td,pre{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #dce2e9;padding:10px;text-align:left}img{max-width:100%;height:auto}figure{margin:18px 0}figcaption,footer{font-size:13px;color:#526074}pre{white-space:pre-wrap}@media print{section,figure{break-inside:avoid}}</style><h1>Ming · Acceptance Report</h1><p><strong>${esc(status[run.status] ?? run.status)}</strong> · ${esc(run.runId)}</p><p>Target: ${esc(run.targetUrl)}<br>Time: ${esc(run.startedAt)} — ${esc(run.finishedAt)}<br>Plan fingerprint: ${esc(run.planFingerprint)}</p><p>${esc(scope)}</p>${run.fatalError ? `<p>${esc(run.fatalError)}</p>` : ""}<section><h2>Requirement source</h2><pre>${esc(run.planSnapshot?.originalRequirement ?? "Preset example acceptance criteria")}</pre></section>${sections}<footer>This report embeds up to 12 original screenshots, totaling at most 12 MB. Passing registered criteria does not establish that the entire product is defect-free. This report was not uploaded to an external service.</footer></html>`);
  });
}
