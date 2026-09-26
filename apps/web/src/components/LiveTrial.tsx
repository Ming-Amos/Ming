import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowSquareOut, Check, CheckCircle, CircleNotch, ClockCounterClockwise, Copy, DownloadSimple, Fingerprint, Flask, FileText, Info, ListChecks, Play, ShieldCheck, Stop, WarningCircle, X, XCircle } from "@phosphor-icons/react";
import { runTrial, makeRepairBrief } from "../trial/engine";
import type { TrialRun } from "../trial/types";
import { downloadText } from "../lib/api";
import "./LiveTrial.css";

type Observation = { title: string; expected?: string; observed: string; capture?: string; status: string };
const standards = [
  { id: "SHIP-01", title: "A task appears on the board", body: "Add your task. Its exact name must appear in the list." },
  { id: "SHIP-02", title: "The same task survives a reload", body: "Reload the app. The task must still be there." },
  { id: "SHIP-03", title: "An empty task is rejected", body: "Submit an empty name. No blank task should be created." },
];
function date(value: string) { return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function Badge({ status }: { status: string }) {
  const Icon = status === "passed" ? CheckCircle : status === "failed" || status === "error" ? XCircle : CircleNotch;
  return <span className={`trial-badge trial-${status}`}><Icon size={14} weight="fill" />{status === "unchecked" ? "Unchecked" : status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}
export default function LiveTrial() {
  const iframe = useRef<HTMLIFrameElement>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const [taskName, setTaskName] = useState("Ship a feature with proof");
  const [baselineTaskName, setBaselineTaskName] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeVariant, setActiveVariant] = useState<"buggy" | "fixed">("buggy");
  const [progress, setProgress] = useState({ step: "Ready for your first check", completed: 0, total: 0 });
  const [runs, setRuns] = useState<TrialRun[]>([]);
  const [baseline, setBaseline] = useState<TrialRun | null>(null);
  const [rerun, setRerun] = useState<TrialRun | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [observation, setObservation] = useState<Observation | null>(null);
  const [preview, setPreview] = useState<{ source: string; title: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [brief, setBrief] = useState("");

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => {
    if (preview && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [preview]);
  const selected = runs.find(run => run.id === selectedId) || null;
  const failure = baseline?.criteria.find(criterion => criterion.status === "failed");
  const fixed = rerun?.criteria.find(criterion => criterion.id === failure?.id);
  const samePlan = !!baseline && !!rerun && baseline.planFingerprint === rerun.planFingerprint;
  const verified = samePlan && baseline?.status === "completed" && rerun?.status === "completed" && !!failure && rerun.criteria.every(criterion => criterion.status === "passed");
  const canFix = !!baseline && baseline.status === "completed" && !!failure;
  const passed = selected?.criteria.filter(criterion => criterion.status === "passed").length || 0;
  const failed = selected?.criteria.filter(criterion => criterion.status === "failed").length || 0;
  const captureUnavailable = selected?.steps.some(step => step.observed.includes("DOM render unavailable:"));
  const frameStatus = !hasStarted ? "Ready to open a fresh sample."
    : running ? progress.step
    : runs[0]?.status === "cancelled" ? "Check cancelled. Completed observations are preserved."
    : error || runs[0]?.status === "error" ? "The check could not finish. Review the error and try again."
    : "Check complete. Select a result to inspect its evidence.";

  async function start(variant: "buggy" | "fixed") {
    if (controller.current || !iframe.current || (variant === "fixed" && !canFix)) return;
    const name = variant === "fixed" ? baselineTaskName : taskName.trim();
    if (!name) { setError("Give your task a name before running the check."); return; }
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true); setHasStarted(true); setActiveVariant(variant); setError(""); setNotice(""); setBrief(""); setObservation(null);
    setProgress({ step: "Opening a fresh sample workspace…", completed: 0, total: 0 });
    if (variant === "buggy") { setBaseline(null); setRerun(null); setSelectedId(""); setBaselineTaskName(name); }
    else { setRerun(null); setSelectedId(baseline!.id); }
    try {
      const run = await runTrial({ iframe: iframe.current, variant, taskName: name, signal: abort.signal, onProgress: value => { if (mounted.current) setProgress(value); } });
      if (!mounted.current) return;
      setRuns(old => [run, ...old].slice(0, 6)); setSelectedId(run.id);
      if (variant === "buggy") setBaseline(run); else setRerun(run);
      const result = run.criteria.find(criterion => criterion.status === "failed") || run.criteria[0];
      if (result) setObservation({ title: result.title, expected: result.expected, observed: result.observed, capture: result.capture, status: result.status });
      if (run.status === "error") setError(run.error || "The check could not finish. Try running it again.");
      if (run.status === "cancelled") setNotice("Check cancelled. Completed observations are kept; unfinished checks are not marked as passed.");
    } catch (cause) {
      if (mounted.current) setError(abort.signal.aborted ? "Check cancelled. You can start a fresh check." : cause instanceof Error ? cause.message : "The check could not start. Please try again.");
    } finally {
      if (controller.current === abort) controller.current = null;
      if (mounted.current) setRunning(false);
    }
  }
  function choose(run: TrialRun) {
    setSelectedId(run.id);
    const result = run.criteria.find(criterion => criterion.status === "failed") || run.criteria[0];
    setObservation(result ? { title: result.title, expected: result.expected, observed: result.observed, capture: result.capture, status: result.status } : null);
  }
  async function copyBrief() {
    if (!baseline) return;
    const text = makeRepairBrief(baseline);
    setBrief(text);
    try { await navigator.clipboard.writeText(text); setNotice("Repair brief copied. It includes the requirement and the observations from this run."); }
    catch { setNotice("Select and copy the repair brief below."); }
  }
  function showCapture(source: string, title: string) { setPreview({ source, title }); }

  return <div className="trial-shell" data-testid="live-trial">
    <header className="trial-topbar"><a className="trial-brand" href="#">Ming<span>Every done comes with proof.</span></a><nav aria-label="Trial navigation"><a href="#upload"><FileText size={17} />Check your app</a><a href="#studio"><ClockCounterClockwise size={17} />Evidence Studio</a><a href="#"><ArrowLeft size={16} />Cover</a></nav></header>
    <main>
      <section className="trial-hero">
        <div><div className="trial-eyebrow"><span className="trial-live-dot" />THE LIVE PROOF LAB</div><h1>Don’t take “done”<br />for an <em>answer.</em></h1><p>Give the sample a task. Watch Ming check it.<br />Find the failure, then prove the fix.</p></div>
        <div className="trial-hero-note"><Flask size={27} weight="duotone" /><strong>A small app. A real check.</strong><p>This trial runs in your browser. No sign-up inside Ming, model key, or installation needed.</p><span>CONTROLLED SAMPLE · NO MODEL CALLS</span></div>
      </section>

      <ol className="trial-journey" aria-label="Live trial workflow"><li className={!baseline ? "current" : "complete"}><span>{baseline ? <Check size={16} /> : "01"}</span><div><strong>Check the promise</strong><small>Run on a fresh sample</small></div></li><li className={failure ? "current" : ""}><span>02</span><div><strong>Find the evidence</strong><small>Inspect what failed and why</small></div></li><li className={verified ? "complete" : rerun ? "current" : ""}><span>{verified ? <Check size={16} /> : "03"}</span><div><strong>Verify the fix</strong><small>The same requirement, checked again</small></div></li></ol>

      {(error || notice) && <div className={`trial-message ${error ? "trial-message-error" : ""}`} role={error ? "alert" : "status"}><Info size={19} /><span>{error || notice}</span><button aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}><X size={17} /></button></div>}

      <div className="trial-layout">
        <aside className="trial-standard-column"><div className="trial-section-label"><span>01</span>THE STANDARD<ListChecks size={17} /></div><section className="trial-card trial-input-card"><span className="trial-kicker">SHIPBOARD / TASK BOARD</span><h2>“Saved” should<br />mean saved.</h2><p>A task should appear immediately, survive a reload, and never be empty.</p><label htmlFor="trial-task-name">Make the test yours</label><input id="trial-task-name" value={taskName} onChange={event => setTaskName(event.target.value)} maxLength={80} disabled={running} placeholder="Give your task a name" /><small>Ming adds your task with a unique run ID.</small><button className="trial-primary" disabled={running || !taskName.trim()} onClick={() => void start("buggy")}><Play size={16} weight="fill" />{baseline ? "Run a fresh check" : "Run live checks"}</button><span className="trial-local-note"><ShieldCheck size={14} />Only this sample is tested.</span></section>
          <section className="trial-card trial-standards"><h3>Acceptance criteria <span>03</span></h3>{standards.map((standard, index) => <div key={standard.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{standard.title}</strong><p>{standard.body}</p></div></div>)}<footer><Fingerprint size={15} />The plan stays the same after the fix.</footer></section>
        </aside>

        <section className="trial-browser-column"><div className="trial-section-label"><span>02</span>THE APP, UNDER INSPECTION<span className={`trial-live-tag ${running ? "active" : ""}`}>{running ? "CHECKING NOW" : "LIVE SAMPLE"}</span></div><div className="trial-browser-frame"><div className="trial-browser-toolbar"><span className="trial-window-dots"><i /><i /><i /></span><span>shipboard / {activeVariant === "fixed" ? "prepared fix" : "original sample"}</span><span>IN YOUR BROWSER</span></div><div className="trial-iframe-wrap"><iframe ref={iframe} src="about:blank" title="Live Shipboard sample application" className="trial-iframe" tabIndex={running ? -1 : 0} />{!hasStarted && <div className="trial-browser-placeholder"><Flask size={44} weight="light" /><strong>Your next check starts here.</strong><p>Click “Run live checks” to open a fresh Shipboard sample and watch the inspection.</p></div>}{running && <div className="trial-browser-guard" aria-hidden="true" />}</div><div className="trial-browser-status" role="status" aria-live="polite">{running ? <CircleNotch size={17} className="trial-spin" /> : <CheckCircle size={17} />}<span>{frameStatus}</span>{running && <button aria-label="Cancel checks" onClick={() => controller.current?.abort()}><Stop size={13} weight="fill" />Cancel</button>}</div>{running && <progress className="trial-progress" value={progress.completed} max={progress.total || 1} aria-label="Acceptance check progress" />}</div>
          <p className="trial-browser-footnote">Ming clicks, types, reloads, and reads the sample’s actual page. Results are produced when you run the check.</p>
          {selected && <section className="trial-card trial-trace"><div className="trial-trace-heading"><h3>What actually happened</h3><span>{date(selected.startedAt)} · {selected.steps.length} actions</span></div><div className="trial-trace-steps">{selected.steps.map((step, index) => <button key={`${selected.id}-${step.id}-${index}`} className={`trial-trace-step trial-${step.status}`} title={step.description} onClick={() => setObservation({ title: step.description, observed: step.observed, capture: step.capture, status: step.status })}><span>{String(index + 1).padStart(2, "0")}</span>{step.status === "passed" ? <Check size={15} /> : <X size={15} />}<span>{step.description}</span></button>)}</div><p>Select an action to inspect its observation and available DOM snapshot.</p></section>}
          {observation?.capture && <figure className="trial-capture"><div><span>DOM SNAPSHOT</span><button onClick={() => showCapture(observation.capture!, observation.title)}>Expand<ArrowSquareOut size={14} /></button></div><button className="trial-capture-image" onClick={() => showCapture(observation.capture!, observation.title)} aria-label={`Expand DOM snapshot: ${observation.title}`}><img src={observation.capture} alt={`DOM snapshot: ${observation.title}`} /></button><figcaption>Rendered from the observed page DOM. This is not a browser screenshot.</figcaption></figure>}
        </section>

        <aside className="trial-results-column"><div className="trial-section-label"><span>03</span>THE VERDICT<ShieldCheck size={17} /></div>{selected ? <><section className="trial-card trial-results"><div className="trial-results-heading"><h2>{selected.variant === "fixed" ? "After the prepared fix" : "Your check results"}</h2><span>{selected.status === "completed" ? `${passed} passed · ${failed} failed` : selected.status}</span></div>{selected.criteria.map(criterion => <button key={criterion.id} className="trial-result-row" onClick={() => setObservation({ title: criterion.title, expected: criterion.expected, observed: criterion.observed, capture: criterion.capture, status: criterion.status })}><span>{criterion.title}</span><Badge status={criterion.status} /></button>)}<footer>Run {selected.id.slice(0, 12)} · {date(selected.startedAt)}</footer></section>{observation && <section className={`trial-card trial-observation trial-observation-${observation.status}`}><div><h3>{observation.title}</h3><Badge status={observation.status} /></div>{observation.expected && <><span className="trial-kicker">EXPECTED</span><p>{observation.expected}</p></>}<span className="trial-kicker">OBSERVED</span><p className="trial-observed-value">{observation.observed}</p>{!observation.capture && <small>No DOM snapshot was captured for this action.</small>}</section>}{captureUnavailable && <div className="trial-message trial-message-error" role="status"><WarningCircle size={17} /><span>Some DOM snapshots could not be captured. Check observations remain available; the evidence report records the capture failure.</span></div>}<button className="trial-export" onClick={() => downloadText(`ming-live-${selected.id}.json`, JSON.stringify({ format: "ming-live-trial-v1", currentRun: selected, baseline, rerun, comparison: { samePlan, allRerunCriteriaPassed: verified }, note: "Checks execute in the visitor browser on a controlled sample. Captures are DOM renders. The fix is prepared, not generated by AI." }, null, 2))}><DownloadSimple size={16} />Export evidence report</button></> : <section className="trial-card trial-awaiting"><div><ListChecks size={32} weight="light" /></div><span className="trial-kicker">NO CLAIMS WITHOUT A CHECK</span><h2>The result starts<br />with your click.</h2><p>Run the checks to see which promises hold up, and exactly where one breaks.</p><span><ArrowLeft size={15} />Start with “Run live checks”</span></section>}
          <section className={`trial-card trial-repair ${verified ? "trial-repair-verified" : ""}`}><span className="trial-kicker">CLOSE THE LOOP</span><h2>{verified ? "The fix holds up." : "A failure with a next step."}</h2><p>{verified ? "The prepared fix passed all criteria against the same acceptance plan. Your original failure is still preserved." : "Turn the failure into a repair brief. Then try the prepared persistence fix and check the same promise again."}</p><button className="trial-secondary" disabled={!canFix || running} onClick={() => void copyBrief()}><Copy size={16} />Copy repair brief</button><button className={verified ? "trial-success" : "trial-primary"} disabled={!canFix || running} onClick={() => void start("fixed")}>{running && activeVariant === "fixed" ? <CircleNotch className="trial-spin" size={17} /> : verified ? <CheckCircle size={17} /> : <ArrowRight size={17} />}{running && activeVariant === "fixed" ? "Verifying the fix…" : "Apply prepared fix & rerun"}</button><small>The sample fix is predefined. No AI is generating or applying a new code change in this trial.</small>{baseline && <span className="trial-fix-target">Same requirement, fresh task: “{baselineTaskName}”</span>}</section>
        </aside>
      </div>

      {brief && <section className="trial-card trial-brief"><div><h2>Ready for your coding AI</h2><button aria-label="Close repair brief" onClick={() => setBrief("")}><X size={18} /></button></div><p>This text describes the actual failure. Copy it into your coding assistant; this trial does not send it automatically.</p><textarea aria-label="Repair brief" value={brief} readOnly rows={9} onFocus={event => event.target.select()} /></section>}
      {baseline && rerun && <section className="trial-comparison"><div className="trial-comparison-heading"><div><span className="trial-kicker">ONE STANDARD. TWO REAL RUNS.</span><h2>{verified ? "From broken promise to proof." : "Compare what changed."}</h2></div><span className={`trial-compare-state ${verified ? "verified" : ""}`}>{verified ? <CheckCircle size={18} /> : <WarningCircle size={18} />}{verified ? "All criteria passed after the prepared fix" : !samePlan ? "Plans differ — comparison is not verified" : "Review the results below"}</span></div><div className="trial-comparison-grid">{[{ run: baseline, result: failure, label: "BEFORE / ORIGINAL SAMPLE" }, { run: rerun, result: fixed, label: "AFTER / PREPARED FIX" }].map(({ run, result, label }) => <article key={label}><div><span>{label}</span><Badge status={result?.status || "unchecked"} /></div><p>{result?.observed || "The relevant check did not produce an observation."}</p>{result?.capture && <button onClick={() => showCapture(result.capture!, label)} aria-label={`Expand ${label.toLowerCase()} DOM snapshot`}><img src={result.capture} alt={`${label} DOM snapshot`} /></button>}<footer>{date(run.startedAt)} · Run {run.id.slice(0, 12)}</footer></article>)}</div><p><Fingerprint size={15} />{samePlan ? "Same acceptance plan" : "Different acceptance plans"} · DOM snapshots from these runs · Original baseline preserved</p></section>}
      {runs.length > 0 && <section className="trial-recent"><div><ClockCounterClockwise size={18} /><h2>This visit’s runs</h2><span>Latest 6 · kept only while this page is open</span></div><div>{runs.map(run => <button key={run.id} className={selectedId === run.id ? "selected" : ""} disabled={running} onClick={() => choose(run)}><span>{run.variant === "fixed" ? "Prepared fix" : "Original sample"}</span><span>{date(run.startedAt)}</span><Badge status={run.status === "completed" ? run.criteria.some(criterion => criterion.status === "failed") ? "failed" : run.criteria.every(criterion => criterion.status === "passed") ? "passed" : "unchecked" : run.status} /></button>)}</div></section>}
      <footer className="trial-footer"><div><strong>Bring the loop to your own project.</strong><p>The full local workspace connects your app, requirements, and coding AI. This online trial checks the included Shipboard sample.</p></div><a href="#upload">Check your own HTML or static ZIP<ArrowRight size={17} /></a></footer>
    </main>
    <dialog ref={dialog} className="trial-preview" onClose={() => setPreview(null)} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}><div><strong>{preview?.title}</strong><button aria-label="Close DOM snapshot" onClick={() => dialog.current?.close()}><X size={21} /></button></div>{preview && <img src={preview.source} alt={preview.title} />}<p>DOM snapshot rendered from the observed page, not a browser screenshot.</p></dialog>
  </div>;
}
