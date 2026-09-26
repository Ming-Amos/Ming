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
      .then(async response => { if (!response.ok) throw new Error("Unable to load model settings. Check that your local Ming service is running."); return response.json() as Promise<Reply>; })
      .then(data => { if (!controller.signal.aborted) { if (!data.status) throw new Error("Invalid model settings response."); applyStatus(data.status); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load model settings."); })
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
      if (!response.ok || data.ok === false) throw new Error(data.error || data.message || "Could not complete this action. Check your model configuration.");
      setMessage(action === "saving" ? data.status?.configured ? "Configuration saved locally and ready to use. Saving made no model call." : "Configuration saved locally. Add an API key to connect. Saving made no model call." : action === "clearing" ? "Local configuration and saved key deleted." : data.message || "Connection successful.");
      onSaved?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "This action failed. Try again shortly."); }
    finally { setBusy(null); }
  }
  const lastTest = status?.lastTest;
  const usage = status?.usageSummary;
  return <dialog ref={dialog} className="sheet" aria-labelledby="provider-settings-title" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="sheet-heading"><h2 id="provider-settings-title">Connect your model</h2><button type="button" className="icon-button" aria-label="Close model settings" disabled={!!busy} onClick={onClose}><X size={21} /></button></div>
    <div className="sheet-content">
      <p className="sheet-lead">A model turns requirements into a draft plan. A browser runs the checks. You can also write a plan manually without connecting a model.</p>
      {locked ? <div className="info-box"><Info size={21} /><p>This demo is read-only. Run Ming locally to save a key and connect a model.</p></div> : <>
        <div className="info-box"><Key size={21} /><p>Use a Chat Completions compatible API. Your key stays in the local runtime folder; it is never sent back to this page or added to the repository. Saving makes no model call.</p></div>
        {environment && <div className="inline-warning">Server environment settings are active. To configure the model here, remove the server’s PROVIDER_* environment settings and restart. Delete only clears settings previously saved here.</div>}
        <form onSubmit={event => { event.preventDefault(); void perform("saving"); }}>
          <label className="field">Provider name<input value={providerLabel} onChange={event => setLabel(event.target.value)} disabled={disabled} maxLength={100} required placeholder="e.g. My model service" autoComplete="off" /></label>
          <label className="field">API base URL<input type="url" value={baseUrl} onChange={event => setBaseUrl(event.target.value)} disabled={disabled} maxLength={2048} required placeholder="https://api.example.com/v1" autoComplete="off" spellCheck={false} /></label>
          <p className="field-help">Enter your provider’s API base URL, including /v1 if required. Ming appends /chat/completions. Remote endpoints require HTTPS; local models may use HTTP.</p>
          <label className="field">Model ID<input value={modelId} onChange={event => setModelId(event.target.value)} disabled={disabled} maxLength={200} required placeholder="Enter the exact model ID from your provider" autoComplete="off" spellCheck={false} /></label>
          <label className="field">API Key<input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} disabled={disabled} maxLength={8192} placeholder={status?.hasKey ? "Key saved. Leave blank to keep it, or enter a replacement." : "Paste your API key"} autoComplete="new-password" spellCheck={false} /></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button type="submit" className="primary-button" disabled={disabled || !baseUrl.trim() || !modelId.trim()}>{busy === "saving" && <CircleNotch className="spin" size={16} />}Save settings</button>
            <button type="button" className="secondary-button" disabled={!!busy || !status?.configured || changed} onClick={() => void perform("testing")}>{busy === "testing" && <CircleNotch className="spin" size={16} />}{busy === "testing" ? "Testing, up to 10 seconds…" : "Test connection"}</button>
            <button type="button" className="secondary-button" disabled={!!busy || !status || (!status.keyStored && status.configSource !== "local")} onClick={() => void perform("clearing")}>Delete local settings and key</button>
          </div>
          <p className="field-help" style={{ marginTop: 12 }}>Testing makes one model call with a maximum of 8 output tokens. Your provider may charge for it. {changed && "Save your changes before testing. "} No automatic retries.</p>
        </form>
      </>}
      {busy === "loading" && <p role="status">Loading settings…</p>}
      {message && <div className="info-box" role="status"><CheckCircle size={20} /><p>{message}</p></div>}
      {error && <div className="inline-warning" role="alert">{error}</div>}
      {status?.storageWarning && <div className="inline-warning" role="alert">{status.storageWarning}</div>}
      {!locked && lastTest && <div className={`info-box ${lastTest.ok ? "" : "warning-box"}`}>
        {lastTest.ok ? <CheckCircle size={20} /> : <WarningCircle size={20} />}<div><strong>{lastTest.ok ? "Last connection succeeded" : "Last connection failed"}</strong><p>{lastTest.message}<br />{new Date(lastTest.testedAt).toLocaleString("en-GB")} · {lastTest.durationMs} ms<br />Input / output tokens: {lastTest.inputTokens ?? "Not reported"} / {lastTest.outputTokens ?? "Not reported"}</p></div>
      </div>}
      {!locked && usage && <div className="scope-note"><strong>Local model usage</strong><p>Showing {usage.retainedCalls} calls (up to {usage.retentionLimit} retained): {usage.generationCalls} plan generations, {usage.connectionTestCalls} connection tests, and {usage.failedCalls} failures.<br />Reported usage: {usage.knownInputTokens} input / {usage.knownOutputTokens} output tokens. {usage.callsWithUnreportedTokens > 0 && `Usage was not fully reported for ${usage.callsWithUnreportedTokens} calls.`}<br />For costs, refer to your provider’s bill.</p></div>}
    </div>
  </dialog>;
}
