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
    try { await navigator.clipboard.writeText(text); setNotice(`${label}已复制`); }
    catch { setNotice("浏览器未允许复制，请在下方文本框中全选复制。"); }
  }
  return <Sheet title="让编码 AI 调用 Ming" onClose={onClose} wide>
    <p>首次连接后，编码 AI 可以在每次完成开发时调用已确认的检查，读取失败证据，再修复和复验。Ming 本身不会唤醒另一位 AI，也不会替你同意新的验收标准。</p>
    {readOnly && <p className="notice">这是只读演示。请在本机启动 Ming 后连接，线上页面不能控制你的电脑。</p>}
    <ol>
      <li>启动 Ming 和你的开发网站，在「我的项目」保存需求、编辑计划并确认。</li>
      <li>在支持 MCP 的编码工具里添加下面的本地服务。路径对应当前电脑；换电脑后需修改为实际安装路径。Bob 可使用项目里的 <code>.bob/mcp.json</code>。</li>
      <li>将下面的英文工作说明交给编码 AI。检查和修复操作由该 AI 发起；你仍可在网页查看进度。</li>
    </ol>
    <label>本地服务配置<textarea aria-label="MCP 连接配置" readOnly value={config} rows={9} spellCheck={false} style={{ width: "100%", fontFamily: "monospace" }} /></label>
    <button className="secondary-button" onClick={() => void copy(config, "连接配置")}>复制连接配置</button>
    <p>服务默认连接 <code>http://127.0.0.1:4001</code>，提供 12 个工具。启动失败时先确认已构建项目，且本机可以运行 Node.js。</p>
    <label>给编码 AI 的工作说明<textarea aria-label="AI 工作说明" readOnly value={instruction} rows={12} spellCheck={false} style={{ width: "100%", fontFamily: "monospace" }} /></label>
    <button className="secondary-button" onClick={() => void copy(instruction, "AI 工作说明")}>复制英文工作说明</button>
    <p role="status" aria-live="polite">{notice}</p>
    <p className="muted">Ming 的浏览器检查和 MCP 工具不调用大模型。生成验收草稿，以及编码 AI 自己分析和修复代码，按各自服务的用量计费。</p>
  </Sheet>;
}
