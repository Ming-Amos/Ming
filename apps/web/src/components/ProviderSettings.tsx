import { useEffect, useRef, useState } from "react";
import { X, Key, Info, CheckCircle, WarningCircle, CircleNotch } from "@phosphor-icons/react";

interface TestResult { ok: boolean; testedAt: string; durationMs: number; message: string; inputTokens: number | null; outputTokens: number | null }
interface ProviderState {
  configured: boolean; providerLabel: string; baseUrl: string; modelId: string; missingFields: string[];
  hasKey?: boolean; keyStored?: boolean; configSource?: "environment" | "local" | "none"; environmentOverride?: boolean; readOnly?: boolean;
  lastTest?: TestResult; storageWarning?: string;
  usageSummary?: { retainedCalls: number; successfulCalls: number; failedCalls: number; generationCalls: number; connectionTestCalls: number;
    knownInputTokens: number; knownOutputTokens: number; callsWithUnreportedTokens: number; retentionLimit: number };
}
interface Reply { status?: ProviderState; ok?: boolean; error?: string; message?: string }
const cleanField = (value?: string) => !value || value.startsWith("(") ? "" : value;

export default function ProviderSettings({ open, onClose, onSaved, readOnly = false }: {
  open: boolean; onClose: () => void; onSaved?: () => void; readOnly?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<ProviderState | null>(null);
  const [providerLabel, setLabel] = useState("OpenAI-compatible"), [baseUrl, setBaseUrl] = useState(""), [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState(""), [busy, setBusy] = useState<"loading" | "saving" | "testing" | "clearing" | null>(null);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  function applyStatus(next: ProviderState) {
    setStatus(next); setLabel(next.configSource === "none" ? "OpenAI-compatible" : cleanField(next.providerLabel) || "OpenAI-compatible");
    setBaseUrl(cleanField(next.baseUrl)); setModelId(cleanField(next.modelId)); setApiKey("");
  }
  useEffect(() => {
    const element = dialog.current;
    if (!open) { element?.close(); setApiKey(""); return; }
    if (element && !element.open) element.showModal();
    const controller = new AbortController();
    setBusy("loading"); setError(""); setMessage(""); setStatus(null); setApiKey("");
    fetch("/api/provider/status", { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error("无法读取模型设置，请检查本地 Ming 服务。"); return response.json() as Promise<Reply>; })
      .then(data => { if (!controller.signal.aborted) { if (!data.status) throw new Error("模型设置响应无效。"); applyStatus(data.status); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "无法读取模型设置。"); })
      .finally(() => { if (!controller.signal.aborted) setBusy(null); });
    return () => { controller.abort(); element?.close(); };
  }, [open]);
  const locked = readOnly || status?.readOnly === true;
  const environment = status?.environmentOverride === true;
  const changed = !!status && (providerLabel.trim() !== (status.configSource === "none" ? "OpenAI-compatible" : cleanField(status.providerLabel) || "OpenAI-compatible") || baseUrl.trim().replace(/\/+$/, "") !== cleanField(status.baseUrl).replace(/\/+$/, "") || modelId.trim() !== cleanField(status.modelId) || !!apiKey.trim());
  const disabled = !!busy || locked || environment || !status;
  async function perform(action: "saving" | "testing" | "clearing") {
    if (busy || locked) return;
    setBusy(action); setMessage(""); setError("");
    try {
      const response = await fetch(action === "testing" ? "/api/provider/test" : "/api/provider/config", {
        method: action === "testing" ? "POST" : action === "clearing" ? "DELETE" : "PUT",
        headers: action === "saving" ? { "Content-Type": "application/json" } : undefined,
        body: action === "saving" ? JSON.stringify({ providerLabel, baseUrl, modelId, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) }) : undefined,
      });
      const data = await response.json() as Reply;
      if (data.status) applyStatus(data.status);
      if (!response.ok || data.ok === false) throw new Error(data.error || data.message || "操作未完成，请检查模型配置。");
      setMessage(action === "saving" ? data.status?.configured ? "配置已保存在本机并立即生效。保存未调用模型。" : "配置已保存在本机。还需要填写 API Key 才能连接模型；保存未调用模型。" : action === "clearing" ? "本地配置和保存的密钥已删除。" : data.message || "连接成功。");
      onSaved?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败，请稍后重试。"); }
    finally { setBusy(null); }
  }
  const lastTest = status?.lastTest;
  const usage = status?.usageSummary;
  return <dialog ref={dialog} className="sheet" aria-labelledby="provider-settings-title" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="sheet-heading"><h2 id="provider-settings-title">连接你的模型</h2><button type="button" className="icon-button" aria-label="关闭模型设置" disabled={!!busy} onClick={onClose}><X size={21} /></button></div>
    <div className="sheet-content">
      <p className="sheet-lead">模型把需求整理成验收草稿；执行检查由浏览器完成。暂不连接模型，也可以手动编写验收计划。</p>
      {locked ? <div className="info-box"><Info size={21} /><p>这是只读演示，不能保存密钥或调用模型。请在本地运行 Ming 后配置。</p></div> : <>
        <div className="info-box"><Key size={21} /><p>支持 Chat Completions 兼容接口。密钥仅保存在本机运行目录，不会返回到页面或写入项目仓库。保存配置不会调用模型。</p></div>
        {environment && <div className="inline-warning">当前使用服务器环境变量中的配置。界面不会覆盖它；如需改用界面配置，请先移除服务器的 PROVIDER_* 环境配置并重启。删除按钮仅清除之前在界面保存的配置。</div>}
        <form onSubmit={event => { event.preventDefault(); void perform("saving"); }}>
          <label className="field">提供商名称<input value={providerLabel} onChange={event => setLabel(event.target.value)} disabled={disabled} maxLength={100} required placeholder="例如：我的模型服务" autoComplete="off" /></label>
          <label className="field">API 地址<input type="url" value={baseUrl} onChange={event => setBaseUrl(event.target.value)} disabled={disabled} maxLength={2048} required placeholder="https://你的服务地址/v1" autoComplete="off" spellCheck={false} /></label>
          <p className="field-help">填写服务商提供的 API 根地址，包括需要的 /v1 等路径。Ming 会在后面添加 /chat/completions。远程地址须使用 HTTPS，本机模型可用 HTTP。</p>
          <label className="field">模型 ID<input value={modelId} onChange={event => setModelId(event.target.value)} disabled={disabled} maxLength={200} required placeholder="填写服务商的准确模型 ID" autoComplete="off" spellCheck={false} /></label>
          <label className="field">API Key<input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} disabled={disabled} maxLength={8192} placeholder={status?.hasKey ? "已保存密钥；留空保留，填写可替换" : "在此粘贴密钥"} autoComplete="new-password" spellCheck={false} /></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button type="submit" className="primary-button" disabled={disabled || !baseUrl.trim() || !modelId.trim()}>{busy === "saving" && <CircleNotch className="spin" size={16} />}保存配置</button>
            <button type="button" className="secondary-button" disabled={!!busy || !status?.configured || changed} onClick={() => void perform("testing")}>{busy === "testing" && <CircleNotch className="spin" size={16} />}{busy === "testing" ? "测试中，最长 10 秒…" : "测试连接"}</button>
            <button type="button" className="secondary-button" disabled={!!busy || !status || (!status.keyStored && status.configSource !== "local")} onClick={() => void perform("clearing")}>删除本地配置与密钥</button>
          </div>
          <p className="field-help" style={{ marginTop: 12 }}>测试连接会真实调用一次模型，请求最多 8 个输出 token，可能按服务商规则产生少量费用。{changed && "请先保存更改，再测试。"} 不会自动重试。</p>
        </form>
      </>}
      {busy === "loading" && <p role="status">正在读取设置…</p>}
      {message && <div className="info-box" role="status"><CheckCircle size={20} /><p>{message}</p></div>}
      {error && <div className="inline-warning" role="alert">{error}</div>}
      {status?.storageWarning && <div className="inline-warning" role="alert">{status.storageWarning}</div>}
      {!locked && lastTest && <div className={`info-box ${lastTest.ok ? "" : "warning-box"}`}>
        {lastTest.ok ? <CheckCircle size={20} /> : <WarningCircle size={20} />}<div><strong>{lastTest.ok ? "最近一次连接成功" : "最近一次连接失败"}</strong><p>{lastTest.message}<br />{new Date(lastTest.testedAt).toLocaleString("zh-CN")} · {lastTest.durationMs} ms<br />输入 / 输出 token：{lastTest.inputTokens ?? "服务商未返回"} / {lastTest.outputTokens ?? "服务商未返回"}</p></div>
      </div>}
      {!locked && usage && <div className="scope-note"><strong>本机调用记录</strong><p>最近最多 {usage.retentionLimit} 次调用，当前 {usage.retainedCalls} 次：计划生成 {usage.generationCalls} 次，连接测试 {usage.connectionTestCalls} 次，失败 {usage.failedCalls} 次。<br />服务商已返回的用量：输入 {usage.knownInputTokens} / 输出 {usage.knownOutputTokens} token。{usage.callsWithUnreportedTokens > 0 && `另有 ${usage.callsWithUnreportedTokens} 次调用未返回完整用量。`}<br />这里不估算金额；具体费用以服务商账单为准。</p></div>}
    </div>
  </dialog>;
}
