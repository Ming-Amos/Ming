import type { Application } from "express";
import type { RunRecord } from "@ming/contracts";
import fs from "node:fs";
import path from "node:path";

const esc = (v: unknown): string => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const markdownText = (v: unknown): string => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const text = (v: unknown): string => markdownText(v ?? "—").replace(/[\r\n|]/g, " ");
const status: Record<string,string> = { passed: "通过", failed: "未通过", error: "执行异常", blocked: "前置阻塞", not_run: "未执行", skipped: "已跳过" };

export function mountRunReportRoutes(app: Application, options: { loadRun: (id: string) => RunRecord | null; screenshotsDir: string }): void {
  app.get("/api/run/:runId/report", (req, res) => {
    const id = req.params.runId;
    if (!/^[0-9a-f-]{36}$/.test(id)) { res.status(400).json({ ok: false, error: "运行编号无效" }); return; }
    const run = options.loadRun(id);
    if (!run) { res.status(404).json({ ok: false, error: "未找到这次运行" }); return; }
    if (["pending", "running"].includes(run.status)) { res.status(409).json({ ok: false, error: "请等待运行结束或取消后导出" }); return; }
    const format = req.query.format ?? "html";
    if (!["html", "json", "markdown"].includes(String(format))) { res.status(400).json({ ok: false, error: "支持 HTML、JSON 和 Markdown 报告" }); return; }
    const ext = format === "markdown" ? "md" : String(format);
    res.setHeader("Content-Disposition", `attachment; filename="ming-${id}.${ext}"`);
    res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Content-Type-Options", "nosniff");
    const scope = run.sourceBinding === "self-contained-html-snapshot" ? "HTML 文档快照；不覆盖未登记的其他功能。" : run.sourceBinding === "live-url-observed" ? "实时网站观察；源码、后端与外部状态未被冻结，不能据此证明源码修复归属。" : "历史记录未单独标记来源范围；请结合原始运行与修复比较中的证据判断，不扩大验收结论。";
    if (format === "json") { res.type("application/json").send(JSON.stringify({ exportedAt: new Date().toISOString(), scope, run }, null, 2)); return; }
    if (format === "markdown") {
      const lines = ["# Ming 验收报告", "", `结果：${status[run.status] ?? run.status}`, `运行：${run.runId}`, `目标：${text(run.targetUrl)}`, `时间：${run.startedAt} — ${run.finishedAt}`, `标准指纹：${run.planFingerprint}`, "", `范围：${scope}`, "", "## 原始需求", "", markdownText(run.planSnapshot?.originalRequirement ?? "使用预置示例验收标准。"), ""];
      if (run.fatalError) lines.push(`执行说明：${markdownText(run.fatalError)}`, "");
      for (const criterion of run.criteria) {
        lines.push(`## ${text(criterion.criteriaId)} · ${text(criterion.title)}`, `状态：${status[criterion.status] ?? criterion.status}`, "", "| 步骤 | 结果 | 预期 | 实际 |", "| --- | --- | --- | --- |");
        for (const step of criterion.steps) lines.push(`| ${text(step.description)} | ${status[step.status] ?? step.status} | ${text(step.expected)} | ${text(step.actual ?? step.error)} |`);
        lines.push("");
      }
      lines.push("截图保存在原始运行中；HTML 报告包含选取的原始截图。通过已登记标准不代表整个产品不存在缺陷。");
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
          pictures.push(`<figure><img src="data:image/png;base64,${bytes.toString("base64")}" alt="${esc(s.description)}"><figcaption>${esc(s.stepId)} · 原始浏览器截图；密码等敏感输入框已遮盖</figcaption></figure>`);
        } catch { pictures.push("<p>原始截图文件不可用；该项不以替代图片补充。</p>"); }
      }
      return `<section><h2>${esc(criterion.criteriaId)} · ${esc(criterion.title)}</h2><p>${esc(status[criterion.status] ?? criterion.status)} ${esc(criterion.blockedReason)}</p><table><thead><tr><th>步骤</th><th>结果</th><th>预期</th><th>实际</th></tr></thead><tbody>${rows}</tbody></table>${pictures.join("")}</section>`;
    }).join("");
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
    res.type("text/html").send(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Ming 验收报告</title><style>body{max-width:1040px;margin:36px auto;padding:0 24px;font:16px/1.6 system-ui,sans-serif;color:#182438;background:#fafaf8}h1{font-family:Georgia,serif}section{background:white;border:1px solid #dce2e9;border-radius:12px;margin:24px 0;padding:22px}p,td,pre{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #dce2e9;padding:10px;text-align:left}img{max-width:100%;height:auto}figure{margin:18px 0}figcaption,footer{font-size:13px;color:#526074}pre{white-space:pre-wrap}@media print{section,figure{break-inside:avoid}}</style><h1>Ming · 验收报告</h1><p><strong>${esc(status[run.status] ?? run.status)}</strong> · ${esc(run.runId)}</p><p>目标：${esc(run.targetUrl)}<br>时间：${esc(run.startedAt)} — ${esc(run.finishedAt)}<br>标准指纹：${esc(run.planFingerprint)}</p><p>${esc(scope)}</p>${run.fatalError ? `<p>${esc(run.fatalError)}</p>` : ""}<section><h2>需求依据</h2><pre>${esc(run.planSnapshot?.originalRequirement ?? "预置示例验收标准")}</pre></section>${sections}<footer>报告包含最多 12 张、总计不超过 12 MB 的原始截图。通过已登记标准不代表整个产品不存在缺陷。此报告未上传到外部服务。</footer></html>`);
  });
}
