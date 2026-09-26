import bridgeSource from './bridge.js?raw';
import { prepareDocument } from './importer';
import type { UploadedProject, UploadPlan, UploadPreview, UploadRun, UploadRuntime, UploadStepResult } from './types';

const ACTIONS = new Set(['click', 'fill', 'select', 'check', 'uncheck', 'assertText', 'assertCount', 'assertValue', 'reload']);
export function validateUploadPlan(plan: UploadPlan): string[] {
  const errors: string[] = [];
  if (!plan.requirement.trim()) errors.push('Describe what the feature must do.');
  if (!plan.steps.length || plan.steps.length > 30) errors.push('Use between 1 and 30 steps.');
  if (!plan.steps.some(step => step.action.startsWith('assert'))) errors.push('Add at least one assertion to define success.');
  const ids = new Set<string>();
  plan.steps.forEach((step, index) => {
    if (ids.has(step.id)) errors.push('Every step needs a unique ID.'); ids.add(step.id);
    if (!ACTIONS.has(step.action)) errors.push(`Step ${index + 1}: unsupported action.`);
    if (step.action !== 'reload' && !step.selector.trim()) errors.push(`Step ${index + 1}: choose a target selector.`);
    if (step.action === 'assertText' && !step.value.trim()) errors.push(`Step ${index + 1}: enter the text you expect to see.`);
    if (step.action === 'assertCount' && (!/^\d+$/.test(step.value) || Number(step.value) > 10000)) errors.push(`Step ${index + 1}: count must be an integer from 0 to 10000.`);
    if (step.selector.length > 500 || step.value.length > 5000) errors.push(`Step ${index + 1}: target or value is too long.`);
  });
  return errors;
}
const abortError = () => new DOMException('Checks cancelled.', 'AbortError');
async function fingerprint(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function escapeScript(source: string): string { return source.replace(/<\/script/gi, '<\\/script'); }
type Stored = { local: Record<string, string>; session: Record<string, string> };
type Reply = { passed?: boolean; observed?: string; expected?: string; capture?: string; captureError?: string; diagnostics?: string[] };

export function createUploadRuntime(iframe: HTMLIFrameElement): UploadRuntime {
  let port: MessagePort | undefined;
  let disposed = false;
  let active = false;
  let generation = 0;
  let initializeCleanup: (() => void) | undefined;
  const pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void }>();
  // The parent restriction also stops uploaded scripts navigating their own frame to external sites.
  if (!document.querySelector('meta[data-ming-frame-policy]')) {
    const policy = document.createElement('meta'); policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "frame-src 'self' blob: data:"; policy.dataset.mingFramePolicy = 'true'; document.head.append(policy);
  }
  iframe.setAttribute('sandbox', 'allow-scripts allow-forms');
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.setAttribute('allow', "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
  function close() {
    generation++; initializeCleanup?.(); initializeCleanup = undefined;
    port?.close(); port = undefined;
    for (const request of pending.values()) request.reject(abortError()); pending.clear();
    iframe.srcdoc = ''; iframe.src = 'about:blank';
  }
  function response(id: string, timeout = 9000, signal?: AbortSignal): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(abortError()); return; }
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); pending.delete(id); };
      const abort = () => { cleanup(); reject(abortError()); };
      const timer = window.setTimeout(() => { cleanup(); reject(new Error('The isolated page did not respond in time. Check for unsupported scripts or navigation.')); }, timeout);
      pending.set(id, { resolve(value) { cleanup(); resolve(value); }, reject(error) { cleanup(); reject(error); } });
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
  async function command<T>(name: string, data: object = {}, signal?: AbortSignal): Promise<T> {
    if (!port) throw new Error('The isolated page is not ready.');
    const id = crypto.randomUUID(); const result = response(id, 9000, signal);
    port.postMessage({ id, command: name, ...data }); return await result as T;
  }
  async function open(project: UploadedProject, entry: string, storage: Stored, signal?: AbortSignal): Promise<UploadPreview> {
    close(); if (disposed || signal?.aborted) throw abortError();
    const prepared = prepareDocument(project, entry);
    const boot = crypto.randomUUID(); const current = generation;
    const ready = response('ready', 12000, signal);
    const listener = (event: MessageEvent) => {
      if (current !== generation || event.source !== iframe.contentWindow || event.data?.type !== 'ming-upload-ready' || event.data.boot !== boot) return;
      window.removeEventListener('message', listener); initializeCleanup = undefined;
      const channel = new MessageChannel(); port = channel.port1;
      port.onmessage = message => {
        const payload = message.data;
        if (!payload || typeof payload.id !== 'string') return;
        const request = pending.get(payload.id); if (!request) return;
        if (typeof payload.error === 'string') request.reject(new Error(payload.error.slice(0, 1000)));
        else request.resolve(payload.result);
      };
      port.start(); iframe.contentWindow?.postMessage({ type: 'ming-upload-init', boot, storage, scripts: prepared.scripts }, '*', [channel.port2]);
    };
    window.addEventListener('message', listener); initializeCleanup = () => window.removeEventListener('message', listener);
    const csp = "default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline' data:; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; media-src data:";
    const documentCopy = new DOMParser().parseFromString(prepared.html, 'text/html');
    const security = documentCopy.createElement('meta'); security.httpEquiv = 'Content-Security-Policy'; security.content = csp;
    const referrer = documentCopy.createElement('meta'); referrer.name = 'referrer'; referrer.content = 'no-referrer';
    const bridge = documentCopy.createElement('script'); bridge.dataset.boot = boot; bridge.textContent = escapeScript(bridgeSource);
    documentCopy.head.prepend(security, referrer, bridge);
    iframe.srcdoc = '<!doctype html>' + documentCopy.documentElement.outerHTML;
    try { const result = await ready as UploadPreview; return { elements: Array.isArray(result.elements) ? result.elements.slice(0, 80) : [], warnings: [...prepared.warnings, ...(result.warnings || [])] }; }
    catch (error) { if (current === generation) close(); throw error; }
  }
  return {
    async preview(project, entry) {
      if (active) throw new Error('Finish or cancel the current check first.');
      return open(project, entry, { local: {}, session: {} });
    },
    async run({ project, entry, plan, signal, onProgress }) {
      if (active) throw new Error('A check is already running.');
      const issues = validateUploadPlan(plan); if (issues.length) throw new Error(issues.join(' '));
      const frozen = structuredClone(plan); active = true;
      const run: UploadRun = { id: crypto.randomUUID(), projectName: project.name, projectFingerprint: project.fingerprint,
        entry, planFingerprint: await fingerprint(frozen), requirement: frozen.requirement, startedAt: new Date().toISOString(), finishedAt: '',
        status: 'error', runner: 'isolated-browser-dom', captureKind: 'dom-render', storage: 'isolated-session-adapter', diagnostics: [],
        steps: frozen.steps.map(step => ({ ...step, status: 'unchecked', observed: 'Not checked', expected: step.value || step.description || step.action, durationMs: 0 })) };
      let index = 0;
      const progress = (description: string) => onProgress?.({ completed: run.steps.filter(step => step.status !== 'unchecked').length, total: run.steps.length, description, steps: structuredClone(run.steps) });
      try {
        progress('Opening your uploaded page in an isolated browser session…');
        const preview = await open(project, entry, { local: {}, session: {} }, signal); run.diagnostics.push(...preview.warnings);
        for (; index < frozen.steps.length; index++) {
          if (signal?.aborted) throw abortError();
          const step = frozen.steps[index], started = performance.now(); progress(step.description || `${step.action} ${step.selector}`);
          let reply: Reply;
          if (step.action === 'reload') {
            const storage = await command<Stored>('storage', {}, signal);
            if (JSON.stringify(storage).length > 300000) throw new Error('Isolated storage exceeds the supported limit.');
            await open(project, entry, storage, signal);
            reply = { passed: true, observed: 'Reopened the uploaded document with the same isolated storage adapter.', expected: 'Reload the isolated page', ...await command<Reply>('capture', {}, signal) };
          } else reply = await command<Reply>('step', { step }, signal);
          const result: UploadStepResult = { ...step, status: reply.passed === true ? 'passed' : 'failed', observed: String(reply.observed ?? 'No observation returned').slice(0, 5000), expected: String(reply.expected ?? step.value).slice(0, 5000), durationMs: Math.round(performance.now() - started) };
          if (typeof reply.capture === 'string' && reply.capture.startsWith('data:image/png;base64,') && reply.capture.length < 6000000) result.capture = reply.capture;
          else result.captureError = String(reply.captureError || 'DOM snapshot unavailable.').slice(0, 500);
          run.steps[index] = result; run.diagnostics = [...new Set([...run.diagnostics, ...(reply.diagnostics || [])])].slice(0, 40); progress(result.observed);
          if (result.status === 'failed') { run.status = 'failed'; break; }
        }
        if (index === frozen.steps.length) run.status = 'passed';
      } catch (error) {
        run.status = signal?.aborted || (error instanceof DOMException && error.name === 'AbortError') ? 'cancelled' : 'error';
        run.error = error instanceof Error ? error.message : 'Check could not finish.';
        if (run.status === 'error' && run.steps[index]) run.steps[index] = { ...run.steps[index], status: 'error', observed: run.error };
        close();
      } finally { active = false; run.finishedAt = new Date().toISOString(); progress(run.status === 'cancelled' ? 'Cancelled. Unfinished steps remain unchecked.' : 'Check finished.'); }
      return run;
    },
    dispose() { disposed = true; close(); },
  };
}

export function makeUploadRepairBrief(run: UploadRun): string {
  return [`# Ming acceptance feedback`, `Project: ${run.projectName}`, `Source fingerprint: ${run.projectFingerprint}`, `Plan fingerprint: ${run.planFingerprint}`,
    `Run: ${run.id} (${run.status})`, `Requirement: ${run.requirement}`, '', 'Observed in an isolated browser DOM check. Storage uses a session adapter; captures are DOM renders. No AI repair has been performed.',
    ...run.steps.filter(step => step.status !== 'passed').map(step => `\n${step.description || step.action} [${step.status}]\nAction: ${step.action}\nTarget: ${step.selector || '(page)'}\nValue: ${step.value}\nExpected: ${step.expected}\nObserved: ${step.observed}`),
    '', 'Fix the uploaded source against these requirements, then rerun the same confirmed plan. Do not change assertions to hide failures.',
    ...(run.diagnostics.length ? ['', 'Page diagnostics:', ...run.diagnostics] : [])].join('\n');
}
