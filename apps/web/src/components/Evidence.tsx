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
  passed: "通过",
  failed: "未通过",
  error: "执行错误",
  blocked: "已阻塞",
  not_run: "未执行",
  pending: "等待执行",
  running: "检查中",
  skipped: "已跳过",
  waiting: "等待 AI 接手",
  claimed: "已领取",
  rerunning: "复验中",
  review: "复验通过 · 待确认",
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
          浏览器实拍
        </span>
        <span className="frame-address" title={run.targetUrl}>
          {run.targetUrl}
        </span>
        <button
          className="image-zoom-button"
          onClick={() => setZoom((z) => (z === 1 ? 1.8 : 1))}
          aria-label={zoom === 1 ? "放大证据" : "适应宽度"}
        >
          {zoom === 1 ? "放大" : "适应"}
        </button>
        <a
          href={screenshot(step.screenshotPath)}
          target="_blank"
          rel="noreferrer"
          aria-label={`打开${caption}原图`}
        >
          <ArrowSquareOut size={17} />
        </a>
      </div>
      {failed ? (
        <div className="image-missing">
          <WarningCircle size={28} />
          <p>证据图片暂时无法读取</p>
          <small>运行记录仍保留，请检查证据存储。</small>
        </div>
      ) : (
        <div
          ref={viewport}
          className="image-viewport"
          tabIndex={0}
          aria-label="可滚动的原始截图窗口"
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
              alt={`${caption}：${step.description}`}
              onError={() => setFailed(true)}
            />
          </a>
        </div>
      )}
      <figcaption>
        <span>{caption}</span>
        <span>
          {step.stepId}
          <small>滚动查看 · 可打开原图</small>
        </span>
      </figcaption>
    </figure>
  );
}
