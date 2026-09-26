export interface UploadedFile { path: string; mime: string; bytes: Uint8Array; }
export interface UploadedProject {
  id: string; name: string; fingerprint: string; files: UploadedFile[];
  entries: string[]; entry: string; totalBytes: number; warnings: string[];
}
export interface PreparedDocument { html: string; scripts: Array<{ code: string; module: boolean }>; warnings: string[]; }
export type UploadAction = 'click' | 'fill' | 'select' | 'check' | 'uncheck' | 'assertText' | 'assertCount' | 'assertValue' | 'reload';
export interface UploadStep { id: string; action: UploadAction; selector: string; value: string; description: string; }
export interface UploadPlan { requirement: string; steps: UploadStep[]; }
export interface PageElement { selector: string; tag: string; label: string; type: string; text: string; }
export interface UploadStepResult extends UploadStep {
  status: 'passed' | 'failed' | 'error' | 'unchecked'; observed: string; expected: string;
  durationMs: number; capture?: string; captureError?: string;
}
export interface UploadRun {
  id: string; projectName: string; projectFingerprint: string; entry: string;
  planFingerprint: string; requirement: string; startedAt: string; finishedAt: string;
  status: 'passed' | 'failed' | 'error' | 'cancelled'; steps: UploadStepResult[];
  error?: string; runner: 'isolated-browser-dom'; captureKind: 'dom-render';
  storage: 'isolated-session-adapter'; diagnostics: string[];
}
export interface UploadProgress { completed: number; total: number; description: string; steps: UploadStepResult[]; }
export interface UploadPreview { elements: PageElement[]; warnings: string[]; }
export interface UploadRuntime {
  preview(project: UploadedProject, entry: string): Promise<UploadPreview>;
  run(options: {project: UploadedProject; entry: string; plan: UploadPlan; signal?: AbortSignal; onProgress?: (progress: UploadProgress) => void}): Promise<UploadRun>;
  dispose(): void;
}
