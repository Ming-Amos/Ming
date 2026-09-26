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
  const storageKey = `ming.requirement-editor.${project.projectId}`;
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
    if (!text.trim()) throw new Error("请先填写本次要验收的功能需求。");
    if (text.length > 20_000)
      throw new Error("需求最多 20,000 字符，请按功能拆分后验收。");
    if (saved?.text === text.trim()) return saved;
    const response = await api<{ requirement: RequirementRecord }>(
      `/api/projects/${project.projectId}/requirements`,
      { text: text.trim() },
    );
    setSaved(response.requirement);
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
        setNotice(`需求 v${record.version} 已保存。下次打开项目可以继续使用。`);
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
      setError("请上传 .md 或 .txt 文件。");
      return;
    }
    if (file.size > 100_000) {
      setError("文件过大，请只保留这次功能的验收需求。");
      return;
    }
    const value = await file.text();
    if (value.length > 20_000) {
      setError("需求最多 20,000 字符，请按功能拆分。");
      return;
    }
    edit(value);
    setNotice(`已导入 ${file.name}，点击保存后留档。`);
  }
  return (
    <Sheet
      title={`${readOnly ? "查看" : "编写"}项目需求`}
      wide
      onClose={onClose}
      locked={!!busy}
    >
      <p className="sheet-lead">
        <strong>{project.name}</strong> ·
        写清楚使用者要完成什么、什么结果才算通过，以及哪些输入不应被接受。
      </p>
      <div className="requirement-file-actions">
        {!readOnly && (
          <label className="secondary-button upload-button">
            <FileArrowUp size={17} />
            导入 PRD
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
              `${project.name}-需求.md`,
              text,
              "text/markdown;charset=utf-8",
            )
          }
        >
          <DownloadSimple size={17} />
          导出需求
        </button>
        <span>{text.length.toLocaleString()} / 20,000</span>
      </div>
      <label className="field">
        需求与验收边界
        <textarea
          aria-label="需求与验收边界"
          className="prd-editor"
          rows={11}
          value={text}
          onChange={(e) => edit(e.target.value)}
          readOnly={readOnly}
          disabled={!!busy}
          placeholder={
            "示例：\n用户输入任务名称后点击添加，列表显示本次任务。\n刷新页面后，同一任务仍然存在。\n空白名称不能新增任务，应显示明确提示。"
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
              {busy === "save" ? "保存中…" : "保存需求"}
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
              {busy === "generate" ? "正在生成…" : "AI 生成验收草稿"}
            </button>
          </div>
          {!providerConfigured && (
            <p className="model-inline-note">
              还没有配置模型。
              <button onClick={onConfigureModel} disabled={!!busy}>
                连接模型
              </button>
              ，或直接编写标准。
            </p>
          )}
          <button
            className="manual-alternative"
            disabled={!!busy || !text.trim()}
            onClick={() => void action("manual")}
          >
            <PencilSimple size={18} />
            <span>
              <strong>自己编写验收标准</strong>
              <small>
                添加操作与检查条件，不需要 API，也不需要写测试代码。
              </small>
            </span>
            <ArrowRight size={19} />
          </button>
        </>
      )}
    </Sheet>
  );
}
