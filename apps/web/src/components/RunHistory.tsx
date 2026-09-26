import { useMemo, useState } from "react";
import {
  ArrowRight,
  ClockCounterClockwise,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import type { RunRecord, TargetInfo } from "../types";
import Sheet from "./Sheet";

export type HistoryItem = Pick<
  RunRecord,
  "runId" | "status" | "startedAt" | "targetVariant" | "planFingerprint"
>;
export default function RunHistory({
  runs,
  targets,
  currentRunId,
  disabled,
  onClose,
  onSelect,
}: {
  runs: HistoryItem[];
  targets: TargetInfo[];
  currentRunId?: string;
  disabled: boolean;
  onClose: () => void;
  onSelect: (runId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [target, setTarget] = useState("");
  const filtered = useMemo(
    () =>
      runs.filter(
        (run) =>
          (!status || run.status === status) &&
          (!target || run.targetVariant === target) &&
          (!query.trim() ||
            `${run.runId} ${run.targetVariant} ${targets.find((t) => t.variant === run.targetVariant)?.label || ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())),
      ),
    [runs, query, status, target, targets],
  );
  return (
    <Sheet title="验收记录" wide onClose={onClose}>
      <p className="sheet-lead">
        每次运行都保留自己的标准版本、截图和结果。查看过去的证据，或回到项目再次验收。
      </p>
      <div className="history-filters">
        <label className="search-field">
          <MagnifyingGlass size={18} />
          <input
            aria-label="搜索验收记录"
            placeholder="搜索项目或运行编号"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="按结果筛选"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">全部结果</option>
          <option value="passed">通过</option>
          <option value="failed">未通过</option>
          <option value="error">执行异常</option>
        </select>
        <select
          aria-label="按项目筛选"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">全部项目</option>
          {targets.map((t) => (
            <option key={t.variant} value={t.variant}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <p className="history-result-count">{filtered.length} 条记录</p>
      <div className="history-list">
        {filtered.length ? (
          filtered.map((run) => (
            <button
              key={run.runId}
              disabled={disabled}
              className={`history-item ${run.runId === currentRunId ? "active" : ""}`}
              onClick={() => onSelect(run.runId)}
            >
              <div>
                <strong>
                  {targets.find((t) => t.variant === run.targetVariant)
                    ?.label || run.targetVariant}
                </strong>
                <span>
                  {new Date(run.startedAt).toLocaleString("zh-CN")} ·{" "}
                  {run.runId.slice(0, 10)}
                </span>
              </div>
              <span className={`status status-${run.status}`}>
                {run.status === "passed"
                  ? "通过"
                  : run.status === "failed"
                    ? "未通过"
                    : run.status === "error"
                      ? "执行异常"
                      : "检查中"}
              </span>
              <ArrowRight size={18} />
            </button>
          ))
        ) : (
          <div className="empty-list">
            <ClockCounterClockwise size={32} />
            <p>
              {runs.length
                ? "没有符合筛选条件的记录。"
                : "还没有记录。确认验收标准后，开始第一次运行。"}
            </p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
