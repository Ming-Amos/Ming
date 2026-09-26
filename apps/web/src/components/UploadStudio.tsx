import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowSquareOut, ArrowUp, CheckCircle, CircleNotch, ClockCounterClockwise, Code, Copy, DownloadSimple, FileArrowUp, FileCode, FileText, Fingerprint, Flask, GithubLogo, GitCommit, Info, ListChecks, Play, Plus, ShieldCheck, Stop, Trash, UploadSimple, WarningCircle, X, XCircle } from "@phosphor-icons/react";
import { importProject } from "../upload/importer";
import { inspectGitHubRepository, importGitHubProject, type GitHubInspection } from "../upload/github";
import { createUploadRuntime, makeUploadRepairBrief, validateUploadPlan } from "../upload/runtime";
import type { PageElement, UploadedProject, UploadAction, UploadPlan, UploadProgress, UploadRun, UploadRuntime, UploadStep } from "../upload/types";
import { downloadText } from "../lib/api";
import "./UploadStudio.css";

const actions: Array<{ value: UploadAction; label: string }> = [
  { value: "click", label: "Click" }, { value: "fill", label: "Fill input" }, { value: "select", label: "Select option" },
  { value: "check", label: "Check checkbox" }, { value: "uncheck", label: "Uncheck checkbox" },
  { value: "assertText", label: "Assert text" }, { value: "assertCount", label: "Assert count" },
  { value: "assertValue", label: "Assert value" }, { value: "reload", label: "Reload page" },
];
function newStep(): UploadStep { return { id: crypto.randomUUID(), action: "assertText", selector: "body", value: "", description: "" }; }
function valueLabel(action: UploadAction) { return action === "assertText" ? "Expected text" : action === "assertCount" ? "Expected count" : action === "assertValue" ? "Expected value" : "Value"; }
function usesValue(action: UploadAction) { return ["fill", "select", "assertText", "assertCount", "assertValue"].includes(action); }
function clock(value: string) { return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function size(bytes: number) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function Badge({ status }: { status: string }) {
  const Icon = status === "passed" ? CheckCircle : ["failed", "error"].includes(status) ? XCircle : CircleNotch;
  return <span className={`upload-run-badge ${status}`}><Icon size={14} weight="fill" />{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}
type PlanOrigin = { kind: "manual" | "ai-draft" | "ai-edited"; provider?: string; modelId?: string; generatedAt?: string; projectFingerprint?: string; entry?: string; usage?: { inputTokens: number | null; outputTokens: number | null } };
type PlannerStatus = { configured: boolean; providerLabel: string; modelId: string | null };
type PendingDraft = { steps: UploadStep[]; openQuestions: string[]; context: string; origin: PlanOrigin };
type PlannerFailure = { message: string; code: string; reason?: string; status?: number; usage: { inputTokens: number | null; outputTokens: number | null } };
const plannerFailureCodes = new Set(["PLANNER_PROVIDER_HTTP", "PLANNER_TIMEOUT", "PLANNER_CANCELLED", "PLANNER_INVALID_DRAFT", "PLANNER_INTERNAL", "PLANNER_RESPONSE_READ", "PLANNER_RESPONSE_JSON"]);
const plannerFailureReasons = new Set(["SCHEMA_OBJECT", "SCHEMA_ARRAY", "STEP_COUNT", "QUESTION_COUNT", "STEP_OBJECT", "ACTION", "FIELD_TYPE", "FIELD_LIMIT", "FIELD_REQUIRED", "FIELD_CONTROL", "EXPECTED_TEXT", "EXPECTED_COUNT", "NO_ASSERTION", "SECRET_ECHO", "FINISH_REASON", "CONTENT_TYPE", "JSON_SYNTAX"]);
function draftFailure(value: unknown, status?: number): PlannerFailure {
  const result = value && typeof value === "object" ? value as { error?: unknown; code?: unknown; reason?: unknown; usage?: { inputTokens?: unknown; outputTokens?: unknown } } : {};
  const code = typeof result.code === "string" && plannerFailureCodes.has(result.code) ? result.code : "PLANNER_REQUEST_FAILED";
  const reason = typeof result.reason === "string" && plannerFailureReasons.has(result.reason) ? result.reason : undefined;
  const tokenCount = (tokens: unknown) => typeof tokens === "number" && Number.isFinite(tokens) && tokens >= 0 ? tokens : null;
  const message = reason === "JSON_SYNTAX" ? "Doubao returned a response Ming could not read as a draft."
    : code === "PLANNER_INVALID_DRAFT" ? "Doubao returned a draft Ming could not use."
    : typeof result.error === "string" ? result.error.slice(0, 500) : "The draft could not be generated.";
  return { message, code, reason, status, usage: { inputTokens: tokenCount(result.usage?.inputTokens), outputTokens: tokenCount(result.usage?.outputTokens) } };
}
function validDraftPayload(value: unknown): value is { ok: true; draft: { steps: UploadStep[]; openQuestions: string[] }; modelId: string; usage: { inputTokens: number | null; outputTokens: number | null } } {
  if (!value || typeof value !== "object") return false;
  const result = value as { ok?: unknown; draft?: { steps?: unknown; openQuestions?: unknown }; modelId?: unknown; usage?: { inputTokens?: unknown; outputTokens?: unknown } };
  return result.ok === true && typeof result.modelId === "string" && Array.isArray(result.draft?.steps) && result.draft.steps.length <= 30
    && result.draft.steps.every(step => step && ["id", "action", "selector", "value", "description"].every(key => typeof step[key] === "string") && actions.some(action => action.value === step.action))
    && Array.isArray(result.draft.openQuestions) && result.draft.openQuestions.every(question => typeof question === "string")
    && [result.usage?.inputTokens, result.usage?.outputTokens].every(tokens => tokens === null || (typeof tokens === "number" && Number.isFinite(tokens) && tokens >= 0));
}

export default function UploadStudio() {
  const frame = useRef<HTMLIFrameElement>(null);
  const runtime = useRef<UploadRuntime | null>(null);
  const controller = useRef<AbortController | null>(null);
  const githubController = useRef<AbortController | null>(null);
  const plannerController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const operation = useRef(0);
  const importLock = useRef(false);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const [project, setProject] = useState<UploadedProject | null>(null);
  const [entry, setEntry] = useState("");
  const [requirement, setRequirement] = useState("");
  const [steps, setSteps] = useState<UploadStep[]>(() => [newStep()]);
  const [activeStepId, setActiveStepId] = useState("");
  const [confirmedKey, setConfirmedKey] = useState("");
  const [phase, setPhase] = useState<"idle" | "importing" | "preview" | "running" | "github-inspect" | "github-import" | "planning">("idle");
  const [sourceTab, setSourceTab] = useState<"files" | "github">("files");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [repositoryRef, setRepositoryRef] = useState("");
  const [repositoryFolder, setRepositoryFolder] = useState("");
  const [inspection, setInspection] = useState<GitHubInspection | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState("");
  const [githubProgress, setGithubProgress] = useState<{ completed: number; total: number; path: string } | null>(null);
  const [plannerStatus, setPlannerStatus] = useState<PlannerStatus | null>(null);
  const [plannerStatusReady, setPlannerStatusReady] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [plannerFailure, setPlannerFailure] = useState<PlannerFailure | null>(null);
  const [diagnosticCopy, setDiagnosticCopy] = useState<"" | "copied" | "manual">("");
  const [planOrigin, setPlanOrigin] = useState<PlanOrigin>({ kind: "manual" });
  const [runOrigins, setRunOrigins] = useState<Record<string, PlanOrigin>>({});
  const [previewReady, setPreviewReady] = useState(false);
  const [elements, setElements] = useState<PageElement[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [baseline, setBaseline] = useState<UploadRun | null>(null);
  const [rerun, setRerun] = useState<UploadRun | null>(null);
  const [runs, setRuns] = useState<UploadRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedStepId, setSelectedStepId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [brief, setBrief] = useState("");
  const [capture, setCapture] = useState<{ source: string; title: string } | null>(null);
  const busy = phase !== "idle";
  const running = phase === "running";
  const planning = phase === "planning";
  const planLocked = running || planning;
  const plan: UploadPlan = { requirement, steps };
  const validation = validateUploadPlan(plan);
  const currentKey = JSON.stringify([project?.fingerprint, entry, requirement, steps]);
  const confirmed = confirmedKey === currentKey;
  const draftContext = JSON.stringify([project?.fingerprint, entry, requirement]);
  const draftStale = !!pendingDraft && pendingDraft.context !== draftContext;
  const draftValidation = pendingDraft ? validateUploadPlan({ requirement, steps: pendingDraft.steps }) : [];
  const canApplyDraft = !!pendingDraft && !busy && !draftStale && pendingDraft.openQuestions.length === 0 && draftValidation.length === 0;
  const selectedRun = runs.find(run => run.id === selectedRunId) || null;
  const observedSteps = running ? progress?.steps || [] : selectedRun?.steps || [];
  const selectedStep = observedSteps.find(step => step.id === selectedStepId) || observedSteps.find(step => ["failed", "error"].includes(step.status)) || observedSteps[0];
  const samePlan = !!baseline && !!rerun && baseline.planFingerprint === rerun.planFingerprint;
  const sameEntry = !!baseline && !!rerun && baseline.entry === rerun.entry;
  const sourceChanged = !!baseline && !!rerun && baseline.projectFingerprint !== rerun.projectFingerprint;
  const sameSourceTarget = !!baseline && !!rerun && (baseline.source || rerun.source
    ? !!baseline.source && !!rerun.source && baseline.source.url.toLowerCase().replace(/\/$/, "") === rerun.source.url.toLowerCase().replace(/\/$/, "") && baseline.source.directory === rerun.source.directory
    : true);
  const comparisonPassed = samePlan && sameEntry && sameSourceTarget && rerun?.status === "passed" && sourceChanged;
  const targetStepIndex = Math.max(0, steps.findIndex(step => step.id === activeStepId));
  const latestMatchesPreview = !!project && runs[0]?.projectFingerprint === project.fingerprint && runs[0]?.entry === entry;
  const githubBusy = phase === "github-inspect" || phase === "github-import";
  const selectedCandidate = inspection?.candidates.find(candidate => candidate.directory === selectedDirectory);
  const status = planning ? "Drafting acceptance steps with Doubao. No browser checks are running."
    : phase === "github-inspect" ? "Inspecting the public GitHub repository…"
    : phase === "github-import" ? `Downloading public files${githubProgress ? ` ${githubProgress.completed} / ${githubProgress.total}` : ""}…`
    : phase === "importing" ? "Reading the project in this browser…" : phase === "preview" ? "Opening an isolated preview…"
    : running ? progress?.description || "Starting the approved checks…"
    : !project ? "Upload your app to begin."
    : !previewReady ? "The preview is unavailable. Review the message above."
    : !latestMatchesPreview ? "Preview ready. Define and approve your acceptance checks."
    : runs[0]?.status === "cancelled" ? "Check cancelled. Completed observations are preserved."
    : runs[0]?.status === "error" ? "The check could not finish. Review the error and try again."
    : runs.length ? "Check complete. Select a result to inspect its evidence."
    : "Preview ready. Define and approve your acceptance checks.";

  useEffect(() => {
    mounted.current = true;
    if (frame.current) runtime.current = createUploadRuntime(frame.current);
    return () => { mounted.current = false; ++operation.current; controller.current?.abort(); githubController.current?.abort(); plannerController.current?.abort(); runtime.current?.dispose(); runtime.current = null; };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/upload/planner/status", { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error("Planner status unavailable");
      const result = await response.json();
      if (!mounted.current || abort.signal.aborted) return;
      setPlannerStatus({ configured: result.configured === true, providerLabel: typeof result.providerLabel === "string" ? result.providerLabel : "Doubao", modelId: typeof result.modelId === "string" ? result.modelId : null });
    }).catch(() => { if (mounted.current && !abort.signal.aborted) setPlannerStatus({ configured: false, providerLabel: "Doubao", modelId: null }); })
      .finally(() => { if (mounted.current && !abort.signal.aborted) setPlannerStatusReady(true); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!project || !entry || !runtime.current) return;
    const epoch = ++operation.current;
    setPhase("preview"); setPreviewReady(false); setElements([]); setWarnings(project.warnings); setError("");
    runtime.current.preview(project, entry).then(result => {
      if (!mounted.current || epoch !== operation.current) return;
      setElements(result.elements); setWarnings([...new Set([...project.warnings, ...result.warnings])]); setPreviewReady(true);
    }).catch(cause => {
      if (mounted.current && epoch === operation.current) setError(cause instanceof Error ? cause.message : "The uploaded page could not be previewed.");
    }).finally(() => { if (mounted.current && epoch === operation.current) setPhase("idle"); });
  }, [project, entry]);
  useEffect(() => { if (capture && previewDialog.current && !previewDialog.current.open) previewDialog.current.showModal(); }, [capture]);

  async function openFile(file?: File) {
    if (!file || busy || importLock.current || controller.current) return;
    importLock.current = true; setPhase("importing"); setError(""); setNotice(""); setConfirmedKey("");
    try {
      const imported = await importProject(file);
      if (!mounted.current) return;
      setProject(imported); setEntry(imported.entry); setProgress(null); setBrief("");
      if (baseline) setNotice("Revised files loaded. The original run and acceptance plan remain available. Review this project and confirm the checks again.");
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "The file could not be opened."); }
    finally { importLock.current = false; if (mounted.current) setPhase("idle"); }
  }
  function changeRepository(field: "url" | "ref" | "folder", value: string) {
    if (field === "url") setRepositoryUrl(value);
    else if (field === "ref") setRepositoryRef(value);
    else setRepositoryFolder(value);
    setInspection(null); setSelectedDirectory(""); setGithubProgress(null);
  }
  async function inspectRepository() {
    if (busy || importLock.current || controller.current || !repositoryUrl.trim()) return;
    const abort = new AbortController(); githubController.current = abort; importLock.current = true;
    setPhase("github-inspect"); setError(""); setNotice(""); setInspection(null); setGithubProgress(null);
    try {
      const result = await inspectGitHubRepository({ url: repositoryUrl.trim(), ref: repositoryRef.trim() || undefined, directory: repositoryFolder.trim() || undefined, signal: abort.signal });
      if (!mounted.current || abort.signal.aborted) return;
      setInspection(result);
      const preferred = result.candidates.find(candidate => candidate.directory === result.selectedDirectory && candidate.eligible) || result.candidates.find(candidate => candidate.eligible);
      setSelectedDirectory(preferred?.directory ?? result.selectedDirectory);
    } catch (cause) {
      if (!mounted.current) return;
      if (abort.signal.aborted) setNotice("GitHub inspection cancelled. Your current project and recorded runs are unchanged.");
      else setError(cause instanceof Error ? cause.message : "The public repository could not be inspected.");
    } finally {
      if (githubController.current === abort) githubController.current = null;
      importLock.current = false; if (mounted.current) setPhase("idle");
    }
  }
  async function importRepository() {
    if (busy || importLock.current || controller.current || !inspection || !selectedCandidate?.eligible) return;
    const abort = new AbortController(); githubController.current = abort; importLock.current = true;
    setPhase("github-import"); setError(""); setNotice(""); setGithubProgress({ completed: 0, total: selectedCandidate.fileCount, path: "" });
    try {
      const imported = await importGitHubProject({ inspection, directory: selectedDirectory, signal: abort.signal, onProgress: value => { if (mounted.current && !abort.signal.aborted) setGithubProgress(value); } });
      if (!mounted.current || abort.signal.aborted) return;
      setConfirmedKey(""); setProject(imported); setEntry(imported.entry); setProgress(null); setBrief("");
      setNotice(`Imported ${inspection.owner}/${inspection.repo} at commit ${imported.source.commit.slice(0, 12)}.${baseline ? " Your original baseline and acceptance plan are preserved." : " Review the preview and define the checks you want to run."}`);
    } catch (cause) {
      if (!mounted.current) return;
      if (abort.signal.aborted) setNotice("GitHub import cancelled. Your current project and recorded runs are unchanged.");
      else setError(cause instanceof Error ? cause.message : "The selected public files could not be imported.");
    } finally {
      if (githubController.current === abort) githubController.current = null;
      importLock.current = false; if (mounted.current) setPhase("idle");
    }
  }
  function changeSourceTab(next: "files" | "github") { if (!busy) setSourceTab(next); }
  async function importRequirement(file?: File) {
    if (!file || busy) return;
    if (!/\.(md|txt)$/i.test(file.name)) { setError("Import a Markdown (.md) or plain text (.txt) requirements file."); return; }
    if (file.size > 1024 * 1024) { setError("Keep the requirements file under 1 MB."); return; }
    try { const text = await file.text(); if (mounted.current) { setRequirement(text); markPlanEdited(); setNotice(`Requirements imported from ${file.name}. Review them and define the executable steps below.`); } }
    catch { setError("The requirements file could not be read."); }
  }
  function markPlanEdited() { setPlanOrigin(current => current.kind === "manual" ? current : { ...current, kind: "ai-edited" }); }
  function updateStep(id: string, update: Partial<UploadStep>) { markPlanEdited(); setSteps(current => current.map(step => step.id === id ? { ...step, ...update } : step)); }
  function moveStep(index: number, change: number) { markPlanEdited(); setSteps(current => { const copy = [...current]; [copy[index], copy[index + change]] = [copy[index + change], copy[index]]; return copy; }); }
  async function generateDraft() {
    if (busy || plannerController.current || !project || !previewReady || !plannerStatus?.configured || !requirement.trim()) return;
    if (requirement.length > 8000) { setError("Shorten the requirements to 8,000 characters or fewer before generating a draft."); return; }
    if (!elements.length) { setError("The preview has no inspectable page elements for AI planning. Define the acceptance steps manually."); return; }
    const payload = { confirmedUserAction: true, requirement, projectName: project.name, entry, elements: elements.slice(0, 80).map(element => ({ selector: element.selector.slice(0, 500), tag: element.tag.slice(0, 40), label: element.label.slice(0, 180), type: element.type.slice(0, 40), text: element.text.slice(0, 180) })) };
    let body = JSON.stringify(payload);
    while (new TextEncoder().encode(body).length > 32000 && payload.elements.length) { payload.elements.pop(); body = JSON.stringify(payload); }
    if (new TextEncoder().encode(body).length > 32000 || !payload.elements.length) { setError("The requirements are too large for a planning request. Shorten them and try again."); return; }
    const abort = new AbortController(); plannerController.current = abort;
    setPhase("planning"); setError(""); setNotice(""); setPendingDraft(null); setPlannerFailure(null); setDiagnosticCopy("");
    try {
      const response = await fetch("/api/upload/planner/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: abort.signal });
      const result: unknown = await response.json();
      if (!result || typeof result !== "object") throw new Error("The planner returned an unreadable response. Your current plan is unchanged.");
      if (!response.ok || (result as { ok?: boolean }).ok === false) {
        if (mounted.current && !abort.signal.aborted) setPlannerFailure(draftFailure(result, response.status));
        return;
      }
      if (!validDraftPayload(result)) throw new Error("The planner returned a draft that Ming could not review. Your current plan is unchanged.");
      if (!mounted.current || abort.signal.aborted) return;
      setPendingDraft({ steps: result.draft.steps, openQuestions: result.draft.openQuestions, context: draftContext, origin: { kind: "ai-draft", provider: "Doubao", modelId: result.modelId, generatedAt: new Date().toISOString(), projectFingerprint: project.fingerprint, entry, usage: result.usage } });
      setNotice("Draft ready for review. Your current steps have not changed. Apply or discard the draft before running checks.");
    } catch (cause) {
      if (mounted.current) {
        if (abort.signal.aborted) setNotice("Draft generation cancelled. Your current plan is unchanged. The provider may have already processed the request.");
        else setPlannerFailure(draftFailure({ error: cause instanceof Error ? cause.message : "The draft could not be generated." }));
      }
    } finally { if (plannerController.current === abort) plannerController.current = null; if (mounted.current) setPhase("idle"); }
  }
  function plannerDiagnostic() {
    if (!plannerFailure) return "";
    const { code, reason, status, usage } = plannerFailure;
    return JSON.stringify({ feature: "Ming acceptance planner", code, reason, status, usage }, null, 2);
  }
  async function copyPlannerDiagnostic() {
    try { await navigator.clipboard.writeText(plannerDiagnostic()); setDiagnosticCopy("copied"); }
    catch { setDiagnosticCopy("manual"); }
  }
  function applyDraft() {
    if (!pendingDraft || !canApplyDraft) return;
    setSteps(structuredClone(pendingDraft.steps)); setPlanOrigin(structuredClone(pendingDraft.origin)); setConfirmedKey(""); setPendingDraft(null);
    setNotice("Draft applied. Review the editable steps and confirm the plan before running checks.");
  }
  function chooseElement(element: PageElement) {
    const step = steps[targetStepIndex];
    if (!step || busy) return;
    updateStep(step.id, { selector: element.selector }); setActiveStepId(step.id);
    setNotice(`Added ${element.selector} to step ${targetStepIndex + 1}. Choose its action and expected result.`);
  }
  async function runChecks() {
    if (busy || pendingDraft || controller.current || !runtime.current || !project || !previewReady || !confirmed || validation.length) return;
    const abort = new AbortController(); controller.current = abort;
    const approvedPlan = structuredClone(plan);
    const approvedOrigin = structuredClone(planOrigin);
    setPhase("running"); setError(""); setNotice(""); setBrief(""); setRerun(null); setSelectedStepId("");
    setProgress({ completed: 0, total: approvedPlan.steps.length, description: "Opening a fresh isolated session…", steps: [] });
    try {
      const result = await runtime.current.run({ project, entry, plan: approvedPlan, signal: abort.signal, onProgress: value => { if (mounted.current) setProgress(value); } });
      if (!mounted.current) return;
      setRuns(current => [result, ...current].slice(0, 6)); setSelectedRunId(result.id);
      setRunOrigins(current => ({ ...current, [result.id]: approvedOrigin }));
      if (!baseline && ["passed", "failed"].includes(result.status)) setBaseline(result);
      else if (baseline) setRerun(result);
      setSelectedStepId(result.steps.find(step => ["failed", "error"].includes(step.status))?.id || result.steps[0]?.id || "");
      if (result.status === "error") setError(result.error || "The acceptance check could not finish. Review the recorded error.");
      else if (result.status === "cancelled") setNotice("Check cancelled. Completed observations are preserved; unfinished steps remain unchecked.");
    } catch (cause) { if (mounted.current) setError(abort.signal.aborted ? "Check cancelled. Start again when ready." : cause instanceof Error ? cause.message : "The checks could not run."); }
    finally { if (controller.current === abort) controller.current = null; if (mounted.current) setPhase("idle"); }
  }
  function restoreBaselinePlan() {
    if (!baseline || busy) return;
    setRequirement(baseline.requirement);
    setSteps(baseline.steps.map(({ id, action, selector, value, description }) => ({ id, action, selector, value, description })));
    setPlanOrigin(runOrigins[baseline.id] || { kind: "manual" });
    setConfirmedKey(""); setNotice("The original acceptance plan is restored. Confirm it for the current project before rerunning.");
  }
  async function copyRepair() {
    if (!selectedRun) return;
    const text = makeUploadRepairBrief(selectedRun); setBrief(text);
    try { await navigator.clipboard.writeText(text); setNotice("Repair brief copied. Paste it into your coding AI to work on the source files."); }
    catch { setNotice("Select and copy the repair brief below."); }
  }
  function exportReport() {
    if (!selectedRun) return;
    downloadText(`ming-upload-${selectedRun.id}.json`, JSON.stringify({ format: "ming-upload-v1", currentRun: selectedRun, baseline, rerun, currentPlanOrigin: runOrigins[selectedRun.id] || { kind: "manual" }, baselinePlanOrigin: baseline ? runOrigins[baseline.id] || { kind: "manual" } : null, rerunPlanOrigin: rerun ? runOrigins[rerun.id] || { kind: "manual" } : null, comparison: { samePlan, sameEntry, sameSourceTarget, sourceChanged, revisedSourcePassed: comparisonPassed }, note: "User-approved checks ran in an isolated browser preview. Draft generation, if used, is recorded in the plan origin. Captures are DOM renders. Revised source is supplied by the user through local files or a pinned public GitHub commit; this page does not generate or apply an AI fix." }, null, 2));
  }

  return <div className="upload-shell" data-testid="upload-studio" data-project-fingerprint={project?.fingerprint || ""} data-preview-ready={String(previewReady)} data-phase={phase} data-github-commit={project?.source?.commit || ""}>
    <header className="upload-topbar"><a className="upload-brand" href="#">Ming<span>Every done comes with proof.</span></a><nav aria-label="Upload studio navigation"><a href="#trial"><Flask size={16} />Try a sample</a><a href="#studio"><ClockCounterClockwise size={16} />Evidence Studio</a><a href="#">Cover</a></nav></header>
    <main>
      <section className="upload-hero"><div><span className="upload-kicker">YOUR PROJECT. YOUR STANDARD.</span><h1>Bring your app.<br /><em>Check its promises.</em></h1><p>Open your HTML, static ZIP, or public GitHub project. Define what should happen, run real checks, and send the failure evidence to your coding AI.</p></div><div className="upload-privacy"><ShieldCheck size={26} weight="duotone" /><strong>Checks run in your browser.</strong><p>Local files stay here. GitHub imports download public files directly to this browser. No GitHub token or model key is needed.</p></div></section>
      <div className="upload-scope"><Info size={17} /><span><strong>For browser-ready apps:</strong> HTML, a static ZIP, or a built static folder in a public GitHub repository. Up to 10 MB and 100 files. Importing a repository does not install packages or run a backend; the isolated app preview cannot make network requests.</span></div>
      {(error || notice) && <div className={`upload-message ${error ? "upload-message-error" : ""}`} role={error ? "alert" : "status"}><Info size={18} /><span>{error || notice}</span><button aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}><X size={17} /></button></div>}
      <div className="upload-layout">
        <section className="upload-editor"><div className="upload-section-title"><span>01</span>DEFINE THE PROMISE<ListChecks size={17} /></div>
          <section className="upload-card upload-source-card">
            <div className="upload-card-heading"><h2>Your project</h2><span>CHOOSE A SOURCE</span></div>
            <div className="upload-source-tabs" role="tablist" aria-label="Project source">
              {([{ value: "files", label: "Local files", icon: FileArrowUp }, { value: "github", label: "GitHub", icon: GithubLogo }] as const).map(({ value, label, icon: Icon }) => <button key={value} id={`upload-source-${value}`} role="tab" aria-selected={sourceTab === value} aria-controls="upload-source-panel" tabIndex={sourceTab === value ? 0 : -1} disabled={busy} onClick={() => changeSourceTab(value)} onKeyDown={event => {
                if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "files" : event.key === "End" ? "github" : sourceTab === "files" ? "github" : "files"; changeSourceTab(next); document.getElementById(`upload-source-${next}`)?.focus(); }
              }}><Icon size={16} />{label}</button>)}
            </div>
            <div id="upload-source-panel" role="tabpanel" aria-labelledby={`upload-source-${sourceTab}`}>
              {sourceTab === "files" ? !project ? <label className={`upload-dropzone ${dragging ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void openFile(event.dataTransfer.files[0]); }}><FileArrowUp size={34} weight="light" /><span><strong>Drop your project here</strong><small>Choose an HTML file or a ZIP of a built static app.<br />Files are read locally; nothing is uploaded to a server.</small></span><input type="file" className="upload-file-input" aria-label="Upload HTML or ZIP" accept=".html,.htm,.zip" disabled={busy} onChange={event => { void openFile(event.target.files?.[0]); event.target.value = ""; }} /></label> : <div className="upload-project-actions"><label className="upload-revision-label"><UploadSimple size={15} />Upload revised files<input type="file" aria-label="Upload revised HTML or ZIP" className="upload-file-input" accept=".html,.htm,.zip" disabled={busy} onChange={event => { void openFile(event.target.files?.[0]); event.target.value = ""; }} /></label><small>Previous runs are preserved. Your plan stays available for the revision.</small></div> : <div className="upload-github-form">
                <p className="upload-help">Import a public repository at a pinned commit. Choose the built website folder; source code that needs a build step cannot run here.</p>
                <label className="upload-field"><span>Public repository URL</span><input aria-label="Public repository URL" type="url" value={repositoryUrl} disabled={busy} onChange={event => changeRepository("url", event.target.value)} placeholder="https://github.com/owner/repository" autoComplete="off" spellCheck={false} /></label>
                <div className="upload-github-options"><label className="upload-field"><span>Branch, tag, or commit (optional)</span><input aria-label="Branch, tag, or commit (optional)" value={repositoryRef} disabled={busy} onChange={event => changeRepository("ref", event.target.value)} placeholder="Default branch" autoComplete="off" spellCheck={false} /></label><label className="upload-field"><span>Static folder (optional)</span><input aria-label="Static folder (optional)" value={repositoryFolder} disabled={busy} onChange={event => changeRepository("folder", event.target.value)} placeholder="dist, docs, or leave blank" autoComplete="off" spellCheck={false} /></label></div>
                <div className="upload-github-actions"><button className="upload-secondary" disabled={busy || !repositoryUrl.trim()} onClick={() => void inspectRepository()}>{phase === "github-inspect" ? <CircleNotch className="upload-spin" size={16} /> : <GithubLogo size={16} />}Inspect repository</button>{githubBusy && <button className="upload-github-cancel" aria-label="Cancel GitHub import" onClick={() => githubController.current?.abort()}><Stop size={14} />Cancel</button>}</div>
                {githubBusy && <div className="upload-github-progress" role="status" aria-live="polite"><span>{phase === "github-inspect" ? "Reading repository metadata and locating HTML entry pages…" : `Downloading ${githubProgress?.completed || 0} of ${githubProgress?.total || 0} public files`}</span>{phase === "github-import" && <><progress value={githubProgress?.completed || 0} max={githubProgress?.total || 1} aria-label="GitHub import progress" /><small>{githubProgress?.path || "Preparing the selected folder…"}</small></>}</div>}
                {inspection && <div className="upload-github-inspection" data-testid="github-inspection"><div><strong>{inspection.owner}/{inspection.repo}</strong><a href={inspection.url} target="_blank" rel="noreferrer">View repository<ArrowSquareOut size={12} /></a></div><p><GitCommit size={14} />Pinned commit <code title={inspection.commit}>{inspection.commit.slice(0, 12)}</code><span>{inspection.ref}</span></p><label className="upload-field"><span>Static folder to import</span><select aria-label="Static folder to import" value={selectedDirectory} disabled={busy} onChange={event => setSelectedDirectory(event.target.value)}>{inspection.candidates.map(candidate => <option key={candidate.directory} value={candidate.directory} disabled={!candidate.eligible}>{candidate.directory || "Repository root"} · {candidate.fileCount} files{candidate.eligible ? ` · ${size(candidate.totalBytes)}` : ` · ${candidate.reason || "Unavailable"}`}</option>)}</select></label>{selectedCandidate && <p className="upload-github-entry-note">Entry pages: {selectedCandidate.entries.join(", ") || "No supported HTML entry page"}</p>}{inspection.warnings.length > 0 && <div className="upload-github-warnings">{inspection.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}<button className="upload-primary" disabled={busy || !selectedCandidate?.eligible} onClick={() => void importRepository()}>{phase === "github-import" ? <CircleNotch className="upload-spin" size={16} /> : <DownloadSimple size={16} />}Import selected folder</button><small>The files are fetched from this exact commit. The repository is not modified.</small></div>}
              </div>}
            </div>
            {project && <div className="upload-loaded-source"><div className="upload-project-meta"><FileCode size={25} /><div><strong>{project.name}</strong><small>{project.files.length} files · {size(project.totalBytes)} · Source {project.fingerprint.slice(0, 10)}</small></div><span>{project.source ? "GITHUB" : "LOCAL"}</span></div>{project.source && <div className="upload-github-provenance"><a href={project.source.url} target="_blank" rel="noreferrer"><GithubLogo size={14} />{project.source.url.replace("https://github.com/", "")}<ArrowSquareOut size={12} /></a><p><GitCommit size={14} />Commit <code title={project.source.commit}>{project.source.commit.slice(0, 12)}</code></p><p>Folder: {project.source.directory || "Repository root"} · Ref: {project.source.ref}</p></div>}<label className="upload-field"><span>Entry HTML</span><select aria-label="Entry HTML" value={entry} disabled={busy} onChange={event => { setEntry(event.target.value); setConfirmedKey(""); }}>{project.entries.map(path => <option key={path} value={path}>{path}</option>)}</select></label></div>}
          </section>

          <section className="upload-card"><div className="upload-requirement-actions"><h2>What should work?</h2><label className="upload-requirement-file"><FileText size={14} />Import .md / .txt<input type="file" aria-label="Import requirements file" accept=".md,.txt" disabled={busy} onChange={event => { void importRequirement(event.target.files?.[0]); event.target.value = ""; }} /></label></div><label className="upload-field"><span>Requirements</span><textarea aria-label="Requirements" className="upload-requirement-text" rows={5} value={requirement} disabled={planLocked} onChange={event => { setRequirement(event.target.value); markPlanEdited(); }} placeholder="Describe the feature and the boundaries it must satisfy. What should happen after each action? What must never happen?" /></label><p className="upload-help">This text is the source of truth. It is included with the results and repair brief.</p></section>

          <section className="upload-card upload-planner-card"><div className="upload-card-heading"><h2>Draft the checks with AI</h2><span className={plannerStatus?.configured ? "upload-planner-ready" : ""}>{!plannerStatusReady ? "Checking availability…" : plannerStatus?.configured ? "DOUBAO READY" : "MANUAL PLAN AVAILABLE"}</span></div><p className="upload-help">Requesting a draft sends your requirements, project name, entry path, and page element labels to Doubao. It uses the configured provider account and may incur charges. Nothing is generated automatically.</p><div className="upload-planner-actions"><button className="upload-secondary" disabled={busy || !plannerStatus?.configured || !project || !previewReady || !requirement.trim() || requirement.length > 8000} onClick={() => void generateDraft()}>{planning ? <CircleNotch className="upload-spin" size={16} /> : <ListChecks size={16} />}Generate draft with Doubao</button>{planning && <button className="upload-github-cancel" aria-label="Cancel draft generation" onClick={() => plannerController.current?.abort()}><Stop size={14} />Cancel</button>}</div>{plannerStatusReady && !plannerStatus?.configured && <p className="upload-planner-note">AI planning is not connected for this session. You can write and run a manual plan below.</p>}{plannerStatus?.configured && (!project || !previewReady || !requirement.trim()) && <p className="upload-planner-note">Load a project and describe its requirements to request a draft.</p>}{requirement.length > 8000 && <p className="upload-planner-note">Use 8,000 characters or fewer for AI draft generation. Manual plans remain available.</p>}{planning && <p className="upload-planner-note" role="status">Doubao is drafting steps for your review. Your current plan is unchanged.</p>}
            {plannerFailure && <section className="upload-planner-failure" data-testid="planner-failure" role="alert">
              <div className="upload-planner-failure-title"><WarningCircle size={17} /><h3>The draft could not be prepared</h3></div>
              <p>{plannerFailure.message}</p><p>Your project, requirements, and existing steps are unchanged. You can continue with a manual plan or choose Generate draft again. Nothing is retried automatically.</p>
              <p className="upload-planner-usage">Provider-reported usage: <strong>{plannerFailure.usage.inputTokens ?? "Unknown"} input / {plannerFailure.usage.outputTokens ?? "Unknown"} output tokens</strong></p>
              <details><summary>Technical details</summary><dl><div><dt>Code</dt><dd>{plannerFailure.code}</dd></div>{plannerFailure.reason && <div><dt>Reason</dt><dd>{plannerFailure.reason}</dd></div>}{plannerFailure.status && <div><dt>HTTP status</dt><dd>{plannerFailure.status}</dd></div>}</dl><p>Diagnostic details contain no API key, project files, or requirements.</p></details>
              <div className="upload-planner-diagnostic-actions"><button className="upload-secondary" onClick={() => void copyPlannerDiagnostic()}><Copy size={14} />Copy diagnostic</button><span role="status">{diagnosticCopy === "copied" ? "Diagnostic copied." : diagnosticCopy === "manual" ? "Select and copy the diagnostic below." : ""}</span></div>
              {diagnosticCopy === "manual" && <textarea className="upload-planner-diagnostic-text" aria-label="Planner diagnostic" readOnly value={plannerDiagnostic()} onFocus={event => event.currentTarget.select()} />}
            </section>}
            {pendingDraft && <section className="upload-ai-draft" data-testid="ai-plan-draft" aria-label="AI draft review"><div><h3>Review the proposed steps</h3><span>{pendingDraft.steps.length} steps</span></div><p>Applying this draft replaces the current steps. It does not start a check; you must review and confirm the plan.</p>{draftStale && <div className="upload-draft-warning" role="status"><WarningCircle size={15} /><span>The project, entry page, or requirements changed. Generate a new draft or discard this one.</span></div>}{pendingDraft.openQuestions.length > 0 && <div className="upload-draft-questions"><strong>Resolve these questions before applying</strong><ul aria-label="Unresolved questions">{pendingDraft.openQuestions.map((question, index) => <li key={index}>{question}</li>)}</ul><p>Update the requirements and generate a new draft. These questions are not treated as answered automatically.</p></div>}{draftValidation.length > 0 && <div className="upload-draft-warning" role="status"><WarningCircle size={15} /><span>{draftValidation.join(" ")}</span></div>}<ol className="upload-draft-steps">{pendingDraft.steps.map((step, index) => <li key={`${step.id}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.description || actions.find(action => action.value === step.action)?.label}</strong><code>{actions.find(action => action.value === step.action)?.label}{step.selector ? ` · ${step.selector}` : ""}{usesValue(step.action) ? ` · ${JSON.stringify(step.value)}` : ""}</code></div></li>)}</ol><div className="upload-draft-actions"><button className="upload-primary" disabled={!canApplyDraft} onClick={applyDraft}>Apply draft to plan</button><button className="upload-secondary" disabled={busy} onClick={() => { setPendingDraft(null); setNotice("Draft discarded. Your current steps are unchanged."); }}>Discard draft</button></div><small>{pendingDraft.origin.modelId} · {pendingDraft.origin.usage?.inputTokens ?? "Unknown"} input / {pendingDraft.origin.usage?.outputTokens ?? "Unknown"} output tokens</small></section>}
          </section>

          <section className="upload-card"><div className="upload-card-heading"><h2>Executable acceptance plan</h2><span>{steps.length} / 30 steps</span></div><div className="upload-plan-note"><strong>{planOrigin.kind === "manual" ? "You define the checks." : planOrigin.kind === "ai-draft" ? "AI-drafted steps · Human review required." : "AI draft · Manually edited."}</strong> {planOrigin.kind === "manual" ? "Write actions and assertions below, or request a draft from Doubao above. The active plan is manual until you apply a draft." : `Drafted with ${planOrigin.provider || "Doubao"}${planOrigin.modelId ? ` (${planOrigin.modelId})` : ""}. Inspect every action and assertion before approving this plan.`}</div>
            {steps.map((step, index) => <div className="upload-step" data-testid="upload-step" key={step.id} onFocus={() => setActiveStepId(step.id)}><div className="upload-step-top"><span className="upload-step-number">{String(index + 1).padStart(2, "0")}</span><span className="upload-step-label">{step.action.startsWith("assert") ? "ACCEPTANCE ASSERTION" : "BROWSER ACTION"}</span><div className="upload-step-tools"><button aria-label="Move step up" title="Move step up" disabled={planLocked || index === 0} onClick={() => moveStep(index, -1)}><ArrowUp size={14} /></button><button aria-label="Move step down" title="Move step down" disabled={planLocked || index === steps.length - 1} onClick={() => moveStep(index, 1)}><ArrowDown size={14} /></button><button aria-label="Remove step" title="Remove step" disabled={planLocked || steps.length <= 1} onClick={() => { markPlanEdited(); setSteps(current => current.filter(item => item.id !== step.id)); }}><Trash size={14} /></button></div></div><div className="upload-step-fields"><label className="upload-field"><span>Action</span><select aria-label="Action" disabled={planLocked} value={step.action} onChange={event => updateStep(step.id, { action: event.target.value as UploadAction })}>{actions.map(action => <option value={action.value} key={action.value}>{action.label}</option>)}</select></label>{step.action !== "reload" && <label className="upload-field"><span>CSS selector</span><input aria-label="CSS selector" list="upload-selectors" disabled={planLocked} value={step.selector} onChange={event => updateStep(step.id, { selector: event.target.value })} placeholder="#submit-button" /></label>}{usesValue(step.action) && <label className="upload-field upload-value-field"><span>{valueLabel(step.action)}</span><input aria-label={valueLabel(step.action)} disabled={planLocked} value={step.value} onChange={event => updateStep(step.id, { value: event.target.value })} placeholder={step.action === "assertCount" ? "0" : step.action === "assertText" ? "Text that should be visible" : "Value for this step"} /></label>}</div><label className="upload-field upload-step-description"><input aria-label="Step description" disabled={planLocked} value={step.description} onChange={event => updateStep(step.id, { description: event.target.value })} placeholder="Describe why this step matters (optional)" /></label></div>)}
            <datalist id="upload-selectors">{elements.map((element, index) => <option key={`${element.selector}-${index}`} value={element.selector}>{element.label || element.text || element.tag}</option>)}</datalist>
            <button className="upload-add-step" disabled={planLocked || steps.length >= 30} onClick={() => { const step = newStep(); markPlanEdited(); setSteps(current => [...current, step]); setActiveStepId(step.id); }}><Plus size={16} />Add step</button>
            <div className="upload-approve">{validation.length > 0 && <div className="upload-invalid"><WarningCircle size={15} /><span>{validation[0]}</span></div>}<label className="upload-confirm"><input type="checkbox" checked={confirmed} disabled={busy || !!pendingDraft || !project || !previewReady || validation.length > 0} onChange={event => setConfirmedKey(event.target.checked ? currentKey : "")} /><span>I reviewed these requirements and steps for this project.</span></label><button className="upload-primary upload-run-button" disabled={busy || !!pendingDraft || !confirmed || !previewReady || !project || validation.length > 0} onClick={() => void runChecks()}>{running ? <CircleNotch className="upload-spin" size={17} /> : <Play size={16} weight="fill" />}{running ? "Running acceptance checks…" : "Run acceptance checks"}</button><p className="upload-help">Changing the file, entry page, requirements, or steps requires a new confirmation.</p></div>
          </section>
        </section>

        <section className="upload-preview-column"><div className="upload-section-title"><span>02</span>YOUR APP, UNDER INSPECTION<ShieldCheck size={17} /></div><div className="upload-browser"><div className="upload-browser-top"><span>{project ? `${project.name} / ${entry}` : "Your project preview"}</span><span>ISOLATED · LOCAL</span></div><div className="upload-iframe-wrap"><iframe ref={frame} className="upload-iframe" src="about:blank" title="Uploaded project preview" sandbox="allow-scripts allow-forms" tabIndex={running ? -1 : 0} />{!project && <div className="upload-preview-empty"><FileCode size={42} weight="light" /><h2>Your app belongs here.</h2><p>Upload your own browser-ready project. Ming will inspect that app against the standards you approve.</p></div>}{busy && <div className="upload-preview-lock" aria-hidden="true" />}</div><div className="upload-browser-bottom" role="status" aria-live="polite">{busy ? <CircleNotch className="upload-spin" size={16} /> : <ShieldCheck size={16} />}<span>{status}</span>{running && <button aria-label="Cancel checks" onClick={() => controller.current?.abort()}><Stop size={13} weight="fill" />Cancel</button>}</div>{running && <progress value={progress?.completed || 0} max={progress?.total || steps.length} aria-label="Acceptance check progress" />}</div><p className="upload-help">This preview cannot contact external services or access this page’s storage. Local storage inside the app is simulated for the current isolated session.</p>
          {warnings.length > 0 && <div className="upload-preview-warnings" role="status">{warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
          {project && <details className="upload-inventory"><summary><Code size={16} />Page elements<span>{elements.length} found</span></summary><div className="upload-inventory-list"><p className="upload-help">From the initial preview. Choose an element to use its selector in step {targetStepIndex + 1}.</p>{elements.length ? elements.map((element, index) => <button className="upload-element" aria-label={`Use selector ${element.selector}`} disabled={busy} key={`${element.selector}-${index}`} onClick={() => chooseElement(element)}><span>{element.tag}</span><span><code>{element.selector}</code><small>{element.label || element.text || element.type || "Page element"}</small></span><Plus size={14} /></button>) : <p className="upload-help">No selectable elements are available yet. You can type selectors in the plan.</p>}</div></details>}
          {baseline && <section className="upload-card" style={{ marginTop: 18 }}><span className="upload-kicker">PRESERVED BASELINE</span><h2 style={{ margin: "10px 0" }}>Keep the standard. Check the revision.</h2><p className="upload-help">Run {baseline.id.slice(0, 10)} is preserved. Upload revised files, confirm the same plan, then run again to compare the actual results.</p><button className="upload-secondary" disabled={busy} onClick={restoreBaselinePlan} style={{ marginTop: 14, width: "100%" }}><ClockCounterClockwise size={15} />Restore original plan</button></section>}
        </section>
      </div>

      {(selectedRun || running) && <section className="upload-evidence" aria-label="Acceptance evidence"><div className="upload-evidence-heading"><div><span className="upload-kicker">03 / THE OBSERVED RESULT</span><h2>{running ? "Checking the promise…" : selectedRun?.status === "passed" ? "The approved checks passed." : selectedRun?.status === "failed" ? "The evidence found a gap." : "Every completed step is preserved."}</h2><p>{running ? `${progress?.completed || 0} of ${progress?.total || steps.length} steps completed` : `${selectedRun?.projectName} · ${clock(selectedRun!.startedAt)} · Run ${selectedRun?.id.slice(0, 12)}`}</p></div>{selectedRun && !running && <div className="upload-evidence-actions"><Badge status={selectedRun.status} /><button className="upload-secondary" onClick={() => void copyRepair()}><Copy size={15} />Copy repair brief</button><button className="upload-secondary" onClick={exportReport}><DownloadSimple size={15} />Export evidence report</button></div>}</div>
        <div className="upload-results-grid"><div className="upload-results-list">{observedSteps.map((step, index) => <button className={`upload-result ${selectedStep?.id === step.id ? "selected" : ""}`} key={step.id} onClick={() => setSelectedStepId(step.id)}><span>{String(index + 1).padStart(2, "0")}</span><span><strong>{step.description || actions.find(action => action.value === step.action)?.label}</strong><code>{step.action === "reload" ? "Reload the current page" : step.selector}</code></span><Badge status={step.status} /></button>)}{!observedSteps.length && <p className="upload-help" style={{ padding: 18 }}>Completed actions will appear here as the checks run.</p>}</div><div>{selectedStep && <><section className={`upload-observation ${selectedStep.status}`}><div><h3>{selectedStep.description || actions.find(action => action.value === selectedStep.action)?.label}</h3><Badge status={selectedStep.status} /></div><span>EXPECTED</span><p>{selectedStep.expected || "Complete the approved browser action."}</p><span>OBSERVED</span><p>{selectedStep.observed || "This step has not been checked."}</p></section>{selectedStep.captureError && <div className="upload-message upload-message-warning" role="status"><WarningCircle size={17} /><span>DOM snapshot unavailable: {selectedStep.captureError}. The observed check result is preserved.</span></div>}{selectedStep.capture ? <figure className="upload-dom-capture"><div><span>DOM SNAPSHOT / THIS RUN</span><button onClick={() => setCapture({ source: selectedStep.capture!, title: selectedStep.description || selectedStep.action })}>Expand<ArrowSquareOut size={14} /></button></div><button aria-label="Expand DOM snapshot" onClick={() => setCapture({ source: selectedStep.capture!, title: selectedStep.description || selectedStep.action })}><img src={selectedStep.capture} alt={`DOM snapshot of ${selectedStep.description || selectedStep.action}`} /></button><figcaption>Rendered from the uploaded app’s observed DOM. This is not a native browser screenshot.</figcaption></figure> : <p className="upload-help">No DOM snapshot was captured for this step.</p>}</>}</div></div>
        {selectedRun && !running && <><div className="upload-fingerprint"><Fingerprint size={14} /><span>Source {selectedRun.projectFingerprint.slice(0, 16)} · Plan {selectedRun.planFingerprint.slice(0, 16)} · {selectedRun.steps.filter(step => step.status === "passed").length} passed / {selectedRun.steps.filter(step => step.status === "failed").length} failed / {selectedRun.steps.filter(step => step.status === "unchecked").length} unchecked</span></div>{selectedRun.diagnostics.length > 0 && <details className="upload-inventory"><summary><Info size={15} />Execution notes<span>{selectedRun.diagnostics.length}</span></summary><div className="upload-inventory-list">{selectedRun.diagnostics.map((diagnostic, index) => <p className="upload-help" key={index}>{diagnostic}</p>)}</div></details>}</>}
      </section>}

      {baseline && rerun && !running && <section className={`upload-comparison ${comparisonPassed ? "passed" : ""}`}><h2>{comparisonPassed ? "The revised source passed the same plan." : !sameSourceTarget ? "A different source target needs a new review." : !samePlan ? "The plan changed. Review this as a new check." : !sourceChanged ? "A fresh check of the same source." : "The revision still needs review."}</h2><p>{comparisonPassed ? "The project bytes changed and all approved checks passed for the same source target and entry page. The original baseline remains unchanged. This comparison does not prove who made the repair or that every feature is correct." : !sameSourceTarget ? "The repository, imported folder, or source type differs from the baseline. These runs are preserved, but they do not verify a repair of the same project." : "The original run is preserved. Compare the source, plan, and results before deciding whether the intended issue is resolved."}</p><div className="upload-comparison-facts"><span><Fingerprint size={14} />{samePlan ? "Same plan" : "Different plan"}</span><span><FileCode size={14} />{sourceChanged ? "Source changed" : "Source unchanged"}</span><span><GithubLogo size={14} />{sameSourceTarget ? "Same source target" : "Different source target"}</span><span><FileText size={14} />{sameEntry ? "Same entry page" : "Different entry page"}</span><span>Before <Badge status={baseline.status} /></span><span>After <Badge status={rerun.status} /></span>{baseline.source && <span><GitCommit size={14} />Before commit <code title={baseline.source.commit}>{baseline.source.commit.slice(0, 12)}</code></span>}{rerun.source && <span><GitCommit size={14} />After commit <code title={rerun.source.commit}>{rerun.source.commit.slice(0, 12)}</code></span>}</div></section>}
      {brief && <section className="upload-brief"><div><h2>Send the evidence to your coding AI.</h2><button aria-label="Close repair brief" onClick={() => setBrief("")}><X size={18} /></button></div><p>This brief describes the recorded checks. Copy it into your coding assistant, repair your source files, then upload the revision here.</p><textarea aria-label="Repair brief" readOnly value={brief} rows={9} onFocus={event => event.target.select()} /></section>}
      {runs.length > 0 && <section className="upload-history"><div><ClockCounterClockwise size={17} /><h2>This visit’s runs</h2><small>Latest 6 · held in this page only</small></div><div>{runs.map(run => <button key={run.id} className={selectedRunId === run.id ? "selected" : ""} disabled={busy} onClick={() => { setSelectedRunId(run.id); setSelectedStepId(""); setBrief(""); }}><span>{run.id === baseline?.id ? "Original baseline" : run.projectName}</span><span>{clock(run.startedAt)}</span><Badge status={run.status} /></button>)}</div></section>}
      <footer className="upload-footer"><p>These checks cover the steps you approve. Complex full-stack applications and native browser screenshots need the local Ming runner. This page does not automatically send work to a coding AI.</p><a href="#trial">Explore a guided sample<ArrowRight size={16} /></a></footer>
    </main>
    <dialog ref={previewDialog} className="upload-preview-dialog" onClose={() => setCapture(null)} onClick={event => { if (event.target === previewDialog.current) previewDialog.current.close(); }}><div><strong>{capture?.title}</strong><button aria-label="Close DOM snapshot" onClick={() => previewDialog.current?.close()}><X size={20} /></button></div>{capture && <img src={capture.source} alt={capture.title} />}<p>DOM snapshot rendered from the observed uploaded page, not a native browser screenshot.</p></dialog>
  </div>;
}
