import { useState } from "react";
import {
  ArrowRight,
  Archive,
  CheckCircle,
  CircleNotch,
  FileHtml,
  FolderOpen,
  Globe,
  Plus,
  Pulse,
  WarningCircle,
} from "@phosphor-icons/react";
import type { ProjectRecord, RunRecord, TargetInfo } from "../types";
import { api } from "../lib/api";

type HistoryItem = Pick<
  RunRecord,
  "runId" | "status" | "startedAt" | "targetVariant"
>;
export default function ProjectHub({
  targets,
  projects,
  history,
  readOnly,
  onConnect,
  onOpen,
  onArchived,
}: {
  targets: TargetInfo[];
  projects: ProjectRecord[];
  history: HistoryItem[];
  readOnly: boolean;
  onConnect: () => void;
  onOpen: (target: TargetInfo, project?: ProjectRecord) => void;
  onArchived: () => void;
}) {
  const [probing, setProbing] = useState("");
  const [probe, setProbe] = useState<
    Record<string, { reachable: boolean; message: string }>
  >({});
  const [archiveId, setArchiveId] = useState("");
  const [error, setError] = useState("");
  const own = targets.filter((t) => t.isSample === false && !t.archived);
  const samples = targets.filter((t) => t.isSample !== false && !t.archived);
  async function check(target: TargetInfo) {
    setProbing(target.variant);
    setError("");
    try {
      const response = await api<{
        reachable: boolean;
        context?: { title?: string };
        error?: string;
      }>(`/api/targets/${encodeURIComponent(target.variant)}/probe`, {});
      setProbe((old) => ({
        ...old,
        [target.variant]: {
          reachable: response.reachable,
          message: response.reachable
            ? `页面可访问${response.context?.title ? ` · ${response.context.title}` : ""}`
            : response.error || "页面暂时无法访问，请先启动项目。",
        },
      }));
    } catch (e) {
      setProbe((old) => ({
        ...old,
        [target.variant]: { reachable: false, message: (e as Error).message },
      }));
    } finally {
      setProbing("");
    }
  }
  async function archive(target: TargetInfo) {
    setProbing(target.variant);
    setError("");
    try {
      await api(
        `/api/targets/${encodeURIComponent(target.variant)}`,
        undefined,
        "DELETE",
      );
      setArchiveId("");
      onArchived();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProbing("");
    }
  }
  return (
    <section className="project-hub" aria-label="我的项目">
      <div className="hub-heading">
        <div>
          <div className="eyebrow">YOUR PROJECTS</div>
          <h1>把你的项目，交给真实验收。</h1>
          <p>
            保存一次需求，反复检查每次修改。每个结果都有操作、截图和原始标准。
          </p>
        </div>
        {!readOnly && (
          <button className="primary-button" onClick={onConnect}>
            <Plus size={18} />
            接入项目
          </button>
        )}
      </div>
      <ol className="onboarding-steps" aria-label="项目验收流程">
        {["接入项目", "保存需求", "确认标准", "运行验收", "反馈与复验"].map(
          (label, i) => (
            <li key={label}>
              <span>{i + 1}</span>
              {label}
              {i < 4 && <ArrowRight size={15} />}
            </li>
          ),
        )}
      </ol>
      {error && (
        <div className="message error-message" role="alert">
          <WarningCircle size={20} />
          <span>{error}</span>
        </div>
      )}
      {own.length ? (
        <div className="project-grid">
          {own.map((target) => {
            const project =
              projects.find((p) => p.projectId === target.projectId) ||
              projects.find((p) => p.targetVariant === target.variant);
            const lastRun = history.find(
              (r) => r.targetVariant === target.variant,
            );
            const outcome = probe[target.variant];
            return (
              <article className="project-card" key={target.variant}>
                <div className="project-card-top">
                  <span className="project-kind">
                    {target.kind === "url" ? (
                      <Globe size={22} />
                    ) : (
                      <FileHtml size={22} />
                    )}
                    {target.kind === "url" ? "运行中的网页" : "本地 HTML"}
                  </span>
                  {lastRun && (
                    <span className={`status status-${lastRun.status}`}>
                      {lastRun.status === "passed"
                        ? "最近一次通过"
                        : lastRun.status === "failed"
                          ? "有待修复问题"
                          : "最近一次执行异常"}
                    </span>
                  )}
                </div>
                <h2>{project?.name || target.label}</h2>
                <p className="project-url" title={target.url}>
                  {target.url}
                </p>
                {outcome && (
                  <p
                    className={`connection-result ${outcome.reachable ? "reachable" : "unreachable"}`}
                  >
                    {outcome.reachable ? (
                      <CheckCircle size={16} />
                    ) : (
                      <WarningCircle size={16} />
                    )}
                    {outcome.message}
                  </p>
                )}
                <div className="project-card-actions">
                  <button
                    className="primary-button"
                    onClick={() => onOpen(target, project)}
                  >
                    打开项目
                    <ArrowRight size={16} />
                  </button>
                  {!readOnly && (
                    <button
                      className="secondary-button"
                      disabled={!!probing}
                      onClick={() => void check(target)}
                    >
                      {probing === target.variant ? (
                        <CircleNotch className="spin" size={16} />
                      ) : (
                        <Pulse size={16} />
                      )}
                      检查连接
                    </button>
                  )}
                </div>
                {!readOnly && (
                  <div className="archive-row">
                    {archiveId === target.variant ? (
                      <>
                        <span>归档后仍保留需求和历史证据。</span>
                        <button
                          onClick={() => void archive(target)}
                          disabled={!!probing}
                        >
                          确认归档
                        </button>
                        <button onClick={() => setArchiveId("")}>取消</button>
                      </>
                    ) : (
                      <button onClick={() => setArchiveId(target.variant)}>
                        <Archive size={14} />
                        归档项目
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="onboarding-empty">
          <FolderOpen size={44} weight="light" />
          <h2>从你正在开发的项目开始</h2>
          <p>
            连接本地测试地址，上传 PRD 或写下功能需求。还没有模型
            API，也可以直接编写可执行的验收标准。
          </p>
          {!readOnly && (
            <button className="primary-button" onClick={onConnect}>
              <Plus size={17} />
              接入我的第一个项目
            </button>
          )}
        </div>
      )}
      <section className="sample-section">
        <div>
          <h2>先看看 Ming 如何验收</h2>
          <p>
            下面是预置演示项目，使用固定计划，不调用模型。演示记录与自己的项目分开。
          </p>
        </div>
        <div className="sample-grid">
          {samples.map((target) => (
            <button
              className="sample-card"
              key={target.variant}
              onClick={() => onOpen(target)}
            >
              <FileHtml size={21} />
              <span>
                <strong>{target.label}</strong>
                <small>预置示例 · 固定验收计划</small>
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
