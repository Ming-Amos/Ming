import { useState } from "react";
import {
  ArrowRight,
  CircleNotch,
  Globe,
  FileHtml,
  FolderOpen,
  Info,
  WarningCircle,
} from "@phosphor-icons/react";
import type { ProjectRecord, TargetInfo } from "../types";
import { api } from "../lib/api";
import Sheet from "./Sheet";

export default function ProjectConnect({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected: (target: TargetInfo, project: ProjectRecord) => void;
}) {
  const [kind, setKind] = useState<"url" | "html">("url");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("http://localhost:5173");
  const [htmlPath, setHtmlPath] = useState("");
  const [sourceDir, setSourceDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ target: TargetInfo; project: ProjectRecord }>(
        "/api/targets",
        {
          name: name.trim(),
          kind,
          ...(kind === "url"
            ? { url: url.trim() }
            : { htmlPath: htmlPath.trim() }),
          ...(sourceDir.trim() ? { sourceDir: sourceDir.trim() } : {}),
        },
      );
      onConnected(result.target, result.project);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title="接入你的项目" onClose={onClose} locked={busy}>
      <p className="sheet-lead">
        项目继续在原来的开发工具中运行。Ming 打开测试页面，按你定义的标准验收。
      </p>
      <div className="mode-switch">
        <button
          disabled={busy}
          className={kind === "url" ? "active" : ""}
          onClick={() => setKind("url")}
        >
          <Globe size={18} />
          运行中的网页
        </button>
        <button
          disabled={busy}
          className={kind === "html" ? "active" : ""}
          onClick={() => setKind("html")}
        >
          <FileHtml size={18} />
          本地 HTML
        </button>
      </div>
      <label className="field">
        项目名称
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="例如：我的任务管理工具"
          disabled={busy}
        />
      </label>
      {kind === "url" ? (
        <>
          <label className="field">
            测试页面地址
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:5173"
              inputMode="url"
              disabled={busy}
            />
          </label>
          <p className="field-help">
            填写已经启动的本地开发地址。页面、脚本和接口须在同一来源；跨域接口请先通过开发服务器代理。不要填写
            Ming 自己的页面地址。
          </p>
        </>
      ) : (
        <>
          <label className="field">
            HTML 文件完整路径
            <input
              value={htmlPath}
              onChange={(e) => setHtmlPath(e.target.value)}
              placeholder="C:\Projects\my-app\index.html"
              disabled={busy}
            />
          </label>
          <p className="field-help">
            适用于样式和脚本包含在一个 HTML 文件中的页面。Ming
            会固定本次执行的文件快照。
          </p>
        </>
      )}
      <details className="connection-advanced">
        <summary>
          <FolderOpen size={17} />
          关联代码文件夹（可选）
        </summary>
        <label className="field">
          源代码目录
          <input
            value={sourceDir}
            onChange={(e) => setSourceDir(e.target.value)}
            placeholder="C:\Projects\my-app"
            disabled={busy}
          />
        </label>
        <p className="field-help">
          供修复交接和代码版本核对使用。Ming 不会自动修改这个目录。
        </p>
      </details>
      <div className="info-box">
        <Info size={20} />
        <p>
          检查会执行真实的输入和点击，请使用自己的测试环境。登录流程、验证码和外部系统需要先准备好可验收的页面。
        </p>
      </div>
      {error && (
        <div className="message error-message" role="alert">
          <WarningCircle size={19} />
          <span>{error}</span>
        </div>
      )}
      <button
        className="primary-button full-width"
        disabled={
          busy ||
          !name.trim() ||
          !(kind === "url" ? url.trim() : htmlPath.trim())
        }
        onClick={() => void connect()}
      >
        {busy ? (
          <CircleNotch className="spin" size={18} />
        ) : (
          <ArrowRight size={18} />
        )}
        {busy ? "正在接入…" : "接入项目并编写需求"}
      </button>
    </Sheet>
  );
}
