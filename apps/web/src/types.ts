// Shared types mirrored from @ming/contracts
// Web app uses these directly since it cannot import workspace TS source at runtime.

export type StepStatus = "pending" | "running" | "passed" | "failed" | "error" | "skipped";
export type CriteriaStatus = "pending" | "running" | "passed" | "failed" | "blocked" | "error" | "not_run";
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
  confirmationId?: string;
  requirementId?: string;
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
  requirementRef?: string;
  expectedBehavior?: string;
  openQuestions?: string[];
}

export interface PlanInfo {
  planId: string;
  version: string;
  source: "fixture" | "generated";
  transportProvenance?: "live" | "test";
  title: string;
  description: string;
  fingerprint: string;
  createdAt: string;
  criteria: AcceptanceCriteriaInfo[];
  originalRequirement?: string;
  projectId?: string;
  requirementId?: string;
}

export interface TargetInfo {
  variant: string;
  url: string;
  label: string;
  fingerprint: string;
}

// ── Stage B types ────────────────────────────────────────────────

export type ProviderErrorCategory =
  | "missing_config" | "auth" | "quota" | "timeout" | "network" | "invalid_output" | "unknown";

export interface GenerationUsage {
  providerLabel: string;
  modelId: string;
  invokedAt: string;
  durationMs: number;
  isLive: boolean;
  status: "success" | "error";
  errorCategory?: ProviderErrorCategory;
  errorMessage?: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface DraftRecord {
  draftId: string;
  projectId: string;
  requirementId: string;
  draftVersion: number;
  plan: PlanInfo;
  usage: GenerationUsage;
  hasOpenQuestions: boolean;
  validationErrors: string[];
  createdAt: string;
}

export interface ConfirmationRecord {
  confirmationId: string;
  draftId: string;
  planId: string;
  planFingerprint: string;
  planVersion: string;
  projectId: string;
  requirementId: string;
  targetVariant: string;
  confirmedAt: string;
  planSnapshot: PlanInfo;
}

export interface ProviderStatus {
  configured: boolean;
  providerLabel: string;
  baseUrl: string;
  modelId: string;
  missingFields: string[];
}

export interface ProjectRecord {
  projectId: string;
  name: string;
  targetVariant: string;
  targetUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementRecord {
  requirementId: string;
  projectId: string;
  version: number;
  text: string;
  createdAt: string;
}
