import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowSquareOut, ArrowUp, CheckCircle, CircleNotch, ClockCounterClockwise, Code, Copy, DownloadSimple, FileArrowUp, FileCode, FileText, Fingerprint, Flask, Info, ListChecks, Play, Plus, ShieldCheck, Stop, Trash, UploadSimple, WarningCircle, X, XCircle } from "@phosphor-icons/react";
import { importProject } from "../upload/importer";
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

export default function UploadStudio() {
  const frame = useRef<HTMLIFrameElement>(null);
  const runtime = useRef<UploadRuntime | null>(null);
  const controller = useRef<AbortController | null>(null);
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
  const [phase, setPhase] = useState<"idle" | "importing" | "preview" | "running">("idle");
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
  const plan: UploadPlan = { requirement, steps };
  const validation = validateUploadPlan(plan);
  const currentKey = JSON.stringify([project?.fingerprint, entry, requirement, steps]);
  const confirmed = confirmedKey === currentKey;
  const selectedRun = runs.find(run => run.id === selectedRunId) || null;
  const observedSteps = running ? progress?.steps || [] : selectedRun?.steps || [];
  const selectedStep = observedSteps.find(step => step.id === selectedStepId) || observedSteps.find(step => ["failed", "error"].includes(step.status)) || observedSteps[0];
  const samePlan = !!baseline && !!rerun && baseline.planFingerprint === rerun.planFingerprint;
  const sameEntry = !!baseline && !!rerun && baseline.entry === rerun.entry;
  const sourceChanged = !!baseline && !!rerun && baseline.projectFingerprint !== rerun.projectFingerprint;
  const comparisonPassed = samePlan && sameEntry && rerun?.status === "passed" && sourceChanged;
  const targetStepIndex = Math.max(0, steps.findIndex(step => step.id === activeStepId));
  const latestMatchesPreview = !!project && runs[0]?.projectFingerprint === project.fingerprint && runs[0]?.entry === entry;
  const status = phase === "importing" ? "Reading the project in this browser…" : phase === "preview" ? "Opening an isolated preview…"
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
    return () => { mounted.current = false; ++operation.current; controller.current?.abort(); runtime.current?.dispose(); runtime.current = null; };
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
  async function importRequirement(file?: File) {
    if (!file || busy) return;
    if (!/\.(md|txt)$/i.test(file.name)) { setError("Import a Markdown (.md) or plain text (.txt) requirements file."); return; }
    if (file.size > 1024 * 1024) { setError("Keep the requirements file under 1 MB."); return; }
    try { const text = await file.text(); if (mounted.current) { setRequirement(text); setNotice(`Requirements imported from ${file.name}. Review them and define the executable steps below.`); } }
    catch { setError("The requirements file could not be read."); }
  }
  function updateStep(id: string, update: Partial<UploadStep>) { setSteps(current => current.map(step => step.id === id ? { ...step, ...update } : step)); }
  function moveStep(index: number, change: number) { setSteps(current => { const copy = [...current]; [copy[index], copy[index + change]] = [copy[index + change], copy[index]]; return copy; }); }
  function chooseElement(element: PageElement) {
    const step = steps[targetStepIndex];
    if (!step || busy) return;
    updateStep(step.id, { selector: element.selector }); setActiveStepId(step.id);
    setNotice(`Added ${element.selector} to step ${targetStepIndex + 1}. Choose its action and expected result.`);
  }
  async function runChecks() {
    if (busy || controller.current || !runtime.current || !project || !previewReady || !confirmed || validation.length) return;
    const abort = new AbortController(); controller.current = abort;
    const approvedPlan = structuredClone(plan);
    setPhase("running"); setError(""); setNotice(""); setBrief(""); setRerun(null); setSelectedStepId("");
    setProgress({ completed: 0, total: approvedPlan.steps.length, description: "Opening a fresh isolated session…", steps: [] });
    try {
      const result = await runtime.current.run({ project, entry, plan: approvedPlan, signal: abort.signal, onProgress: value => { if (mounted.current) setProgress(value); } });
      if (!mounted.current) return;
      setRuns(current => [result, ...current].slice(0, 6)); setSelectedRunId(result.id);
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
    downloadText(`ming-upload-${selectedRun.id}.json`, JSON.stringify({ format: "ming-upload-v1", currentRun: selectedRun, baseline, rerun, comparison: { samePlan, sameEntry, sourceChanged, revisedSourcePassed: comparisonPassed }, note: "User-approved manual checks ran in an isolated browser preview. Captures are DOM renders. A revised file is supplied by the user; this page does not generate or apply an AI fix." }, null, 2));
  }

  return <div className="upload-shell" data-testid="upload-studio" data-project-fingerprint={project?.fingerprint || ""} data-preview-ready={String(previewReady)} data-phase={phase}>
    <header className="upload-topbar"><a className="upload-brand" href="#">Ming<span>Every done comes with proof.</span></a><nav aria-label="Upload studio navigation"><a href="#trial"><Flask size={16} />Try a sample</a><a href="#studio"><ClockCounterClockwise size={16} />Evidence Studio</a><a href="#">Cover</a></nav></header>
    <main>
      <section className="upload-hero"><div><span className="upload-kicker">YOUR PROJECT. YOUR STANDARD.</span><h1>Bring your app.<br /><em>Check its promises.</em></h1><p>Open your HTML or static website, define what should happen, and run real checks. Hand the failure evidence back to your coding AI.</p></div><div className="upload-privacy"><ShieldCheck size={26} weight="duotone" /><strong>Your files stay in this browser.</strong><p>The app runs in an isolated preview. No model key or server upload is needed. Your checks and results stay only while this page is open.</p></div></section>
      <div className="upload-scope"><Info size={17} /><span><strong>For browser-ready apps:</strong> a single HTML file or a static ZIP with its local assets. Up to 10 MB and 100 files. Backend servers, package installation, and network requests are unavailable in this preview.</span></div>
      {(error || notice) && <div className={`upload-message ${error ? "upload-message-error" : ""}`} role={error ? "alert" : "status"}><Info size={18} /><span>{error || notice}</span><button aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}><X size={17} /></button></div>}
      <div className="upload-layout">
        <section className="upload-editor"><div className="upload-section-title"><span>01</span>DEFINE THE PROMISE<ListChecks size={17} /></div>
          <section className="upload-card"><div className="upload-card-heading"><h2>Your project</h2><span>HTML / STATIC ZIP</span></div>{!project ? <label className={`upload-dropzone ${dragging ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void openFile(event.dataTransfer.files[0]); }}><FileArrowUp size={34} weight="light" /><span><strong>Drop your project here</strong><small>Choose an HTML file or a ZIP of a built static app.<br />Files are read locally; nothing is uploaded to a server.</small></span><input type="file" className="upload-file-input" aria-label="Upload HTML or ZIP" accept=".html,.htm,.zip" disabled={busy} onChange={event => { void openFile(event.target.files?.[0]); event.target.value = ""; }} /></label> : <><div className="upload-project-meta"><FileCode size={25} /><div><strong>{project.name}</strong><small>{project.files.length} files · {size(project.totalBytes)} · Source {project.fingerprint.slice(0, 10)}</small></div><span>LOCAL</span></div><label className="upload-field"><span>Entry HTML</span><select aria-label="Entry HTML" value={entry} disabled={busy} onChange={event => { setEntry(event.target.value); setConfirmedKey(""); }}>{project.entries.map(path => <option key={path} value={path}>{path}</option>)}</select></label><div className="upload-project-actions"><label className="upload-revision-label"><UploadSimple size={15} />Upload revised files<input type="file" aria-label="Upload revised HTML or ZIP" className="upload-file-input" accept=".html,.htm,.zip" disabled={busy} onChange={event => { void openFile(event.target.files?.[0]); event.target.value = ""; }} /></label><small>Previous runs are preserved. Your plan stays available for the revision.</small></div></>}</section>

          <section className="upload-card"><div className="upload-requirement-actions"><h2>What should work?</h2><label className="upload-requirement-file"><FileText size={14} />Import .md / .txt<input type="file" aria-label="Import requirements file" accept=".md,.txt" disabled={busy} onChange={event => { void importRequirement(event.target.files?.[0]); event.target.value = ""; }} /></label></div><label className="upload-field"><span>Requirements</span><textarea aria-label="Requirements" className="upload-requirement-text" rows={5} value={requirement} disabled={running} onChange={event => setRequirement(event.target.value)} placeholder="Describe the feature and the boundaries it must satisfy. What should happen after each action? What must never happen?" /></label><p className="upload-help">This text is the source of truth. It is included with the results and repair brief.</p></section>

          <section className="upload-card"><div className="upload-card-heading"><h2>Executable acceptance plan</h2><span>{steps.length} / 30 steps</span></div><div className="upload-plan-note"><strong>You define the checks.</strong> Turn each requirement into actions and assertions below. This is a manual plan; no AI invents or interprets the acceptance criteria.</div>
            {steps.map((step, index) => <div className="upload-step" data-testid="upload-step" key={step.id} onFocus={() => setActiveStepId(step.id)}><div className="upload-step-top"><span className="upload-step-number">{String(index + 1).padStart(2, "0")}</span><span className="upload-step-label">{step.action.startsWith("assert") ? "ACCEPTANCE ASSERTION" : "BROWSER ACTION"}</span><div className="upload-step-tools"><button aria-label="Move step up" title="Move step up" disabled={running || index === 0} onClick={() => moveStep(index, -1)}><ArrowUp size={14} /></button><button aria-label="Move step down" title="Move step down" disabled={running || index === steps.length - 1} onClick={() => moveStep(index, 1)}><ArrowDown size={14} /></button><button aria-label="Remove step" title="Remove step" disabled={running || steps.length <= 1} onClick={() => setSteps(current => current.filter(item => item.id !== step.id))}><Trash size={14} /></button></div></div><div className="upload-step-fields"><label className="upload-field"><span>Action</span><select aria-label="Action" disabled={running} value={step.action} onChange={event => updateStep(step.id, { action: event.target.value as UploadAction })}>{actions.map(action => <option value={action.value} key={action.value}>{action.label}</option>)}</select></label>{step.action !== "reload" && <label className="upload-field"><span>CSS selector</span><input aria-label="CSS selector" list="upload-selectors" disabled={running} value={step.selector} onChange={event => updateStep(step.id, { selector: event.target.value })} placeholder="#submit-button" /></label>}{usesValue(step.action) && <label className="upload-field upload-value-field"><span>{valueLabel(step.action)}</span><input aria-label={valueLabel(step.action)} disabled={running} value={step.value} onChange={event => updateStep(step.id, { value: event.target.value })} placeholder={step.action === "assertCount" ? "0" : step.action === "assertText" ? "Text that should be visible" : "Value for this step"} /></label>}</div><label className="upload-field upload-step-description"><input aria-label="Step description" disabled={running} value={step.description} onChange={event => updateStep(step.id, { description: event.target.value })} placeholder="Describe why this step matters (optional)" /></label></div>)}
            <datalist id="upload-selectors">{elements.map((element, index) => <option key={`${element.selector}-${index}`} value={element.selector}>{element.label || element.text || element.tag}</option>)}</datalist>
            <button className="upload-add-step" disabled={running || steps.length >= 30} onClick={() => { const step = newStep(); setSteps(current => [...current, step]); setActiveStepId(step.id); }}><Plus size={16} />Add step</button>
            <div className="upload-approve">{validation.length > 0 && <div className="upload-invalid"><WarningCircle size={15} /><span>{validation[0]}</span></div>}<label className="upload-confirm"><input type="checkbox" checked={confirmed} disabled={busy || !project || !previewReady || validation.length > 0} onChange={event => setConfirmedKey(event.target.checked ? currentKey : "")} /><span>I reviewed these requirements and steps for this project.</span></label><button className="upload-primary upload-run-button" disabled={busy || !confirmed || !previewReady || !project || validation.length > 0} onClick={() => void runChecks()}>{running ? <CircleNotch className="upload-spin" size={17} /> : <Play size={16} weight="fill" />}{running ? "Running acceptance checks…" : "Run acceptance checks"}</button><p className="upload-help">Changing the file, entry page, requirements, or steps requires a new confirmation.</p></div>
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

      {baseline && rerun && !running && <section className={`upload-comparison ${comparisonPassed ? "passed" : ""}`}><h2>{comparisonPassed ? "The revised file passed the same plan." : !samePlan ? "The plan changed. Review this as a new check." : !sourceChanged ? "A fresh check of the same source." : "The revision still needs review."}</h2><p>{comparisonPassed ? "The project bytes changed and all approved checks passed for the same entry page. The original baseline remains unchanged. This comparison does not prove who made the repair or that every feature is correct." : "The original run is preserved. Compare the source, plan, and results before deciding whether the intended issue is resolved."}</p><div className="upload-comparison-facts"><span><Fingerprint size={14} />{samePlan ? "Same plan" : "Different plan"}</span><span><FileCode size={14} />{sourceChanged ? "Source changed" : "Source unchanged"}</span><span><FileText size={14} />{sameEntry ? "Same entry page" : "Different entry page"}</span><span>Before <Badge status={baseline.status} /></span><span>After <Badge status={rerun.status} /></span></div></section>}
      {brief && <section className="upload-brief"><div><h2>Send the evidence to your coding AI.</h2><button aria-label="Close repair brief" onClick={() => setBrief("")}><X size={18} /></button></div><p>This brief describes the recorded checks. Copy it into your coding assistant, repair your source files, then upload the revision here.</p><textarea aria-label="Repair brief" readOnly value={brief} rows={9} onFocus={event => event.target.select()} /></section>}
      {runs.length > 0 && <section className="upload-history"><div><ClockCounterClockwise size={17} /><h2>This visit’s runs</h2><small>Latest 6 · held in this page only</small></div><div>{runs.map(run => <button key={run.id} className={selectedRunId === run.id ? "selected" : ""} disabled={busy} onClick={() => { setSelectedRunId(run.id); setSelectedStepId(""); setBrief(""); }}><span>{run.id === baseline?.id ? "Original baseline" : run.projectName}</span><span>{clock(run.startedAt)}</span><Badge status={run.status} /></button>)}</div></section>}
      <footer className="upload-footer"><p>These checks cover the steps you approve. Complex full-stack applications and native browser screenshots need the local Ming runner. This page does not automatically send work to a coding AI.</p><a href="#trial">Explore a guided sample<ArrowRight size={16} /></a></footer>
    </main>
    <dialog ref={previewDialog} className="upload-preview-dialog" onClose={() => setCapture(null)} onClick={event => { if (event.target === previewDialog.current) previewDialog.current.close(); }}><div><strong>{capture?.title}</strong><button aria-label="Close DOM snapshot" onClick={() => previewDialog.current?.close()}><X size={20} /></button></div>{capture && <img src={capture.source} alt={capture.title} />}<p>DOM snapshot rendered from the observed uploaded page, not a native browser screenshot.</p></dialog>
  </div>;
}

