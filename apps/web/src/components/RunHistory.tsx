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
    <Sheet title="Run history" wide onClose={onClose}>
      <p className="sheet-lead">
        Every run keeps its plan version, screenshots, and results. Revisit evidence or return to your project for another check.
      </p>
      <div className="history-filters">
        <label className="search-field">
          <MagnifyingGlass size={18} />
          <input
            aria-label="Search run history"
            placeholder="Search by project or run ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter by result"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All results</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="error">Run error</option>
        </select>
        <select
          aria-label="Filter by project"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">All projects</option>
          {targets.map((t) => (
            <option key={t.variant} value={t.variant}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <p className="history-result-count">{filtered.length} {filtered.length === 1 ? "run" : "runs"}</p>
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
                  {new Date(run.startedAt).toLocaleString("en-GB")} ·{" "}
                  {run.runId.slice(0, 10)}
                </span>
              </div>
              <span className={`status status-${run.status}`}>
                {run.status === "passed"
                  ? "Passed"
                  : run.status === "failed"
                    ? "Failed"
                    : run.status === "error"
                      ? "Run error"
                      : "Running"}
              </span>
              <ArrowRight size={18} />
            </button>
          ))
        ) : (
          <div className="empty-list">
            <ClockCounterClockwise size={32} />
            <p>
              {runs.length
                ? "No runs match these filters."
                : "No runs yet. Confirm a plan to start your first check."}
            </p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
