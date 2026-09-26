import { useEffect, useState, useCallback, useRef } from "react";
import {
  PlanInfo,
  TargetInfo,
  RunRecord,
  RunProgress,
  CriteriaResult,
  StepResult,
} from "./types";

// ── API helpers ────────────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  opts?: RequestInit
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(url, opts);
    const json = await res.json();
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Status helpers ─────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  passed: "通过",
  failed: "失败",
  error: "执行错误",
  blocked: "已阻塞",
  not_run: "未执行",
  pending: "等待",
  running: "运行中",
  skipped: "已跳过",
};

const STATUS_COLOR: Record<string, string> = {
  passed: "#28a745",
  failed: "#dc3545",
  error: "#e07b00",
  blocked: "#6c757d",
  not_run: "#adb5bd",
  pending: "#adb5bd",
  running: "#3b82f6",
  skipped: "#adb5bd",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "0.72rem",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 10,
        background: STATUS_COLOR[status] ?? "#adb5bd",
        color: "#fff",
        letterSpacing: "0.02em",
      }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── Step detail ────────────────────────────────────────────────────

function StepRow({ step }: { step: StepResult }) {
  const [showImg, setShowImg] = useState(false);
  return (
    <div
      style={{
        borderLeft: `3px solid ${STATUS_COLOR[step.status] ?? "#dee2e6"}`,
        paddingLeft: 10,
        marginBottom: 8,
        fontSize: "0.82rem",
        color: "#333",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <StatusBadge status={step.status} />
        <span style={{ color: "#555" }}>{step.stepId}</span>
        <span>{step.description}</span>
        {step.durationMs !== undefined && (
          <span style={{ color: "#aaa", marginLeft: "auto" }}>{step.durationMs}ms</span>
        )}
      </div>
      {step.expected !== undefined && (
        <div style={{ marginTop: 3, color: "#555" }}>
          期望：<code style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>
            {String(step.expected)}
          </code>
        </div>
      )}
      {step.actual !== undefined && (
        <div style={{ marginTop: 3, color: "#555" }}>
          实际：<code style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>
            {String(step.actual)}
          </code>
        </div>
      )}
      {step.error && (
        <div style={{ marginTop: 3, color: "#dc3545", wordBreak: "break-all" }}>
          ⚠ {step.error}
        </div>
      )}
      {step.screenshotPath && (
        <div style={{ marginTop: 4 }}>
          <button
            onClick={() => setShowImg((v) => !v)}
            style={{
              background: "none",
              border: "1px solid #dee2e6",
              borderRadius: 4,
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: "0.78rem",
              color: "#3b82f6",
            }}
          >
            {showImg ? "▲ 隐藏截图" : "▼ 查看截图"}
          </button>
          {showImg && (
            <div style={{ marginTop: 6 }}>
              <img
                src={`/api/screenshots/${step.screenshotPath.split(/[\\/]/).pop()}`}
                alt="步骤截图"
                style={{
                  maxWidth: "100%",
                  border: "1px solid #dee2e6",
                  borderRadius: 4,
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Criteria detail ────────────────────────────────────────────────

function CriteriaCard({ cr, defaultOpen }: { cr: CriteriaResult; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div
      style={{
        border: `1px solid ${STATUS_COLOR[cr.status] ?? "#dee2e6"}`,
        borderRadius: 8,
        marginBottom: 10,
        background: "#fff",
      }}
    >
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <StatusBadge status={cr.status} />
        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{cr.criteriaId}</span>
        <span style={{ color: "#555", fontSize: "0.88rem" }}>{cr.title}</span>
        <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#aaa" }}>
          {open ? "▲" : "▼"}
        </span>
      </div>
      {open && (
        <div style={{ padding: "0 14px 12px", borderTop: "1px solid #f0f0f0" }}>
          {cr.blockedReason && (
            <div
              style={{
                background: "#fff3cd",
                border: "1px solid #ffc107",
                borderRadius: 4,
                padding: "6px 10px",
                fontSize: "0.82rem",
                color: "#856404",
                marginTop: 8,
                marginBottom: 8,
              }}
            >
              {cr.blockedReason}
            </div>
          )}
          {cr.steps.map((s) => (
            <StepRow key={s.stepId} step={s} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Run result panel ───────────────────────────────────────────────

function RunResultPanel({ record }: { record: RunRecord }) {
  const passCount = record.criteria.filter((c) => c.status === "passed").length;
  const failCount = record.criteria.filter((c) => c.status === "failed").length;
  const otherCount = record.criteria.filter(
    (c) => !["passed", "failed"].includes(c.status)
  ).length;

  return (
    <div
      style={{
        background: "#f7f8fa",
        border: "1px solid #dee2e6",
        borderRadius: 10,
        padding: 16,
        marginTop: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <StatusBadge status={record.status} />
        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
          运行 {record.runId.slice(0, 8)}…
        </span>
        <span style={{ fontSize: "0.8rem", color: "#888" }}>
          目标：{record.targetVariant}
        </span>
        <span style={{ fontSize: "0.8rem", color: "#888" }}>
          ✓ {passCount} &nbsp;✗ {failCount}
          {otherCount > 0 ? ` / 其他 ${otherCount}` : ""}
        </span>
        <span style={{ fontSize: "0.75rem", color: "#aaa", marginLeft: "auto" }}>
          {record.startedAt.replace("T", " ").slice(0, 19)}
        </span>
      </div>
      {record.fatalError && (
        <div
          style={{
            background: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: 4,
            padding: "8px 12px",
            fontSize: "0.85rem",
            color: "#721c24",
            marginBottom: 12,
          }}
        >
          致命错误：{record.fatalError}
        </div>
      )}
      {record.criteria.map((cr) => (
        <CriteriaCard
          key={cr.criteriaId}
          cr={cr}
          defaultOpen={cr.status !== "passed"}
        />
      ))}
      <div style={{ fontSize: "0.72rem", color: "#aaa", marginTop: 8 }}>
        计划指纹：{record.planFingerprint} &nbsp;|&nbsp;
        目标指纹：{record.targetFingerprint}
      </div>
    </div>
  );
}

// ── History panel ──────────────────────────────────────────────────

interface HistorySummary {
  runId: string;
  targetVariant: string;
  status: string;
  startedAt: string;
  criteriaSummary: { id: string; status: string }[];
}

function HistoryPanel({
  onSelect,
}: {
  onSelect: (runId: string) => void;
}) {
  const [runs, setRuns] = useState<HistorySummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch<{ runs: HistorySummary[] }>("/api/history");
    if (r.ok && r.data) setRuns(r.data.runs);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading && runs.length === 0) return <p style={{ color: "#aaa" }}>加载历史…</p>;
  if (runs.length === 0)
    return <p style={{ color: "#aaa", fontSize: "0.85rem" }}>暂无历史记录</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>历史记录</span>
        <button
          onClick={refresh}
          style={{
            background: "none",
            border: "1px solid #dee2e6",
            borderRadius: 4,
            padding: "2px 8px",
            cursor: "pointer",
            fontSize: "0.78rem",
          }}
        >
          刷新
        </button>
      </div>
      {runs.map((r) => (
        <div
          key={r.runId}
          onClick={() => onSelect(r.runId)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            border: "1px solid #dee2e6",
            borderRadius: 6,
            marginBottom: 6,
            cursor: "pointer",
            background: "#fff",
            fontSize: "0.82rem",
          }}
        >
          <StatusBadge status={r.status} />
          <span style={{ color: "#555" }}>{r.targetVariant}</span>
          <span style={{ color: "#888" }}>{r.startedAt.slice(0, 19).replace("T", " ")}</span>
          <span style={{ color: "#aaa", marginLeft: "auto" }}>{r.runId.slice(0, 8)}…</span>
          <span>
            {r.criteriaSummary.map((c) => (
              <span
                key={c.id}
                title={`${c.id}: ${c.status}`}
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: STATUS_COLOR[c.status] ?? "#adb5bd",
                  marginLeft: 3,
                }}
              />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────

export default function App() {
  // Plan & target state
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [targets, setTargets] = useState<TargetInfo[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [confirmed, setConfirmed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Run state
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // History
  const [historyRunId, setHistoryRunId] = useState<string | null>(null);
  const [historyRecord, setHistoryRecord] = useState<RunRecord | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // Load plan + targets on mount
  useEffect(() => {
    (async () => {
      const [pr, tr] = await Promise.all([
        apiFetch<{ plan: PlanInfo }>("/api/plan"),
        apiFetch<{ targets: TargetInfo[] }>("/api/targets"),
      ]);
      if (!pr.ok || !pr.data) {
        setLoadError(pr.error ?? "加载计划失败");
        return;
      }
      if (!tr.ok || !tr.data) {
        setLoadError(tr.error ?? "加载目标失败");
        return;
      }
      setPlan(pr.data.plan);
      setTargets(tr.data.targets);
      if (tr.data.targets.length > 0) setSelectedVariant(tr.data.targets[0].variant);
    })();
  }, []);

  // Reset confirmation when target or plan changes
  useEffect(() => {
    setConfirmed(false);
  }, [selectedVariant]);

  // Polling during a run
  useEffect(() => {
    if (!runId || !running) return;
    pollRef.current = setInterval(async () => {
      const r = await apiFetch<{ progress: RunProgress }>(`/api/run/${runId}/progress`);
      if (!r.ok || !r.data) return;
      setProgress(r.data.progress);
      if (r.data.progress.status !== "running") {
        clearInterval(pollRef.current!);
        setRunning(false);
        // Fetch full record
        const rec = await apiFetch<{ run: RunRecord }>(`/api/run/${runId}`);
        if (rec.ok && rec.data) {
          setRecord(rec.data.run);
          setHistoryRefreshKey((k) => k + 1);
        }
      }
    }, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runId, running]);

  // Load history record
  useEffect(() => {
    if (!historyRunId) { setHistoryRecord(null); return; }
    (async () => {
      const r = await apiFetch<{ run: RunRecord }>(`/api/run/${historyRunId}`);
      if (r.ok && r.data) setHistoryRecord(r.data.run);
    })();
  }, [historyRunId]);

  const startRun = useCallback(async () => {
    if (!plan || !confirmed) return;
    setRecord(null);
    setProgress(null);
    setRunError(null);
    setHistoryRunId(null);
    const r = await apiFetch<{ runId: string }>("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant: selectedVariant,
        confirmed: true,
        confirmedPlanId: plan.planId,
        confirmedPlanFingerprint: plan.fingerprint,
      }),
    });
    if (!r.ok || !r.data) {
      setRunError(r.error ?? "启动失败");
      return;
    }
    setRunId(r.data.runId);
    setRunning(true);
    setProgress({
      runId: r.data.runId,
      status: "running",
      finishedCriteria: 0,
      totalCriteria: plan.criteria.length,
    });
  }, [plan, confirmed, selectedVariant]);

  const selectedTarget = targets.find((t) => t.variant === selectedVariant);

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "24px 20px",
        fontFamily: '-apple-system,"Segoe UI",system-ui,sans-serif',
        fontSize: 14,
        color: "#1f2328",
        lineHeight: 1.6,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Ming</h1>
        <p style={{ color: "#57606a", margin: "4px 0 0" }}>
          每一句「已完成」，都有据可验
        </p>
        <div
          style={{
            display: "inline-block",
            marginTop: 6,
            fontSize: "0.75rem",
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: 4,
            padding: "2px 8px",
            color: "#856404",
          }}
        >
          开发验证样例 · 尚未接入模型生成
        </div>
      </div>

      {loadError && (
        <div
          style={{
            background: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: 6,
            padding: "10px 14px",
            color: "#721c24",
            marginBottom: 16,
          }}
        >
          {loadError}
        </div>
      )}

      {/* Plan info */}
      {plan && (
        <div
          style={{
            background: "#f7f8fa",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "14px 16px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{plan.title}</div>
          <div style={{ fontSize: "0.82rem", color: "#57606a", marginBottom: 10 }}>
            {plan.description}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {plan.criteria.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  padding: "6px 10px",
                  minWidth: 160,
                  flex: "1 1 160px",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{c.id}</div>
                <div style={{ fontSize: "0.8rem", color: "#333" }}>{c.title}</div>
                <div style={{ fontSize: "0.75rem", color: "#57606a" }}>{c.description}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#aaa" }}>
            计划指纹：{plan.fingerprint} &nbsp;|&nbsp; 版本：{plan.version}
          </div>
        </div>
      )}

      {/* Target selector + confirm */}
      {plan && targets.length > 0 && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "14px 16px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>选择验收目标</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {targets.map((t) => (
              <button
                key={t.variant}
                onClick={() => setSelectedVariant(t.variant)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 6,
                  border: `2px solid ${selectedVariant === t.variant ? "#3b82d4" : "#dee2e6"}`,
                  background: selectedVariant === t.variant ? "#eff6ff" : "#fff",
                  color: selectedVariant === t.variant ? "#1d4ed8" : "#333",
                  cursor: "pointer",
                  fontWeight: selectedVariant === t.variant ? 600 : 400,
                  fontSize: "0.88rem",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {selectedTarget && (
            <div style={{ fontSize: "0.78rem", color: "#57606a", marginBottom: 10 }}>
              地址：{selectedTarget.url} &nbsp;|&nbsp; 目标指纹：{selectedTarget.fingerprint}
            </div>
          )}
          <label
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
          >
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ width: 15, height: 15 }}
            />
            <span style={{ fontSize: "0.88rem" }}>
              我已查看验收计划，确认使用上述固定开发夹具（非模型生成）执行验收
            </span>
          </label>
        </div>
      )}

      {/* Run button */}
      {plan && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={startRun}
            disabled={!confirmed || running}
            style={{
              background: confirmed && !running ? "#3b82d4" : "#adb5bd",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "10px 24px",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: confirmed && !running ? "pointer" : "not-allowed",
            }}
          >
            {running ? "运行中…" : "开始验收"}
          </button>
          {runError && (
            <span
              style={{ marginLeft: 12, color: "#dc3545", fontSize: "0.85rem" }}
            >
              {runError}
            </span>
          )}
        </div>
      )}

      {/* Live progress */}
      {running && progress && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, color: "#1d4ed8" }}>
            验收进行中 —— 真实浏览器执行中
          </div>
          <div
            style={{
              background: "#dbeafe",
              borderRadius: 4,
              height: 8,
              overflow: "hidden",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                background: "#3b82f6",
                height: "100%",
                width: `${
                  progress.totalCriteria > 0
                    ? Math.round(
                        (progress.finishedCriteria / progress.totalCriteria) * 100
                      )
                    : 0
                }%`,
                transition: "width 0.3s",
              }}
            />
          </div>
          <div style={{ fontSize: "0.82rem", color: "#1d4ed8" }}>
            已完成 {progress.finishedCriteria}/{progress.totalCriteria} 条验收标准
            {progress.currentCriteria && ` · 最近完成：${progress.currentCriteria}`}
          </div>
        </div>
      )}

      {/* Run result */}
      {record && <RunResultPanel record={record} />}

      {/* History */}
      <div
        style={{
          marginTop: 32,
          borderTop: "1px solid #e5e7eb",
          paddingTop: 20,
        }}
      >
        <HistoryPanel
          key={historyRefreshKey}
          onSelect={(id) => {
            setHistoryRunId(id);
            setRecord(null);
          }}
        />
        {historyRecord && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>历史详情</span>
              <button
                onClick={() => setHistoryRecord(null)}
                style={{
                  background: "none",
                  border: "1px solid #dee2e6",
                  borderRadius: 4,
                  padding: "2px 8px",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                }}
              >
                关闭
              </button>
            </div>
            <RunResultPanel record={historyRecord} />
          </div>
        )}
      </div>
    </div>
  );
}
