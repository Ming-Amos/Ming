import { useEffect, useRef, useState } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  Info,
  MagnifyingGlass,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import type { RunRecord, StepResult } from "../types";
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
function screenshot(path?: string) {
  return path
    ? `/api/screenshots/${encodeURIComponent(path.split(/[\\/]/).pop()!)}`
    : "";
}
export function Status({ value }: { value: string }) {
  const Icon =
    value === "passed"
      ? CheckCircle
      : value === "failed" || value === "error"
        ? XCircle
        : value === "running" || value === "rerunning"
          ? CircleNotch
          : value === "blocked"
            ? WarningCircle
            : Info;
  return (
    <span className={`status status-${value}`}>
      <Icon
        size={15}
        weight="fill"
        className={value === "running" || value === "rerunning" ? "spin" : ""}
      />
      {labels[value] || value}
    </span>
  );
}
export function EvidenceImage({
  step,
  run,
  caption,
}: {
  step: StepResult;
  run: RunRecord;
  caption: string;
}) {
  const [failed, setFailed] = useState(false),
    [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFailed(false);
    setZoom(1);
  }, [step.screenshotPath]);
  useEffect(() => {
    if (viewport.current)
      viewport.current.scrollLeft =
        (viewport.current.scrollWidth - viewport.current.clientWidth) / 2;
  }, [zoom]);
  return (
    <figure className="evidence-frame">
      <div className="frame-toolbar">
        <span>
          <MagnifyingGlass size={15} />
          BROWSER CAPTURE
        </span>
        <span className="frame-address" title={run.targetUrl}>
          {run.targetUrl}
        </span>
        <button
          className="image-zoom-button"
          onClick={() => setZoom((z) => (z === 1 ? 1.8 : 1))}
          aria-label={zoom === 1 ? "Zoom evidence" : "Fit evidence to width"}
        >
          {zoom === 1 ? "Zoom" : "Fit"}
        </button>
        <a
          href={screenshot(step.screenshotPath)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open original: ${caption}`}
        >
          <ArrowSquareOut size={17} />
        </a>
      </div>
      {failed ? (
        <div className="image-missing">
          <WarningCircle size={28} />
          <p>This evidence image is unavailable.</p>
          <small>The run is still saved. Check the evidence storage.</small>
        </div>
      ) : (
        <div
          ref={viewport}
          className="image-viewport"
          tabIndex={0}
          aria-label="Scrollable original screenshot"
        >
          <a
            className="evidence-link"
            href={screenshot(step.screenshotPath)}
            target="_blank"
            rel="noreferrer"
            style={{ width: `${zoom * 100}%` }}
          >
            <img
              src={screenshot(step.screenshotPath)}
              alt={`${caption}: ${step.description}`}
              onError={() => setFailed(true)}
            />
          </a>
        </div>
      )}
      <figcaption>
        <span>{caption}</span>
        <span>
          {step.stepId}
          <small>Scroll to inspect · Open original</small>
        </span>
      </figcaption>
    </figure>
  );
}
