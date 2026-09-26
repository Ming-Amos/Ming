import { api, downloadText, type ApiError } from "./lib/api";
import Sheet from "./components/Sheet";
import { EvidenceImage, Status } from "./components/Evidence";
import ProjectConnect from "./components/ProjectConnect";
import ProjectHub from "./components/ProjectHub";
import RequirementEditor from "./components/RequirementEditor";
import PlanEditor from "./components/PlanEditor";
import RunHistory from "./components/RunHistory";
import ProviderSettings from "./components/ProviderSettings";
import AiConnection from "./components/AiConnection";
import ProofTimeline from "./components/ProofTimeline";
import EvidenceCompare from "./components/EvidenceCompare";
import CommandMenu from "./components/CommandMenu";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle,
  CircleNotch,
  ClockCounterClockwise,
  Copy,
  DownloadSimple,
  FileText,
  Fingerprint,
  FolderOpen,
  GearSix,
  GitBranch,
  Info,
  ListChecks,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Play,
  Plus,
  ShieldCheck,
  Sparkle,
  Stop,
  TerminalWindow,
  WarningCircle,
  X,
  XCircle,
  ArrowsOutSimple,
  ArrowsInSimple,
} from "@phosphor-icons/react";
import type {
  PlanInfo,
  TargetInfo,
  RunRecord,
  RunProgress,
  StepResult,
  ProviderStatus,
  ProjectRecord,
  RequirementRecord,
  DraftRecord,
  ConfirmationRecord,
  RepairTaskRecord,
  RepairComparison,
} from "./types";

type Mode = "sample" | "requirement";
type HistoryRun = Pick<
  RunRecord,
  "runId" | "status" | "startedAt" | "targetVariant" | "planFingerprint"
