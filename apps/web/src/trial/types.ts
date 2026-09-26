export type TrialVariant = 'buggy' | 'fixed';

export interface TrialCriterion {
  id: string;
  title: string;
  status: 'passed' | 'failed' | 'unchecked';
  expected: string;
  observed: string;
  capture?: string;
}

export interface TrialStep {
  id: string;
  description: string;
  status: 'passed' | 'failed' | 'error';
  observed: string;
  durationMs: number;
  capture?: string;
}

export interface TrialRun {
  id: string;
  variant: TrialVariant;
  taskName: string;
  startedAt: string;
  finishedAt: string;
  planFingerprint: string;
  status: 'completed' | 'cancelled' | 'error';
  criteria: TrialCriterion[];
  steps: TrialStep[];
  error?: string;
  captureKind: 'dom-render';
  runner: 'in-browser-dom';
}

export interface TrialProgress {
  step: string;
  completed: number;
  total: number;
}

export interface RunTrialOptions {
  iframe: HTMLIFrameElement;
  variant: TrialVariant;
  taskName: string;
  signal?: AbortSignal;
  onProgress?: (progress: TrialProgress) => void;
}
