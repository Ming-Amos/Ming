import { useState } from "react";
import { ArrowsHorizontal, ArrowSquareOut } from "@phosphor-icons/react";
import type { RunRecord, StepResult } from "../types";
const url = (step: StepResult) => `/api/screenshots/${encodeURIComponent(step.screenshotPath!.split(/[\\/]/).pop()!)}`;
export default function EvidenceCompare({ before, after }: { before: { step: StepResult; run: RunRecord }; after: { step: StepResult; run: RunRecord } }) {
  const [split, setSplit] = useState(50);
  const moveDivider = (element: HTMLDivElement, clientX: number) => {
    const bounds = element.getBoundingClientRect();
    setSplit(Math.round(Math.min(100, Math.max(0, (clientX - bounds.left) / bounds.width * 100))));
  };
  return <section className="evidence-comparison" aria-label="Interactive repair evidence comparison">
    <div className="comparison-intro"><div><span className="eyebrow">THE SAME STANDARD. A DIFFERENT RESULT.</span><h3>Move the line. See the repair.</h3></div><ArrowsHorizontal size={25} /></div>
    <div className="comparison-stage" onPointerDown={event => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      moveDivider(event.currentTarget, event.clientX);
    }} onPointerMove={event => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) moveDivider(event.currentTarget, event.clientX);
    }} onPointerUp={event => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}>
      <img src={url(after.step)} alt={`After repair: ${after.step.description}`} />
      <div className="comparison-before" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}><img src={url(before.step)} alt={`Before repair: ${before.step.description}`} /></div>
      <span className="comparison-label label-before">BEFORE</span><span className="comparison-label label-after">AFTER</span>
      <div className="comparison-divider" style={{ left: `${split}%` }}><ArrowsHorizontal size={22} /></div>
    </div>
    <input type="range" min="0" max="100" value={split} aria-label="Compare before and after screenshots" aria-valuetext={`${split}% before, ${100 - split}% after`} onChange={e => setSplit(Number(e.target.value))} />
    <div className="comparison-source-links"><a href={url(before.step)} target="_blank" rel="noreferrer">Original before <ArrowSquareOut size={13} /></a><span>Original captures · no generated pixels</span><a href={url(after.step)} target="_blank" rel="noreferrer">Original after <ArrowSquareOut size={13} /></a></div>
  </section>;
}