>;
type Session = {
  mode: Mode;
  variant: string;
  projectId?: string;
  requirementId?: string;
  draftId?: string;
  confirmationId?: string;
  runId?: string;
};
const STORAGE_KEY = "ming.workspace.v2";
const labels: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  error: "Run error",
  blocked: "Blocked",
  not_run: "Not run",
  pending: "Pending",
  running: "Running",
  skipped: "Skipped",
  waiting: "Awaiting AI",
  claimed: "Claimed",
  rerunning: "Verifying repair",
  review: "Checks passed · Review needed",
};
function savedSession(): Session {
  try {
    return (
      JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {
        mode: "sample",
        variant: "shipboard-buggy",
      }
    );
  } catch {
    return { mode: "sample", variant: "shipboard-buggy" };
  }
}
function time(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
function short(value?: string) {
  return value && value !== "unknown" ? value.slice(0, 10) : "Not recorded";
}
function last<T>(items: T[] | undefined): T | undefined {
  return items?.[items.length - 1];
}
export default function App() {
  const [focusMode, setFocusMode] = useState(false);
  const [session, setSession] = useState<Session>(savedSession);
  const [view, setView] = useState<"projects" | "workspace">(() =>
    savedSession().runId || savedSession().projectId ? "workspace" : "projects",
  );
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [ready, setReady] = useState(false),
    [readOnly, setReadOnly] = useState(false);
  const [targets, setTargets] = useState<TargetInfo[]>([]),
    [fixture, setFixture] = useState<PlanInfo | null>(null);
  const [provider, setProvider] = useState<ProviderStatus | null>(null),
    [project, setProject] = useState<ProjectRecord | null>(null);
  const [requirement, setRequirement] = useState<RequirementRecord | null>(
      null,
    ),
    [draft, setDraft] = useState<DraftRecord | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationRecord | null>(
      null,
    ),
    [sampleConfirmed, setSampleConfirmed] = useState(false);
  const [record, setRecord] = useState<RunRecord | null>(null),
    [progress, setProgress] = useState<RunProgress | null>(null);
  const [history, setHistory] = useState<HistoryRun[]>([]),
    [tasks, setTasks] = useState<RepairTaskRecord[]>([]);
  const [comparison, setComparison] = useState<RepairComparison | null>(null),
    [rerun, setRerun] = useState<RunRecord | null>(null);
  const [baseline, setBaseline] = useState<RunRecord | null>(null);
  const [criterionId, setCriterionId] = useState(""),
    [stepId, setStepId] = useState("");
  const [sheet, setSheet] = useState<
    | "setup"
    | "history"
    | "model"
    | "ai"
    | "comparison"
    | "prompt"
    | "connect"
    | "requirements"
    | "plan"
    | "commands"
    | null
  >(null);
  const [projectName, setProjectName] = useState(""),
    [requirementText, setRequirementText] = useState("");
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [copied, setCopied] = useState(false);
  const loadEpoch = useRef(0);
  const running =
    progress?.status === "running" || progress?.status === "pending";
  const task =
    tasks.find(
      (t) => t.baselineRunId === record?.runId || t.rerunId === record?.runId,
    ) || null;
  const workingPlan =
    session.mode === "sample"
      ? fixture
      : confirmation?.planSnapshot || draft?.plan || null;
  const plan =
    record?.planSnapshot ||
    (record && task?.planSnapshot?.fingerprint === record.planFingerprint
      ? task.planSnapshot
      : null) ||
    (record && workingPlan?.fingerprint !== record.planFingerprint
      ? null
      : workingPlan);
  const selectedCriterion = plan?.criteria.find((c) => c.id === criterionId),
    result = record?.criteria.find((c) => c.criteriaId === criterionId);
  const criteria =
    plan?.criteria ||
    record?.criteria.map((c) => ({
      id: c.criteriaId,
      title: c.title,
      description: "This historical run does not include a complete requirements snapshot.",
    })) ||
    [];
  const selectedStep =
    result?.steps.find((s) => s.stepId === stepId) ||
    result?.steps.find((s) => s.status === "failed" || s.status === "error") ||
    last(result?.steps.filter((s) => s.screenshotPath));
  const evidenceSteps = result?.steps.filter((s) => s.screenshotPath) || [],
    imageStep = selectedStep?.screenshotPath
      ? selectedStep
      : last(evidenceSteps);
  const predecessor =
    record && selectedCriterion?.dependsOn?.length
      ? last(
          record.criteria
            .find((c) => c.criteriaId === selectedCriterion.dependsOn![0])
            ?.steps.filter((s) => s.screenshotPath),
        )
      : undefined;
  const selectedTarget = targets.find((t) => t.variant === session.variant);
  const isConfirmed =
    session.mode === "sample"
      ? sampleConfirmed ||
        (!!record && record.planFingerprint === fixture?.fingerprint)
      : !!confirmation && confirmation.active !== false;
  const activeCount =
      record?.criteria.filter((c) => c.status === "passed").length || 0,
    failedCount =
      record?.criteria.filter((c) => c.status === "failed").length || 0;
  const taskBusy =
    !!task && ["waiting", "claimed", "rerunning"].includes(task.status);

  const refreshLists = useCallback(async () => {
    const [h, t] = await Promise.all([
      api<{ runs: HistoryRun[] }>("/api/history"),
      api<{ tasks: RepairTaskRecord[] }>("/api/repair-tasks"),
    ]);
    setHistory(h.runs);
    setTasks(t.tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    return h.runs;
  }, []);
  const showRun = useCallback(async (id: string, restoreContext = true) => {
    const epoch = ++loadEpoch.current;
    const { run } = await api<{ run: RunRecord }>(`/api/run/${id}`);
    if (epoch !== loadEpoch.current) return;
    let c: ConfirmationRecord | null = null;
    if (restoreContext && run.confirmationId)
      c = (
        await api<{ confirmation: ConfirmationRecord }>(
          `/api/confirmations/${run.confirmationId}`,
        )
      ).confirmation;
    if (epoch !== loadEpoch.current) return;
    setView("workspace");
    setRecord(run);
    setProgress(
      run.status === "running" || run.status === "pending"
        ? {
            runId: run.runId,
            status: run.status,
            finishedCriteria: run.criteria.filter(
              (c) => !["pending", "running", "not_run"].includes(c.status),
            ).length,
            totalCriteria: run.criteria.length,
          }
        : null,
    );
    setComparison(null);
    setRerun(null);
    setBaseline(null);
    const first =
      run.criteria.find((x) => x.status === "failed" || x.status === "error") ||
      run.criteria[0];
    setCriterionId(first?.criteriaId || "");
    setStepId("");
    if (restoreContext) {
      setConfirmation(c);
      setSampleConfirmed(false);
      setSession((s) => ({
        ...s,
        runId: id,
        variant: run.targetVariant,
        mode: c ? "requirement" : "sample",
        confirmationId: c?.confirmationId,
        projectId: c?.projectId,
        requirementId: c?.requirementId,
        draftId: c?.draftId,
      }));
      if (c) {
        const [p, r, d] = await Promise.all([
          api<{ project: ProjectRecord }>(`/api/projects/${c.projectId}`),
          api<{ requirement: RequirementRecord }>(
            `/api/requirements/${c.requirementId}`,
          ),
          api<{ draft: DraftRecord }>(`/api/drafts/${c.draftId}`),
        ]);
        if (epoch !== loadEpoch.current) return;
        setProject(p.project);
        setRequirement(r.requirement);
        setDraft(d.draft);
        setRequirementText(r.requirement.text);
        setProjectName(p.project.name);
      } else {
        setProject(null);
        setRequirement(null);
        setDraft(null);
        setRequirementText("");
        setProjectName("");
      }
    } else setSession((s) => ({ ...s, runId: id }));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* Browser storage can be unavailable; current-session use still works. */
    }
  }, [session]);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const saved = savedSession();
        const [t, p, list, caps, projectList] = await Promise.all([
          api<{ targets: TargetInfo[] }>("/api/targets"),
          api<{ status: ProviderStatus }>("/api/provider/status"),
          refreshLists(),
          api<{ readOnly: boolean }>("/api/capabilities").catch(() => ({
            readOnly: false,
          })),
          api<{ projects: ProjectRecord[] }>("/api/projects").catch(() => ({
            projects: [],
          })),
        ]);
        if (!live) return;
        setTargets(t.targets);
        setProvider(p.status);
        setReadOnly(caps.readOnly);
        setProjects(projectList.projects);
        const featuredReplay = list.find(r => r.targetVariant === "shipboard-repair" && r.status === "failed") || list[0];
        if (!t.targets.some((x) => x.variant === saved.variant))
          setSession((s) => ({
            ...s,
            variant: t.targets[0]?.variant || "normal",
          }));
        let resumeInFlight = false;
        if (saved.runId) {
          try {
            const { progress: current } = await api<{ progress: RunProgress }>(
              `/api/run/${saved.runId}/progress`,
            );
            if (current.status === "running" || current.status === "pending") {
              resumeInFlight = true;
              setRecord(null);
              setProgress(current);
              setView("workspace");
            } else await showRun(saved.runId);
          } catch {
            setSession((s) => ({ ...s, runId: undefined }));
            if (caps.readOnly && featuredReplay) await showRun(featuredReplay.runId);
          }
        } else if (caps.readOnly && featuredReplay) await showRun(featuredReplay.runId);
        if (
          (resumeInFlight || !saved.runId) &&
          !caps.readOnly &&
          saved.mode === "requirement" &&
          saved.projectId
        ) {
          const { project: p2 } = await api<{ project: ProjectRecord }>(
            `/api/projects/${saved.projectId}`,
          );
          if (!live) return;
          setProject(p2);
          setProjectName(p2.name);
          if (saved.requirementId) {
            const { requirement: r } = await api<{
              requirement: RequirementRecord;
            }>(`/api/requirements/${saved.requirementId}`);
            if (live) {
              setRequirement(r);
              setRequirementText(r.text);
            }
          }
          if (saved.draftId) {
            const { draft: d } = await api<{ draft: DraftRecord }>(
              `/api/drafts/${saved.draftId}`,
            );
            if (live) setDraft(d);
          }
          if (saved.confirmationId) {
            const { confirmation: c } = await api<{
              confirmation: ConfirmationRecord;
            }>(`/api/confirmations/${saved.confirmationId}`);
            if (live) setConfirmation(c);
          }
        }
      } catch (e) {
        if (live) setError(`Could not fully restore the workspace: ${(e as Error).message}`);
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [refreshLists, showRun]);
  useEffect(() => {
    let live = true;
    api<{ plan: PlanInfo | null }>(
      `/api/plan?variant=${encodeURIComponent(session.variant)}`,
    )
      .then((x) => {
        if (live) {
          setFixture(x.plan);
          setSampleConfirmed(false);
        }
      })
      .catch((e) => {
        if (live) {
          setFixture(null);
          setError(e.message);
        }
      });
    return () => {
      live = false;
    };
  }, [session.variant]);
  useEffect(() => {
    if (!criteria.some((c) => c.id === criterionId))
      setCriterionId(criteria[0]?.id || "");
  }, [criteria, criterionId]);
  useEffect(() => {
    if (!session.runId || !running) return;
    const runId = session.runId;
    const epoch = loadEpoch.current;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const [{ progress: p }, { run }] = await Promise.all([
          api<{ progress: RunProgress }>(`/api/run/${runId}/progress`),
          api<{ run: RunRecord }>(`/api/run/${runId}`),
        ]);
        if (disposed || epoch !== loadEpoch.current) return;
        if (run.status !== "running" && run.status !== "pending") {
          await showRun(runId, false);
          await refreshLists();
        } else {
          // Refresh recorded observations without reopening the run or changing
          // the criterion, step, or project the user is currently inspecting.
          setRecord(run);
          setProgress({ ...p, status: run.status });
          timer = setTimeout(poll, 900);
        }
      } catch (e) {
        if (!disposed) {
          setError((e as Error).message);
          timer = setTimeout(poll, 3000);
        }
      }
    };
    timer = setTimeout(poll, 500);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [session.runId, running, refreshLists, showRun]);
  useEffect(() => {
    if (!taskBusy || readOnly) return;
    const timer = setInterval(() => {
      void refreshLists().catch((e) => setError(e.message));
    }, 2500);
    return () => clearInterval(timer);
  }, [taskBusy, readOnly, refreshLists]);
  useEffect(() => {
    if (!task?.rerunId || task.status === "rerunning") {
      setComparison(null);
      setRerun(null);
      setBaseline(null);
      return;
    }
    let live = true;
    Promise.all([
      api<{ comparison: RepairComparison }>(
        `/api/repair-tasks/${task.taskId}/comparison`,
      ),
      api<{ run: RunRecord }>(`/api/run/${task.rerunId}`),
      api<{ run: RunRecord }>(`/api/run/${task.baselineRunId}`),
    ])
      .then(([c, r, b]) => {
        if (live) {
          setComparison(c.comparison);
          setRerun(r.run);
          setBaseline(b.run);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [task?.taskId, task?.rerunId, task?.status, record?.runId]);
  async function act(label: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function resetContext(mode: Mode, variant = session.variant) {
    if (busy || running) return;
    ++loadEpoch.current;
    setSession({ mode, variant });
    setProject(null);
    setRequirement(null);
    setDraft(null);
    setConfirmation(null);
    setRecord(null);
    setProgress(null);
    setSampleConfirmed(false);
    setComparison(null);
    setRerun(null);
    setStepId("");
    setError("");
    setNotice("");
  }
  async function startRun() {
    if (
      !workingPlan ||
      !isConfirmed ||
      readOnly ||
      (record && workingPlan.fingerprint !== record.planFingerprint)
    )
      return;
    await act("run", async () => {
      const response =
        session.mode === "sample"
          ? await api<{ runId: string }>("/api/run", {
              variant: session.variant,
              confirmed: true,
              confirmedPlanId: workingPlan.planId,
              confirmedPlanFingerprint: workingPlan.fingerprint,
            })
          : await api<{ runId: string }>("/api/run-confirmed", {
              confirmationId: confirmation?.confirmationId,
            });
      ++loadEpoch.current;
      setRecord(null);
      setComparison(null);
      setRerun(null);
      setStepId("");
      setSession((s) => ({ ...s, runId: response.runId }));
      setProgress({
        runId: response.runId,
        status: "running",
        finishedCriteria: 0,
        totalCriteria: workingPlan.criteria.length,
      });
    });
  }
  async function generatePlan() {
    if (readOnly) return;
    const epoch = ++loadEpoch.current;
    await act("generate", async () => {
      let p =
        project ||
        projects.find((p) => p.projectId === selectedTarget?.projectId) ||
        projects.find((p) => p.targetVariant === session.variant);
      if (!p || p.targetVariant !== session.variant)
        p = (
          await api<{ project: ProjectRecord }>("/api/projects", {
            name: projectName.trim() || "My acceptance project",
            targetVariant: session.variant,
          })
        ).project;
      if (epoch !== loadEpoch.current) return;
      setProject(p);
      setSession((s) => ({ ...s, projectId: p!.projectId }));
      const { requirement: r } = await api<{ requirement: RequirementRecord }>(
        `/api/projects/${p.projectId}/requirements`,
        { text: requirementText },
      );
      if (epoch !== loadEpoch.current) return;
      setRequirement(r);
      setDraft(null);
      setConfirmation(null);
      setRecord(null);
      setProgress(null);
      setSession((s) => ({
        ...s,
        requirementId: r.requirementId,
        draftId: undefined,
        confirmationId: undefined,
        runId: undefined,
      }));
      const { draft: d } = await api<{ draft: DraftRecord }>("/api/generate", {
        requirementId: r.requirementId,
      });
      if (epoch !== loadEpoch.current) return;
      setDraft(d);
      setSession((s) => ({ ...s, draftId: d.draftId }));
      setCriterionId(d.plan.criteria[0]?.id || "");
      setSheet(null);
    });
  }
  async function confirmPlan() {
    if (readOnly) return;
    if (session.mode === "sample") {
      setSampleConfirmed(true);
      setNotice("Plan confirmed. You can now run real browser checks.");
      return;
    }
    if (!draft) return;
    await act("confirm", async () => {
      const { confirmation: c } = await api<{
        confirmation: ConfirmationRecord;
      }>("/api/confirm", {
        draftId: draft.draftId,
        displayedPlanFingerprint: draft.plan.fingerprint,
      });
      setConfirmation(c);
      setSession((s) => ({ ...s, confirmationId: c.confirmationId }));
      setNotice("Confirmed version saved. Repairs will be checked against the same standard.");
    });
  }
  async function createRepair() {
    if (!record || readOnly) return;
    await act("repair", async () => {
      try {
        await api("/api/repair-tasks", { baselineRunId: record.runId });
      } catch (e) {
        if (!(e as ApiError).existingTaskId) throw e;
      }
      await refreshLists();
      setNotice("Evidence is ready. Your connected coding AI can claim the task and start a repair.");
      setSheet("prompt");
    });
  }
  async function refreshProjects() {
    const [targetList, projectList] = await Promise.all([
      api<{ targets: TargetInfo[] }>("/api/targets"),
      api<{ projects: ProjectRecord[] }>("/api/projects"),
    ]);
    setTargets(targetList.targets);
    setProjects(projectList.projects);
  }
  async function openProject(target: TargetInfo, hint?: ProjectRecord) {
    if (busy || running) return;
    if (readOnly) {
      const historical = history.find(
        (run) => run.targetVariant === target.variant,
      );
      if (historical) await act("history", () => showRun(historical.runId));
      else setNotice("No recorded demo is available for this project yet.");
      return;
    }
    if (target.isSample !== false) {
      resetContext("sample", target.variant);
      setView("workspace");
      return;
    }
    await act("project", async () => {
      const projectId =
        hint?.projectId ||
        target.projectId ||
        projects.find((p) => p.targetVariant === target.variant)?.projectId;
      if (!projectId) throw new Error("Unable to load this project. Refresh the project list.");
      const data = await api<{
        project: ProjectRecord;
        requirements: RequirementRecord[];
        drafts: DraftRecord[];
        confirmations: ConfirmationRecord[];
      }>(`/api/projects/${projectId}/workspace`);
      ++loadEpoch.current;
      const newestRequirement = data.requirements[0] || null;
      const newestDraft =
        data.drafts.find(
          (d) => d.requirementId === newestRequirement?.requirementId,
        ) || null;
      const currentConfirmation =
        data.confirmations.find(
          (c) => c.draftId === newestDraft?.draftId && c.active !== false,
        ) || null;
      setProject(data.project);
      setProjectName(data.project.name);
      setRequirement(newestRequirement);
      setRequirementText(newestRequirement?.text || "");
      setDraft(newestDraft);
      setConfirmation(currentConfirmation);
      setRecord(null);
      setProgress(null);
      setComparison(null);
      setRerun(null);
      setSampleConfirmed(false);
      setSession({
        mode: "requirement",
        variant: target.variant,
        projectId,
        requirementId: newestRequirement?.requirementId,
        draftId: newestDraft?.draftId,
        confirmationId: currentConfirmation?.confirmationId,
      });
      setView("workspace");
      if (!newestRequirement) setSheet("requirements");
    });
  }
  function requirementSaved(next: RequirementRecord) {
    setRequirement(next);
    setRequirementText(next.text);
    setDraft(null);
    setConfirmation(null);
    setRecord(null);
    setProgress(null);
    setSession((s) => ({
      ...s,
      mode: "requirement",
      requirementId: next.requirementId,
      draftId: undefined,
      confirmationId: undefined,
      runId: undefined,
    }));
  }
  function draftSaved(next: DraftRecord) {
    setDraft(next);
    setConfirmation(null);
    setRecord(null);
    setProgress(null);
    setSession((s) => ({
      ...s,
      mode: "requirement",
      draftId: next.draftId,
      requirementId: next.requirementId,
      confirmationId: undefined,
      runId: undefined,
    }));
    setCriterionId(next.plan.criteria[0]?.id || "");
    setStepId("");
    setSheet(null);
    setView("workspace");
    setNotice(
      next.hasOpenQuestions
        ? "Draft saved. Resolve the open questions before confirming the plan."
        : "Draft saved. Review each criterion, action, and expected result, then confirm the plan.",
    );
  }
  function projectConnected(target: TargetInfo, created: ProjectRecord) {
    resetContext("requirement", target.variant);
    setProject(created);
    setProjectName(created.name);
    setSession({
      mode: "requirement",
      variant: target.variant,
      projectId: created.projectId,
    });
    setView("workspace");
    setSheet("requirements");
    void refreshProjects().catch((e) => setError(e.message));
  }
  function reviewStandards() {
    if (busy || running) return;
    ++loadEpoch.current;
    setRecord(null);
    setProgress(null);
    setStepId("");
    setSession((s) => ({ ...s, runId: undefined }));
  }
  async function cancelRun() {
    if (!session.runId || !running || readOnly) return;
    await act("cancel", async () => {
      await api(`/api/run/${session.runId}/cancel`, {});
      setNotice(
        "Stop requested. Captured evidence is preserved; unfinished checks will not be marked as passed.",
      );
    });
  }
  const repairPrompt = task
    ? `Please use the connected Ming MCP server to repair task ${task.taskId}.\nRead ming_get_repair_task and ming_get_failed_run before changing code. Claim the task with your actual agent name.\nFix only the target application (${task.targetVariant}); preserve the original acceptance plan, runner, assertions, target identity, and baseline evidence. Do not switch to a healthy sample.\nAfter changing the source, call ming_rerun_plan with the current expectedTargetFingerprint, then ming_get_comparison. Report a verified repair only when comparison.verifiedRepair is true.\nBaseline: ${task.baselineRunId}\nPlan fingerprint: ${task.planFingerprint}\n${task.reproductionSteps}`
    : "";
  const stalePlan =
    !!record &&
    !!workingPlan &&
    record.planFingerprint !== workingPlan.fingerprint;
  const staleSource =
    !!record &&
    !!selectedTarget &&
    record.sourceBinding !== "live-url-observed" &&
    selectedTarget.fingerprint !== "unknown" &&
    record.targetFingerprint !== selectedTarget.fingerprint;
  const canConfirm =
    !!workingPlan &&
    !stalePlan &&
    (session.mode === "sample" ||
      (!!draft &&
        !draft.hasOpenQuestions &&
        draft.validationErrors.length === 0));
  const canRepair =
    record?.criteria.some((c) => c.status === "failed") && !task;

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        // A global shortcut must not unmount an editor or an in-flight request.
        if (!sheet || sheet === "commands") setSheet(s => s === "commands" ? null : "commands");
      }
      if (event.key === "Escape" && !sheet) setFocusMode(false);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [sheet]);

  return (
    <div className={`app-shell ${focusMode && view === "workspace" ? "focus-mode" : ""}`}>
      <header className="topbar">
        <a className="brand" href="#workspace" aria-label="Ming acceptance workspace" onClick={event => { event.preventDefault(); if (!running && !busy) setView("projects"); }}>
          Ming<span>Every done comes with proof.</span>
        </a>
        <nav aria-label="Workspace tools">
          <a className="trial-nav-link" href="#upload" aria-label="Check your app" title="Check your app"><Plus size={15} /><span>Check your app</span></a>
          <a className="trial-nav-link" href="#trial" aria-label="Live sample" title="Live sample"><Play size={15} weight="fill" /><span>Live sample</span></a>
          <button className="command-trigger" onClick={() => setSheet("commands")} aria-label="Open command menu"><MagnifyingGlass size={16}/><span>Jump to…</span><kbd>Ctrl K</kbd></button>
          <button
            aria-label="Projects"
            className={`subtle-button ${view === "projects" ? "active-nav" : ""}`}
            disabled={!!busy || !!running}
            onClick={() => {
              setView("projects");
              void refreshProjects().catch((e) => setError(e.message));
            }}
          >
            <FolderOpen size={18} />
            <span>Projects</span>
          </button>
          {!readOnly && (
            <button
              aria-label="Connect project"
              className="subtle-button connect-project-button"
              disabled={!!busy || !!running}
              onClick={() => setSheet("connect")}
            >
              <Plus size={17} />
              <span>Connect project</span>
            </button>
          )}
          <button
            className="subtle-button"
            aria-label={provider?.configured ? "Model connected" : "Connect model"}
            onClick={() => setSheet("model")}
          >
            <Sparkle size={17} />
            <span>{provider?.configured ? "Model connected" : "Connect model"}</span>
          </button>
          <button
            className="subtle-button"
            aria-label="Run history"
            onClick={() => {
              setSheet("history");
              void refreshLists().catch((e) => setError(e.message));
            }}
          >
            <ClockCounterClockwise size={18} />
            <span>Run history</span>
          </button>
          <button
            className="subtle-button"
            aria-label="Connect AI"
            onClick={() => setSheet("ai")}
          >
            <TerminalWindow size={18} />
            <span>Connect AI</span>
          </button>
          <button
            className="icon-button"
            aria-label="Project setup"
            disabled={running || !!busy || readOnly}
            onClick={() =>
              setSheet(
                view === "projects"
                  ? "connect"
                  : selectedTarget?.isSample === false
                    ? "requirements"
                    : "setup",
              )
            }
          >
            <GearSix size={20} />
          </button>
        </nav>
      </header>
      <main id="workspace">
        {view === "projects" && (error || notice) && (
          <div
            className={`message ${error ? "error-message" : "notice-message"}`}
            role={error ? "alert" : "status"}
          >
            <Info size={18} />
            <span>{error || notice}</span>
          </div>
        )}
        {view === "projects" ? (
          <ProjectHub
            targets={targets}
            projects={projects}
            history={history}
            readOnly={readOnly}
            onConnect={() => setSheet("connect")}
            onOpen={(target, p) => void openProject(target, p)}
            onArchived={() =>
              void refreshProjects().catch((e) => setError(e.message))
            }
          />
        ) : (
          <>
            <section className="workspace-intro studio-intro">
              <div>
                <div className="eyebrow">
                  EVIDENCE STUDIO
                </div>
                <h1>
                  See what <em>actually</em> works<span className="heading-dot">.</span>
                </h1>
                <p>
                  From a requirement to a real browser check. Every result comes with evidence.
                </p>
              </div>
              <div className="run-summary" aria-label="Acceptance results">
                <span>
                  <CheckCircle size={20} weight="fill" className="green" />
                  <strong>{activeCount}</strong> passed
                </span>
                <span>
                  <XCircle size={20} weight="fill" className="red" />
                  <strong>{failedCount}</strong> failed
                </span>
                <span>
                  <CircleNotch
                    size={20}
                    className={running ? "spin" : "muted"}
                  />
                  <strong>
                    {record
                      ? record.criteria.length - activeCount - failedCount
                      : criteria.length}
                  </strong>{" "}
                  {running ? "running" : "unchecked"}
                </span>
              </div>
            </section>
            {readOnly && (
              <div className="message public-notice trial-public-notice">
                <Info size={19} />
                <span>
                  <strong>Recorded demo · Real checks, preserved evidence.</strong>{" "}
                  Explore the steps, original screenshots, and repair comparison. Run Ming locally
                  to check your own app and connect your coding AI.
                </span>
                <a className="secondary-button live-trial-link" href="#trial"><Play size={15} weight="fill" />Run a live sample</a>
              </div>
            )}
            <div className="workspace-toolbar">
              <div className="project-picker">
                <span className="project-label">Project</span>
                <select
                  aria-label="Project"
                  value={session.variant}
                  disabled={running || !!busy}
                  onChange={(e) => {
                    const next = targets.find(
                      (t) => t.variant === e.target.value,
                    );
                    if (next) void openProject(next);
                  }}
                >
                  <optgroup label="Projects">
                    {targets
                      .filter(
                        (t) =>
                          t.isSample === false &&
                          (!t.archived || t.variant === session.variant),
                      )
                      .map((t) => (
                        <option key={t.variant} value={t.variant}>
                          {t.label}
                          {t.archived ? " (archived)" : ""}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Sample projects">
                    {targets
                      .filter((t) => t.isSample !== false)
                      .map((t) => (
                        <option key={t.variant} value={t.variant}>
                          {t.label}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
              <span className="plan-origin">
                <FileText size={15} />
                {plan?.source === "manual"
                  ? "Manual plan · No model calls"
                  : plan?.source === "generated"
                    ? plan.transportProvenance === "live"
                      ? "AI-generated · Source recorded"
                      : "Test fixture · No real model used"
                    : selectedTarget?.isSample === false
                      ? "Create an acceptance plan to begin"
                      : "Sample plan · No model calls"}
              </span>
              <div className="toolbar-actions">
                {readOnly && comparison ? <button className="secondary-button" onClick={() => setSheet("comparison")}><ArrowRight size={16} />Explore repair</button> : <button
                  className="secondary-button"
                  disabled={running || !!busy || readOnly}
                  onClick={() =>
                    setSheet(
                      selectedTarget?.isSample === false
                        ? "requirements"
                        : "setup",
                    )
                  }
                >
                  {selectedTarget?.isSample === false
                    ? "Requirements"
                    : "Requirements"}
                </button>}
                {draft && session.mode === "requirement" && (
                  <button
                    className="secondary-button"
                    disabled={!!busy || !!running || readOnly}
                    onClick={() => setSheet("plan")}
                  >
                    <PencilSimple size={16} />
                    Edit plan
                  </button>
                )}
                {record && readOnly && (
                  <button
                    className="secondary-button"
                    onClick={() =>
                      downloadText(
                        `ming-run-${record.runId}.json`,
                        JSON.stringify(record, null, 2),
                      )
                    }
                  >
                    <DownloadSimple size={16} />
                    Export run
                  </button>
                )}
                {record && !readOnly && (
                  <details className="report-export">
                    <summary className="secondary-button">
                      <DownloadSimple size={16} />
                      Export report
                    </summary>
                    <div>
                      {[
                        ["html", "HTML report"],
                        ["json", "Complete JSON data"],
                        ["markdown", "Markdown report"],
                      ].map(([format, label]) => (
                        <a
                          key={format}
                          href={`/api/run/${record.runId}/report?format=${format}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {label}
                        </a>
                      ))}
                    </div>
                  </details>
                )}
                <button
                  className="primary-button"
                  disabled={
                    !ready ||
                    !isConfirmed ||
                    !!busy ||
                    !!running ||
                    readOnly ||
                    stalePlan
                  }
                  onClick={() => void startRun()}
                >
                  {running || busy === "run" ? (
                    <CircleNotch className="spin" size={17} />
                  ) : (
                    <Play size={16} weight="fill" />
                  )}
                  {readOnly
                    ? "Recorded run"
                    : running
                      ? "Running checks"
                      : record
                        ? "Run again"
                        : "Run checks"}
                </button>
              </div>
            </div>
            <div aria-live="polite">
              {error && (
                <div className="message error-message" role="alert">
                  <WarningCircle size={20} />
                  <span>{error}</span>
                  <button
                    className="icon-button"
                    aria-label="Dismiss error"
                    onClick={() => setError("")}
                  >
                    <X size={17} />
                  </button>
                </div>
              )}
              {notice && (
                <div className="message notice-message">
                  <Info size={18} />
                  <span>{notice}</span>
                  <button
                    className="icon-button"
                    aria-label="Dismiss notification"
                    onClick={() => setNotice("")}
                  >
                    <X size={17} />
                  </button>
                </div>
              )}
              {running && (
                <div className="message progress-message">
                  <CircleNotch className="spin" size={19} />
                  <span>
                    The browser is interacting with your app. {progress?.finishedCriteria}{" "}
                    / {progress?.totalCriteria} checks complete
                    {progress?.currentCriteria
                      ? ` · Checking: ${progress.currentCriteria}`
                      : ""}
                  </span>
                  <progress
                    value={progress?.finishedCriteria}
                    max={progress?.totalCriteria || 1}
                  />
                  <button
                    className="secondary-button"
                    disabled={!!busy || readOnly}
                    onClick={() => void cancelRun()}
                  >
                    <Stop size={14} />
                    {busy === "cancel" ? "Stopping…" : "Stop checks"}
                  </button>
                </div>
              )}
            </div>
            {(stalePlan || staleSource) && (
              <div className="message history-notice">
                <ClockCounterClockwise size={18} />
                <span>
                  You are viewing recorded evidence.{" "}
                  {staleSource ? "The source has changed; the original results are preserved. " : ""}
                  {stalePlan
                    ? "The plan has changed. Review the current version before running it."
                    : ""}
                </span>
                {stalePlan && !readOnly && (
                  <button
                    className="secondary-button"
                    onClick={() =>
                      selectedTarget?.isSample === false
                        ? void openProject(selectedTarget)
                        : resetContext("sample")
                    }
                  >
                    View current plan
                  </button>
                )}
              </div>
            )}
            {confirmation?.active === false && (
              <div className="message history-notice">
                <Info size={18} />
                <span>
                  A newer plan replaces this version. Past evidence remains available; confirm the current plan before starting a new run.
                </span>
                <button
                  className="secondary-button"
                  onClick={() =>
                    selectedTarget && void openProject(selectedTarget)
                  }
                >
                  Review current version
                </button>
              </div>
            )}
            {selectedTarget?.isSample === false && (
              <div className="project-workflow-bar">
                <span>
                  <CheckCircle size={16} />
                  Project connected
                </span>
                <button
                  className={requirement ? "complete" : "current"}
                  disabled={!!busy || !!running}
                  onClick={() => setSheet("requirements")}
                >
                  1. {requirement ? "Requirements saved" : "Add requirements"}
                </button>
                <ArrowRight size={14} />
                <button
                  className={isConfirmed ? "complete" : draft ? "current" : ""}
                  disabled={!requirement || !!busy || !!running}
                  onClick={() => (draft ? reviewStandards() : setSheet("plan"))}
                >
                  2.{" "}
                  {isConfirmed
                    ? "Plan confirmed"
                    : draft
                      ? "Review plan"
                      : "Create plan"}
                </button>
                <ArrowRight size={14} />
                <span className={record ? "complete" : ""}>
                  3. {record ? "View evidence" : "Run checks"}
                </span>
              </div>
            )}
            <div className="xray-layout">
              <aside
                className="requirements-column"
                aria-label="Requirements and acceptance criteria"
              >
                <div className="column-heading">
                  <span>01</span>
                  <h2>Requirements</h2>
                  <FileText size={19} />
                </div>
                <section className="panel requirement-panel">
                  <div className="panel-kicker">
                    {session.mode === "sample" ? "Sample requirement" : "Source requirement"}
                    <span>{plan ? `v${plan.version}` : "No plan yet"}</span>
                  </div>
                  <h3>
                    {selectedCriterion?.title || "Define what “done” looks like"}
                  </h3>
                  <p>
                    {selectedCriterion?.requirementRef ||
                      selectedCriterion?.expectedBehavior ||
                      selectedCriterion?.description ||
                      "Choose a sample or add your requirements. Review the plan, then run your checks."}
                  </p>
                  {(requirement?.text || plan?.originalRequirement) && (
                    <details>
                      <summary>Read all requirements</summary>
                      <p className="requirement-text">
                        {plan?.originalRequirement || requirement?.text}
                      </p>
                    </details>
                  )}
                  {selectedCriterion?.openQuestions?.length ? (
                    <div className="inline-warning">
                      Open questions: {selectedCriterion.openQuestions.join("; ")}
                    </div>
                  ) : null}
                  <div className="source-note">
                    <Fingerprint size={14} />
                    <span>
                      Plan {short(record?.planFingerprint || plan?.fingerprint)}
                    </span>
                  </div>
                </section>
                <section className="panel criteria-panel">
                  <div className="panel-heading">
                    <h3>
                      <ListChecks size={19} />
                      Acceptance criteria
                    </h3>
                    <span className="small-muted">{criteria.length} checks</span>
                  </div>
                  <div className="criteria-list">
                    {criteria.map((c) => {
                      const r = record?.criteria.find(
                        (x) => x.criteriaId === c.id,
                      );
                      return (
                        <button
                          key={c.id}
                          className={`criterion-button ${criterionId === c.id ? "selected" : ""}`}
                          aria-pressed={criterionId === c.id}
                          onClick={() => {
                            setCriterionId(c.id);
                            setStepId("");
                          }}
                        >
                          <span className="criterion-code">{c.id}</span>
                          <span className="criterion-title">{c.title}</span>
                          <Status value={r?.status || "pending"} />
                        </button>
                      );
                    })}
                  </div>
                  {workingPlan && !readOnly && !record && (
                    <div className="confirmation-area">
                      {draft?.validationErrors.length &&
                      session.mode === "requirement" ? (
                        <div className="inline-warning">
                          Draft validation failed: {draft.validationErrors.join("; ")}
                        </div>
                      ) : null}
                      {draft?.hasOpenQuestions &&
                        session.mode === "requirement" && (
                          <div className="inline-warning">
                            Resolve the open questions before confirming this plan.
                          </div>
                        )}
                      {!isConfirmed ? (
                        <>
                          <p>
                            Review the criteria, dependencies, and actions. Confirm when the standard is right.
                          </p>
                          <button
                            className="secondary-button full-width"
                            disabled={!canConfirm || !!busy}
                            onClick={() => void confirmPlan()}
                          >
                            <Check size={16} />
                            Confirm plan
                          </button>
                        </>
                      ) : (
                        <div className="confirmed-note">
                          <ShieldCheck size={18} />
                          Plan confirmed · The same standard is used after repairs
                        </div>
                      )}
                    </div>
                  )}
                </section>
                <section className="panel steps-panel">
                  <div className="panel-heading">
                    <h3>
                      <GitBranch size={18} />
                      {record ? "Recorded interactions" : "Planned interactions"}
                    </h3>
                    {result && <Status value={result.status} />}
                  </div>
                  {selectedCriterion?.dependsOn?.length ? (
                    <p className="context-note">
                      Depends on: {selectedCriterion.dependsOn.join(", ")} ·{" "}
                      {selectedCriterion.contextMode === "inherit"
                        ? "Continue in the same browser"
                        : "Fresh browser context"}
                    </p>
                  ) : (
                    <p className="context-note">
                      {selectedCriterion?.prerequisites ||
                        "Checked in a fresh browser context"}
                    </p>
                  )}
                  <ol className="step-list">
                    {(result?.steps || selectedCriterion?.steps || []).map(
                      (s, i) => {
                        const observed =
                          "stepId" in s ? (s as StepResult) : undefined;
                        const id =
                          observed?.stepId || ("id" in s ? s.id : String(i));
                        return (
                          <li key={id}>
                            <button
                              className={
                                selectedStep?.stepId === id
                                  ? "step-button active"
                                  : "step-button"
                              }
                              disabled={!observed}
                              onClick={() => setStepId(id)}
                            >
                              <span
                                className={`step-number ${observed?.status || ""}`}
                              >
                                {observed?.status === "passed" ? (
                                  <Check size={12} />
                                ) : observed?.status === "failed" ? (
                                  <X size={12} />
                                ) : (
                                  i + 1
                                )}
                              </span>
                              <span>
                                {s.description}
                                {observed && (
                                  <small>
                                    {labels[observed.status]}
                                    {observed.durationMs !== undefined
                                      ? ` · ${observed.durationMs} ms`
                                      : ""}
                                  </small>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      },
                    )}
                  </ol>
                  {!result && !selectedCriterion?.steps?.length && (
                    <p className="empty-copy">
                      Your plan’s steps will appear here.
                    </p>
                  )}
                </section>
              </aside>
              <section className="evidence-column" aria-label="Real browser evidence">
                <div className="column-heading">
                  <span>02</span>
                  <h2>The app, under inspection</h2>
                  {record && <button className="icon-button focus-toggle" aria-label={focusMode ? "Exit evidence focus" : "Focus on evidence"} aria-pressed={focusMode} onClick={() => setFocusMode(v => !v)}>{focusMode ? <ArrowsInSimple size={18}/> : <ArrowsOutSimple size={18}/>}</button>}
                  {record ? (
                    <span className="small-muted">
                      {time(record.startedAt)}
                    </span>
                  ) : (
                    <MagnifyingGlass size={19} />
                  )}
                </div>
                {record && <ProofTimeline run={record} criterionId={criterionId} stepId={selectedStep?.stepId} onSelect={(criterion, step) => { setCriterionId(criterion); setStepId(step); }} />}
                {record && imageStep ? (
                  <div className="evidence-canvas">
                    {predecessor?.screenshotPath &&
                      predecessor.screenshotPath !==
                        imageStep.screenshotPath && (
                        <>
                          <EvidenceImage
                            step={predecessor}
                            run={record}
                            caption="Page after the prerequisite"
                          />
                          <div className="transition-label">
                            <ArrowDown size={27} />
                            <span>
                              {selectedCriterion?.contextMode === "inherit"
                                ? "Same browser · Next check"
                                : "Next acceptance check"}
                            </span>
                          </div>
                        </>
                      )}
                    {selectedStep &&
                      selectedStep.stepId !== imageStep.stepId && (
                        <p className="image-context-note">
                          This step has no separate screenshot. Showing evidence from {imageStep.stepId}.
                        </p>
                      )}
                    <EvidenceImage
                      step={imageStep}
                      run={record}
                      caption={imageStep.description}
                    />
                    <div
                      className={`evidence-verdict verdict-${result?.status || "pending"}`}
                    >
                      <div className="verdict-icon">
                        {result?.status === "failed" ? (
                          <XCircle size={28} weight="fill" />
                        ) : result?.status === "passed" ? (
                          <CheckCircle size={28} weight="fill" />
                        ) : (
                          <WarningCircle size={28} />
                        )}
                      </div>
                      <div>
                        <strong>
                          {result?.status === "passed"
                            ? "Check passed"
                            : result?.status === "failed"
                              ? "Check failed"
                              : labels[result?.status || "pending"]}
                          ：{result?.title}
                        </strong>
                        <p>
                          {result?.blockedReason ||
                            selectedStep?.actual ||
                            "Based on this run’s browser actions and assertions."}
                        </p>
                      </div>
                    </div>
                    {evidenceSteps.length > 1 && (
                      <div className="evidence-strip" aria-label="Choose a screenshot">
                        {evidenceSteps.map((s, i) => (
                          <button
                            key={s.stepId}
                            className={
                              s.stepId === imageStep.stepId ? "active" : ""
                            }
                            onClick={() => setStepId(s.stepId)}
                            aria-label={`View screenshot ${i + 1}: ${s.description}`}
                          >
                            <span>{String(i + 1).padStart(2, "0")}</span>
                            {s.status === "failed"
                              ? "Failure evidence"
                              : `Step ${i + 1}`}
                            <Status value={s.status} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={`empty-canvas ${running ? "is-running" : ""}`}
                  >
                    <div className="empty-icon">
                      {running ? (
                        <CircleNotch size={38} className="spin" />
                      ) : (
                        <MagnifyingGlass size={38} weight="light" />
                      )}
                    </div>
                    <div className="eyebrow">PROOF, NOT PROMISES</div>
                    <h2>
                      {running
                        ? "Collecting the real story"
                        : "Put “done” to the test"}
                    </h2>
                    <p>
                      {running
                        ? "Ming is interacting with the browser, checking assertions, and capturing screenshots. The evidence will appear here."
                        : "Review and confirm the plan on the left, then choose Run checks. See the real page, each interaction, and the evidence behind the result."}
                    </p>
                    {!running && (
                      <span className="empty-footnote">
                        {selectedTarget?.isSample === false
                          ? "Generate a draft with AI or write your own plan"
                          : "Sample plans are ready to run · No model calls"}
                      </span>
                    )}
                    {record?.fatalError && (
                      <div className="inline-warning">
                        {record.terminationReason === "cancelled"
                          ? "This run was cancelled. Unfinished checks are not marked as passed."
                          : record.terminationReason === "deadline"
                            ? "This run timed out. Check the app connection or reduce the plan’s scope."
                            : record.fatalError}
                      </div>
                    )}
                    {!record &&
                      !running &&
                      selectedTarget?.isSample === false && (
                        <button
                          className="primary-button onboarding-inline-cta"
                          onClick={() =>
                            setSheet(requirement ? "plan" : "requirements")
                          }
                        >
                          {requirement ? "Create plan" : "Add requirements"}
                          <ArrowRight size={16} />
                        </button>
                      )}
                  </div>
                )}
                <div className="evidence-footer">
                  <ShieldCheck size={16} />
                  <span>
                    {record
                      ? "Captured in this browser run · Open any image to inspect the original"
                      : "Real actions · Independent checks · Traceable evidence"}
                  </span>
                  {record && <code>{short(record.runId)}</code>}
                </div>
              </section>
              <aside className="inspection-column" aria-label="Results and repair">
                <div className="column-heading">
                  <span>03</span>
                  <h2>Results and repair</h2>
                  <ShieldCheck size={20} />
                </div>
                <section
                  className={`panel observation-panel ${result?.status === "failed" ? "has-failure" : ""}`}
                >
                  <div className="panel-heading">
                    <h3>Expected vs. observed</h3>
                    {result && <Status value={result.status} />}
                  </div>
                  <div className="observation-block">
                    <span className="observation-label">EXPECTED</span>
                    <p>
                      {selectedStep?.expected !== undefined
                        ? String(selectedStep.expected)
                        : selectedCriterion?.expectedBehavior ||
                          selectedCriterion?.description ||
                          "Defined by your requirements and confirmed acceptance criteria."}
                    </p>
                  </div>
                  <div className="observation-block actual-block">
                    <span className="observation-label">OBSERVED</span>
                    <p>
                      {selectedStep?.actual ||
                        result?.blockedReason ||
                        (record
                          ? "No separate observation was recorded for this step. Inspect its action and screenshot."
                          : "Waiting for the browser. No result yet.")}
                    </p>
                  </div>
                  {selectedStep?.error && (
                    <details className="error-detail">
                      <summary>Assertion details</summary>
                      <pre>{selectedStep.error}</pre>
                    </details>
                  )}
                  <div className="capture-note">
                    <Info size={14} />
                    <span>
                      {record?.diagnostics
                        ? `${record.diagnostics.length} browser diagnostics captured`
                        : "No browser diagnostics in this run"}
                    </span>
                  </div>
                  {!!record?.diagnostics?.length && (
                    <details className="diagnostics-panel">
                      <summary>Network and console records</summary>
                      <ul>
                        {record.diagnostics.map((item, i) => (
                          <li key={i}>
                            <strong>
                              {item.kind}
                              {item.status ? ` · ${item.status}` : ""}
                            </strong>
                            <p>{item.message}</p>
                            {item.url && <code>{item.url}</code>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </section>
                {result?.status === "failed" && (
                  <section
                    className={`hypothesis-panel ${comparison?.verifiedRepair ? "resolved" : ""}`}
                  >
                    <WarningCircle size={20} />
                    <div>
                      <h3>
                        {comparison?.verifiedRepair
                          ? "This failure has a follow-up result"
                          : "Failure reproduced. Cause to investigate."}
                      </h3>
                      <p>
                        {comparison?.verifiedRepair
                          ? "Original failure evidence is preserved. The updated code passed the same checks."
                          : "The behavior does not match the requirement. Your coding AI can inspect the project to establish the cause."}
                      </p>
                      <span>
                        {comparison?.verifiedRepair
                          ? "Compare before and after below"
                          : "Observations are kept separate from hypotheses"}
                      </span>
                    </div>
                  </section>
                )}
                <section className="panel repair-panel">
                  <div className="panel-heading">
                    <h3>
                      <PaperPlaneTilt size={20} />
                      Ready for your coding AI
                    </h3>
                  </div>
                  <ul className="packet-list">
                    <li>
                      <span>01</span>
                      <div>
                        <strong>The original standard</strong>
                        <small>Requirements, plan version, prerequisites</small>
                      </div>
                    </li>
                    <li>
                      <span>02</span>
                      <div>
                        <strong>Steps to reproduce</strong>
                        <small>Actions taken, expected and actual results</small>
                      </div>
                    </li>
                    <li>
                      <span>03</span>
                      <div>
                        <strong>The failure, captured</strong>
                        <small>Original screenshots and preserved run records</small>
                      </div>
                    </li>
                    <li>
                      <span>04</span>
                      <div>
                        <strong>The same standard, again</strong>
                        <small>Recheck the same behavior after a code change</small>
                      </div>
                    </li>
                  </ul>
                  {task ? (
                    <div className="task-state">
                      <div>
                        <Status value={task.status} />
                        <code>{short(task.taskId)}</code>
                      </div>
                      <p>
                        {task.status === "waiting"
                          ? "Evidence is ready. Waiting for your connected AI to claim the task."
                          : task.status === "claimed"
                            ? `Claimed by ${task.claimedBy || "AI"}. The repair has not been verified yet.`
                            : task.status === "rerunning"
                              ? "Checking the updated code against the original standard."
                              : comparison?.verifiedRepair
                                ? "The code changed and passed the same acceptance standard."
                                : task.status === "review"
                                  ? "The same checks passed. This live app was not frozen as a complete source snapshot, so repair attribution needs human review."
                                  : task.blockedReason ||
                                    "Verification is complete. Review the comparison and any blockers."}
                      </p>
                      {task.attemptCount !== undefined && (
                        <small>
                          Verification attempts: {task.attemptCount} / {task.maxAttempts ?? 2}
                        </small>
                      )}
                      <button
                        className="secondary-button full-width"
                        onClick={() => setSheet("prompt")}
                      >
                        <Copy size={16} />
                        View AI handoff
                      </button>
                      {comparison && (
                        <button
                          className={`full-width ${comparison.verifiedRepair ? "success-button" : "secondary-button"}`}
                          onClick={() => setSheet("comparison")}
                        >
                          <GitBranch size={17} />
                          Compare before and after
                          <ArrowRight size={17} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <button
                        className="primary-button full-width"
                        disabled={!canRepair || !!busy || !!running || readOnly}
                        onClick={() => void createRepair()}
                      >
                        <PaperPlaneTilt size={17} />
                        {busy === "repair" ? "Preparing evidence…" : "Create repair task"}
                        <ArrowRight size={17} />
                      </button>
                      <p className="repair-footnote">
                        {readOnly
                          ? "This is a read-only replay. Run Ming locally to create repair tasks."
                          : canRepair
                            ? "Your connected coding AI can read the evidence and repair the app."
                            : "A failed check unlocks a complete evidence package for repair."}
                      </p>
                    </>
                  )}
                </section>
                <details className="provenance-panel">
                  <summary>
                    <Fingerprint size={16} />
                    Trace this result
                  </summary>
                  <dl>
                    <dt>Plan</dt>
                    <dd>
                      {record?.planFingerprint || plan?.fingerprint || "Not created"}
                    </dd>
                    <dt>Target source</dt>
                    <dd>
                      {record?.targetFingerprint ||
                        selectedTarget?.fingerprint ||
                        "Not recorded"}
                    </dd>
                    <dt>Runner</dt>
                    <dd>{record?.runnerFingerprint || "Recorded after the run"}</dd>
                    <dt>Source binding</dt>
                    <dd>
                      {record?.sourceBinding === "self-contained-html-snapshot"
                        ? "Frozen HTML snapshot executed"
                        : record?.sourceBinding === "live-url-observed"
                          ? "Live page observed · Full app source not frozen"
                          : "No snapshot binding recorded"}
                    </dd>
                    <dt>Changes during the run</dt>
                    <dd>
                      {record
                        ? record.sourceChangedDuringRun
                          ? "Change detected · Repair cannot be verified"
                          : record.sourceChangedDuringRun === false
                            ? "None detected"
                            : "Not recorded"
                        : "Awaiting checks"}
                    </dd>
                  </dl>
                </details>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer className="app-footer">
        <span className="footer-brand">
          Ming <span>Proof behind every “done”</span>
        </span>
        <span>From “AI says it’s done” to “I saw it pass.”</span>
      </footer>
      {sheet === "commands" && <CommandMenu onClose={() => setSheet(null)} commands={[
        {label:"Projects",detail:"Your saved projects and the proof lab",disabled:!!running||!!busy,action:()=>{setView("projects");setSheet(null);}},
        {label:"Connect project",detail:"Add your local development app",disabled:readOnly||!!running||!!busy,action:()=>setSheet("connect")},
        {label:"Run history",detail:"Search recorded checks and original evidence",action:()=>{setSheet("history");void refreshLists().catch(e=>setError(e.message));}},
        {label:"Model settings",detail:"Configure your provider and review usage",action:()=>setSheet("model")},
        {label:"Connect coding AI",detail:"MCP configuration and workflow instructions",action:()=>setSheet("ai")},
        {label:focusMode?"Exit evidence focus":"Focus on evidence",detail:"Give the recorded browser evidence more room",disabled:!record||view!=="workspace",action:()=>{setFocusMode(v=>!v);setSheet(null);}},
      ]} />}
      <ProviderSettings
        open={sheet === "model"}
        onClose={() => setSheet(null)}
        onSaved={() => {
          void api<{ status: ProviderStatus }>("/api/provider/status")
            .then((r) => setProvider(r.status))
            .catch((e) => setError(e.message));
        }}
        readOnly={readOnly}
      />
      {sheet === "connect" && !readOnly && (
        <ProjectConnect
          onClose={() => setSheet(null)}
          onConnected={projectConnected}
        />
      )}
      {sheet === "requirements" && project && (
        <RequirementEditor
          project={project}
          requirement={requirement}
          onClose={() => setSheet(null)}
          onSaved={requirementSaved}
          onDraft={draftSaved}
          onManual={(next) => {
            setRequirement(next);
            setSheet("plan");
          }}
          onConfigureModel={() => setSheet("model")}
          providerConfigured={!!provider?.configured}
          readOnly={readOnly}
        />
      )}
      {sheet === "plan" && project && requirement && (
        <PlanEditor
          project={project}
          requirement={requirement}
          draft={draft}
          onClose={() => setSheet(null)}
          onSaved={draftSaved}
          readOnly={readOnly}
        />
      )}
      {sheet === "history" && (
        <RunHistory
          runs={history}
          targets={targets}
          currentRunId={record?.runId}
          disabled={!!busy || !!running}
          onClose={() => setSheet(null)}
          onSelect={(id) =>
            void act("history", async () => {
              await showRun(id);
              setSheet(null);
            })
          }
        />
      )}
      {sheet === "ai" && (
        <AiConnection onClose={() => setSheet(null)} readOnly={readOnly} />
      )}
      {sheet === "setup" && (
        <Sheet title="Project setup" onClose={() => setSheet(null)}>
          <p className="sheet-lead">Define what success means. Let the browser check each part.</p>
          <div className="mode-switch">
            <button
              disabled={!!busy}
              className={session.mode === "sample" ? "active" : ""}
              onClick={() => resetContext("sample")}
            >
              <Play size={17} />
              Try a sample
            </button>
            <button
              disabled={!!busy}
              className={session.mode === "requirement" ? "active" : ""}
              onClick={() => resetContext("requirement")}
            >
              <FileText size={17} />
              Use my requirements
            </button>
          </div>
          <label className="field">
            Project to check
            <select
              disabled={!!busy}
              value={session.variant}
              onChange={(e) => resetContext(session.mode, e.target.value)}
            >
              {targets
                .filter((t) => t.isSample !== false)
                .map((t) => (
                  <option key={t.variant} value={t.variant}>
                    {t.label}
                  </option>
                ))}
            </select>
          </label>
          {session.mode === "sample" ? (
            <>
              <div className="info-box">
                <Info size={20} />
                <p>
                  Samples use predefined plans and real browser checks, with no model calls. Intentional bugs show how Ming finds failures.
                </p>
              </div>
              <button
                className="primary-button full-width"
                onClick={() => setSheet(null)}
              >
                Review sample plan
                <ArrowRight size={17} />
              </button>
            </>
          ) : (
            <>
              <label className="field">
                Project name
                <input
                  disabled={!!busy}
                  value={projectName}
                  maxLength={120}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. My task manager"
                />
              </label>
              <label className="field">
                Requirements and boundaries
                <textarea
                  disabled={!!busy}
                  rows={7}
                  value={requirementText}
                  onChange={(e) => setRequirementText(e.target.value)}
                  placeholder="e.g. A new task appears in the list. After marking it complete and reloading, both the task and its completion state remain."
                />
              </label>
              <p className="field-help">
                Describe the actions, expected outcomes, and failure boundaries. AI
                uses the page structure to draft a plan for your review.
              </p>
              {!provider?.configured && (
                <div className="info-box warning-box">
                  <WarningCircle size={20} />
                  <p>
                    No model is connected. Try a sample plan, connect a model from the toolbar, or write a manual plan in Projects.
                  </p>
                </div>
              )}
              <button
                className="primary-button full-width"
                disabled={!!busy || !requirementText.trim() || readOnly}
                onClick={() => void generatePlan()}
              >
                {busy === "generate" ? (
                  <CircleNotch className="spin" size={17} />
                ) : (
                  <Sparkle size={18} />
                )}
                {busy === "generate" ? "Saving and generating…" : "Generate draft plan"}
              </button>
              {error && (
                <p className="inline-warning" role="alert">
                  {error}
                </p>
              )}
              {requirement && (
                <p className="small-muted">Requirements saved. Connect a model to try again.</p>
              )}
            </>
          )}
          <details className="scope-note">
            <summary>Connect another project</summary>
            <p>
              Choose Connect project to register a running local app with same-origin pages, scripts, and APIs. Proxy cross-origin APIs through your development server. You can also connect a self-contained
              HTML file. Live app results reflect observed behavior, not a frozen copy of the entire app.
            </p>
          </details>
        </Sheet>
      )}
      {sheet === "prompt" && (
        <Sheet title="Hand off to your AI" onClose={() => setSheet(null)}>
          <p className="sheet-lead">
            Give these instructions to your coding AI connected through Ming MCP.
            It can read the evidence, repair the app, and rerun the original acceptance standard.
          </p>
          {task ? (
            <>
              <div className="info-box">
                <TerminalWindow size={20} />
                <p>
                  Task {short(task.taskId)} · {labels[task.status]}
                  <br />
                  Your coding AI initiates the handoff. Claim and verification status update here automatically.
                </p>
              </div>
              <textarea
                className="prompt-text"
                readOnly
                rows={12}
                value={repairPrompt}
                aria-label="AI repair instructions"
              />
              <button
                className="primary-button full-width"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(repairPrompt)
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    })
                    .catch(() =>
                      setError("Clipboard access is unavailable. Copy the instructions from the text box."),
                    );
                }}
              >
                <Copy size={17} />
                {copied ? "Copied" : "Copy repair instructions"}
              </button>
            </>
          ) : (
            <p>Loading repair task…</p>
          )}
        </Sheet>
      )}
      {sheet === "comparison" && comparison && task && (
        <Sheet
          title={
            comparison.verifiedRepair ? "A repair you can verify" : "Repair comparison"
          }
          wide
          onClose={() => setSheet(null)}
        >
          <div
            className={`comparison-head ${comparison.verifiedRepair ? "verified" : "unverified"}`}
          >
            <ShieldCheck size={27} />
            <div>
              <h3>
                {comparison.verifiedRepair
                  ? "Verified repair"
                  : comparison.acceptancePassed
                    ? "Checks passed · Review needed"
                    : "Repair not yet verified"}
              </h3>
              <p>
                {comparison.verifiedRepair
                  ? "Same target, plan, and runner. The source changed, and previously failed checks now pass."
                  : comparison.acceptancePassed
                    ? "The same checks passed. Without a bound snapshot of the full source, this is acceptance evidence, not a verified repair."
                    : "A new result alone does not verify a repair. Review the blockers below."}
              </p>
            </div>
          </div>
          <div className="comparison-checks">
            {[
              ["Same acceptance standard", comparison.planFingerprintMatch],
              [
                "Same known runner",
                comparison.runnerFingerprintMatch &&
                  comparison.runnerFingerprintKnown,
              ],
              ["Same target", comparison.targetIdentityMatch],
              [
                "Source changed",
                comparison.targetFingerprintChanged &&
                  comparison.sourceFingerprintKnown,
              ],
            ].map(([label, good]) => (
              <span
                key={String(label)}
                className={good ? "check-good" : "check-bad"}
              >
                {good ? <CheckCircle size={17} /> : <WarningCircle size={17} />}
                {label}
              </span>
            ))}
          </div>
          {comparison.blockers.length > 0 && (
            <div className="inline-warning">
              <strong>Still to resolve</strong>
              <ul>
                {comparison.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="compare-versions">
            <div>
              <span>Before repair</span>
              <code>{short(comparison.baselineTargetFingerprint)}</code>
              <small>Run {short(comparison.baselineRunId)}</small>
            </div>
            <ArrowRight size={21} />
            <div>
              <span>After change</span>
              <code>{short(comparison.repairedTargetFingerprint)}</code>
              <small>Run {short(comparison.rerunId)}</small>
            </div>
          </div>
          {baseline && rerun && (() => {
            const id = task.failedCriteria[0]?.criteriaId || criterionId;
            const before = last(baseline.criteria.find(c=>c.criteriaId===id)?.steps.filter(s=>s.screenshotPath));
            const after = last(rerun.criteria.find(c=>c.criteriaId===id)?.steps.filter(s=>s.screenshotPath));
            return before && after ? <EvidenceCompare before={{run:baseline,step:before}} after={{run:rerun,step:after}} /> : null;
          })()}
          <div className="comparison-table">
            <div className="comparison-row table-header">
              <span>Acceptance criteria</span>
              <span>Before repair</span>
              <span>After change</span>
            </div>
            {(
              task.planSnapshot?.criteria ||
              baseline?.criteria.map((c) => ({
                id: c.criteriaId,
                title: c.title,
              })) ||
              []
            ).map((c) => (
              <div className="comparison-row" key={c.id}>
                <span>
                  {c.id} · {c.title}
                </span>
                <Status
                  value={
                    baseline?.criteria.find((x) => x.criteriaId === c.id)
                      ?.status || "not_run"
                  }
                />
                <Status
                  value={
                    rerun?.criteria.find((x) => x.criteriaId === c.id)
                      ?.status || "not_run"
                  }
                />
              </div>
            ))}
          </div>
          {baseline && rerun && (
            <details className="original-comparison"><summary>Inspect individual captures</summary>
            <div className="compare-evidence">
              {[baseline, rerun].map((r, i) => {
                const cr =
                  r.criteria.find((c) => c.criteriaId === criterionId) ||
                  r.criteria.find((c) =>
                    task.failedCriteria.some(
                      (f) => f.criteriaId === c.criteriaId,
                    ),
                  );
                const st = last(cr?.steps.filter((s) => s.screenshotPath));
                return st ? (
                  <EvidenceImage
                    key={r.runId}
                    run={r}
                    step={st}
                    caption={i ? "After change · Same checks" : "Before repair · Original evidence"}
                  />
                ) : (
                  <p key={r.runId}>No screenshot evidence for this criterion</p>
                );
              })}
            </div>
            </details>
          )}
          {rerun && (
            <button
              className="secondary-button full-width"
              onClick={() =>
                void act("open-rerun", async () => {
                  await showRun(rerun.runId);
                  setSheet(null);
                })
              }
            >
              View the complete follow-up run
              <ArrowRight size={17} />
            </button>
          )}
        </Sheet>
      )}
    </div>
  );
}
