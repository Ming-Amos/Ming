// ============================================================
// Ming 阶段A 共享类型定义
// ============================================================

export type StepType =
  | "navigate"
  | "fill"
  | "click"
  | "reload"
  | "assertVisible"
  | "assertVisibleIn"    // text visible within a scoped CSS locator
  | "assertNotVisible"
  | "assertCount"
  | "assertInputEnabled"
  | "assertInputDisabled";

export interface PlanStep {
  id: string;
  type: StepType;
  /** 可访问名称或明确定位器 */
  locator?: string;
  /** 填入值 */
  value?: string;
  /** 页面 URL（navigate 专用） */
  url?: string;
  /** 断言期望值：数字(assertCount) / 字符串(assertVisible) */
  expected?: string | number;
  description: string;
}

export interface AcceptanceCriteria {
  id: string;
  title: string;
  description: string;
  /** 步骤列表 */
  steps: PlanStep[];
  /** 前置条件：依赖的 criteria id。依赖的标准必须已 passed 才执行本条。 */
  dependsOn?: string[];
  /**
   * 上下文继承模式：
   *   "fresh"  (默认) — 每次执行使用独立浏览器上下文
   *   "inherit" — 继续使用前一个依赖标准留下的浏览器上下文（共享页面状态）
   */
  contextMode?: "fresh" | "inherit";
}

export interface AcceptancePlan {
  planId: string;
  version: string;
  /** fixture = 固定开发验证夹具；generated = 模型生成（阶段B） */
  source: "fixture" | "generated";
  title: string;
  description: string;
  criteria: AcceptanceCriteria[];
  /** 计划内容的 SHA256 指纹（不含本字段自身） */
  fingerprint: string;
  createdAt: string;
}

export type StepStatus = "pending" | "running" | "passed" | "failed" | "error" | "skipped";
export type CriteriaStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "blocked"
  | "error"
  | "not_run";   // plan rejected or fatal error before execution reached this criterion
export type RunStatus = "pending" | "running" | "passed" | "failed" | "error";

export interface StepResult {
  stepId: string;
  description: string;
  status: StepStatus;
  /** 实际观察到的值（文本摘要等） */
  actual?: string;
  expected?: string | number;
  error?: string;
  screenshotPath?: string;
  durationMs?: number;
}

export interface CriteriaResult {
  criteriaId: string;
  title: string;
  status: CriteriaStatus;
  /** 若为 blocked / not_run，说明原因 */
  blockedReason?: string;
  steps: StepResult[];
}

export interface RunRecord {
  runId: string;
  planId: string;
  planVersion: string;
  planFingerprint: string;
  /** 目标版本：normal | buggy | 其他配置名 */
  targetVariant: string;
  /** 目标地址 */
  targetUrl: string;
  /** 目标源码/配置指纹 */
  targetFingerprint: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  criteria: CriteriaResult[];
  /** 致命错误（非业务失败），如目标不可达 */
  fatalError?: string;
}

/** 前端轮询进度用的精简格式 */
export interface RunProgress {
  runId: string;
  status: RunStatus;
  currentCriteria?: string;
  finishedCriteria: number;
  totalCriteria: number;
  fatalError?: string;
}

/** 目标配置，随每次执行保存 */
export interface TargetConfig {
  variant: string;
  url: string;
  fingerprint: string;
}
