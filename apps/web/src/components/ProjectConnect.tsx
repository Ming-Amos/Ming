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
    <Sheet title="Connect your project" onClose={onClose} locked={busy}>
      <p className="sheet-lead">
        Keep your app running in your usual development tool. Ming opens its test page and checks it against your acceptance criteria.
      </p>
      <div className="mode-switch">
        <button
          disabled={busy}
          className={kind === "url" ? "active" : ""}
          onClick={() => setKind("url")}
        >
          <Globe size={18} />
          Running web app
        </button>
        <button
          disabled={busy}
          className={kind === "html" ? "active" : ""}
          onClick={() => setKind("html")}
        >
          <FileHtml size={18} />
          Local HTML file
        </button>
      </div>
      <label className="field">
        Project name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="e.g. My task manager"
          disabled={busy}
        />
      </label>
      {kind === "url" ? (
        <>
          <label className="field">
            Test page URL
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:5173"
              inputMode="url"
              disabled={busy}
            />
          </label>
          <p className="field-help">
            Enter your running local app URL. Pages, scripts, and APIs must share one origin; proxy cross-origin APIs through your development server. Use your app URL,
            not the Ming dashboard URL.
          </p>
        </>
      ) : (
        <>
          <label className="field">
            Full HTML file path
            <input
              value={htmlPath}
              onChange={(e) => setHtmlPath(e.target.value)}
              placeholder="C:\Projects\my-app\index.html"
              disabled={busy}
            />
          </label>
          <p className="field-help">
            For pages with all styles and scripts inside one HTML file. Ming
            freezes a snapshot of the file for each run.
          </p>
        </>
      )}
      <details className="connection-advanced">
        <summary>
          <FolderOpen size={17} />
          Link a source folder (optional)
        </summary>
        <label className="field">
          Source folder
          <input
            value={sourceDir}
            onChange={(e) => setSourceDir(e.target.value)}
            placeholder="C:\Projects\my-app"
            disabled={busy}
          />
        </label>
        <p className="field-help">
          Used to hand off repairs and track source revisions. Ming does not edit this folder automatically.
        </p>
      </details>
      <div className="info-box">
        <Info size={20} />
        <p>
          Checks perform real actions. Use your own test environment and prepare a testable page for flows that require sign-in, CAPTCHA, or external services.
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
        {busy ? "Connecting…" : "Connect and add requirements"}
      </button>
    </Sheet>
  );
}
