import { useEffect, useMemo, useRef, useState } from "react";
import { CaretLeft, CaretRight, Pause, Play, Check, X, Circle, FilmStrip } from "@phosphor-icons/react";
import type { RunRecord } from "../types";

export default function ProofTimeline({ run, criterionId, stepId, onSelect }: {
  run: RunRecord; criterionId: string; stepId?: string;
  onSelect: (criterionId: string, stepId: string) => void;
}) {
  const steps = useMemo(() => run.criteria.flatMap(c => c.steps.map(s => ({ ...s, criterionId: c.criteriaId, criterionTitle: c.title }))), [run]);
  const [playing, setPlaying] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  const selected = Math.max(0, steps.findIndex(s => s.criterionId === criterionId && (!stepId || s.stepId === stepId)));
  const current = steps[selected];
  const select = (index: number) => { const item = steps[index]; if (item) onSelect(item.criterionId, item.stepId); };
  useEffect(() => { setPlaying(false); }, [run.runId]);
  useEffect(() => {
    if (!playing) return;
    if (selected >= steps.length - 1) { setPlaying(false); return; }
    const timer = setTimeout(() => select(selected + 1), 1500);
    return () => clearTimeout(timer);
  }, [playing, selected, steps]);
  useEffect(() => {
    const item = rail.current?.querySelector<HTMLElement>('[aria-current="step"]');
    if (item && rail.current) rail.current.scrollLeft = Math.max(0, item.offsetLeft - rail.current.offsetLeft - rail.current.clientWidth / 2 + item.clientWidth / 2);
  }, [selected]);
  if (!current) return null;
  return <section className="proof-timeline" aria-label="Recorded acceptance timeline">
    <div className="trace-heading"><span><FilmStrip size={17} />RECORDED TRACE</span><span>{steps.length} steps · {run.criteria.length} criteria <span className="trace-source">/ actual browser actions</span></span></div>
    <div className="trace-controls">
      <button className={`trace-play ${playing ? "active" : ""}`} aria-label={playing ? "Pause evidence replay" : "Play recorded steps"} onClick={() => { if (!playing && selected >= steps.length - 1) select(0); setPlaying(!playing); }}>
        {playing ? <Pause size={17} weight="fill" /> : <Play size={17} weight="fill" />}
      </button>
      <div className="trace-rail" ref={rail}>
        {steps.map((step, index) => <button key={`${step.criterionId}-${step.stepId}`} className={`trace-step trace-${step.status} ${selected === index ? "current" : ""}`} title={`${step.criterionTitle} / ${step.description} · ${step.status}`} aria-label={`Step ${index + 1}: ${step.description}`} aria-current={selected === index ? "step" : undefined} onClick={() => { setPlaying(false); select(index); }}>
          <span className="trace-position">{String(index + 1).padStart(2, "0")}</span>
          {step.status === "passed" ? <Check size={15} weight="bold" /> : step.status === "failed" || step.status === "error" ? <X size={15} weight="bold" /> : <Circle size={14} />}
          <span className="trace-step-name">{step.description}</span>
        </button>)}
      </div>
      <div className="trace-arrows"><button className="icon-button" aria-label="Previous recorded step" disabled={selected === 0} onClick={() => { setPlaying(false); select(selected - 1); }}><CaretLeft size={17} /></button><button className="icon-button" aria-label="Next recorded step" disabled={selected === steps.length - 1} onClick={() => { setPlaying(false); select(selected + 1); }}><CaretRight size={17} /></button></div>
    </div>
    <div className="trace-caption"><strong>{String(selected + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</strong><span>{current.description}</span><span className={`trace-result trace-${current.status}`}><span className="trace-status-label">{current.status.replace(/_/g, " ")}</span>{current.durationMs !== undefined ? ` · ${current.durationMs} ms` : ""}</span></div>
    <input className="trace-scrubber" aria-label="Scrub recorded steps" type="range" min={0} max={Math.max(0, steps.length - 1)} value={selected} onChange={e => { setPlaying(false); select(Number(e.target.value)); }} />
    <p className="trace-note">Replay follows saved actions. It does not run a new check or invent missing screenshots.</p>
  </section>;
}
