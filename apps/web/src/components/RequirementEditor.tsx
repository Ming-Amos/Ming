import { useState } from "react";
import {
  ArrowRight,
  CircleNotch,
  DownloadSimple,
  FileArrowUp,
  FloppyDisk,
  PencilSimple,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import type { DraftRecord, ProjectRecord, RequirementRecord } from "../types";
import { api, downloadText } from "../lib/api";
import Sheet from "./Sheet";

export default function RequirementEditor({
  project,
  requirement,
  onClose,
  onSaved,
  onDraft,
  onManual,
  onConfigureModel,
  providerConfigured,
  readOnly,
}: {
  project: ProjectRecord;
  requirement: RequirementRecord | null;
  onClose: () => void;
  onSaved: (requirement: RequirementRecord) => void;
  onDraft: (draft: DraftRecord) => void;
  onManual: (requirement: RequirementRecord) => void;
  onConfigureModel: () => void;
  providerConfigured: boolean;
  readOnly: boolean;
}) {
  // An unfinished edit belongs to the requirement version it was based on.
  // A later version saved by another browser or coding agent must stay visible.
  const storageKey = `ming.requirement-editor.${project.projectId}.${requirement?.requirementId || "new"}`;
  const [text, setText] = useState(() => {
    if (readOnly) return requirement?.text || "";
    try {
      return localStorage.getItem(storageKey) ?? requirement?.text ?? "";
    } catch {
      return requirement?.text || "";
    }
  });
  const [saved, setSaved] = useState(requirement);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function edit(value: string) {
    setText(value);
    setNotice("");
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      /* Current draft stays available. */
    }
  }
  async function save() {
    if (!text.trim()) throw new Error("Describe the feature you want to check first.");
    if (text.length > 20_000)
      throw new Error("Requirements can contain up to 20,000 characters. Split larger documents by feature.");
    if (saved?.text === text.trim()) {
      try { localStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
      return saved;
    }
    const response = await api<{ requirement: RequirementRecord }>(
      `/api/projects/${project.projectId}/requirements`,
      { text: text.trim() },
    );
    setSaved(response.requirement);
    setText(response.requirement.text);
    try { localStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
    onSaved(response.requirement);
    return response.requirement;
  }
  async function action(kind: "save" | "generate" | "manual") {
    if (busy || readOnly) return;
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      const record = await save();
      if (kind === "save")
        setNotice(`Requirements v${record.version} saved. You can return to them next time.`);
      else if (kind === "manual") onManual(record);
      else {
        const { draft } = await api<{ draft: DraftRecord }>("/api/generate", {
          requirementId: record.requirementId,
        });
        onDraft(draft);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!/\.(md|txt)$/i.test(file.name)) {
      setError("Upload a .md or .txt file.");
      return;
    }
    if (file.size > 100_000) {
      setError("This file is too large. Include only the requirements for this feature.");
      return;
    }
    const value = await file.text();
    if (value.length > 20_000) {
      setError("Requirements can contain up to 20,000 characters. Split larger documents by feature.");
      return;
    }
    edit(value);
    setNotice(`Imported ${file.name}. Save to keep this version.`);
  }
  return (
    <Sheet
      title={readOnly ? "Project requirements" : "Edit requirements"}
      wide
      onClose={onClose}
      locked={!!busy}
    >
      <p className="sheet-lead">
        <strong>{project.name}</strong> ·
        Describe the user goal, what success looks like, and which inputs should be rejected.
      </p>
      <div className="requirement-file-actions">
        {!readOnly && (
          <label className="secondary-button upload-button">
            <FileArrowUp size={17} />
            Import PRD
            <input
              type="file"
              accept=".md,.txt,text/plain,text/markdown"
              disabled={!!busy}
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </label>
        )}
        <button
          className="secondary-button"
          disabled={!text}
          onClick={() =>
            downloadText(
              `${project.name}-requirements.md`,
              text,
              "text/markdown;charset=utf-8",
            )
          }
        >
          <DownloadSimple size={17} />
          Export requirements
        </button>
        <span>{text.length.toLocaleString("en-GB")} / 20,000</span>
      </div>
      <label className="field">
        Requirements and boundaries
        <textarea
          aria-label="Requirements and boundaries"
          className="prd-editor"
          rows={11}
          value={text}
          onChange={(e) => edit(e.target.value)}
          readOnly={readOnly}
          disabled={!!busy}
          placeholder={
            "Example:\nAfter entering a task name and clicking Add, the new task appears in the list.\nThe task remains after reloading.\nA blank name must not create a task and should show a clear message."
          }
        />
      </label>
      {error && (
        <div className="message error-message" role="alert">
          <WarningCircle size={19} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="message notice-message" role="status">
          {notice}
        </div>
      )}
      {!readOnly && (
        <>
          <div className="requirement-main-actions">
            <button
              className="secondary-button"
              disabled={!!busy || !text.trim()}
              onClick={() => void action("save")}
            >
              <FloppyDisk size={17} />
              {busy === "save" ? "Saving…" : "Save requirements"}
            </button>
            <button
              className="primary-button"
              disabled={!!busy || !text.trim()}
              onClick={() => void action("generate")}
            >
              {busy === "generate" ? (
                <CircleNotch className="spin" size={17} />
              ) : (
                <Sparkle size={17} />
              )}
              {busy === "generate" ? "Generating…" : "Generate a plan with AI"}
            </button>
          </div>
          {!providerConfigured && (
            <p className="model-inline-note">
              No model connected yet.{" "}
              <button onClick={onConfigureModel} disabled={!!busy}>
                Connect a model
              </button>
               or write your own plan.
            </p>
          )}
          <button
            className="manual-alternative"
            disabled={!!busy || !text.trim()}
            onClick={() => void action("manual")}
          >
            <PencilSimple size={18} />
            <span>
              <strong>Write my own plan</strong>
              <small>
                Build steps and assertions without an API key or test code.
              </small>
            </span>
            <ArrowRight size={19} />
          </button>
        </>
      )}
    </Sheet>
  );
}
