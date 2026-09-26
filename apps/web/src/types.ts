// Shared types mirrored from @ming/contracts
// Web app uses these directly since it cannot import workspace TS source at runtime.

export type StepStatus = "pending" | "running" | "passed" | "failed" | "error" | "skipped";
export type CriteriaStatus = "pending" | "running" | "passed" | "failed" | "blocked" | "error";
export type RunStatus = "pending" | "running" | "passed" | "failed" | "error";

export interface StepResult {
  stepId: string;
  description: string;
  status: StepStatus;
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
  blockedReason?: string;
  steps: StepResult[];
}

export interface RunRecord {
  runId: string;
  planId: string;
  planVersion: string;
  planFingerprint: string;
  targetVariant: string;
  targetUrl: string;
  targetFingerprint: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  criteria: CriteriaResult[];
  fatalError?: string;
}

export interface RunProgress {
  runId: string;
  status: RunStatus;
  currentCriteria?: string;
  finishedCriteria: number;
  totalCriteria: number;
  fatalError?: string;
}

export interface AcceptanceCriteriaInfo {
  id: string;
  title: string;
  description: string;
  dependsOn?: string[];
}

export interface PlanInfo {
  planId: string;
  version: string;
  source: "fixture" | "generated";
  title: string;
  description: string;
  fingerprint: string;
  createdAt: string;
  criteria: AcceptanceCriteriaInfo[];
}

export interface TargetInfo {
  variant: string;
  url: string;
  label: string;
  fingerprint: string;
}
