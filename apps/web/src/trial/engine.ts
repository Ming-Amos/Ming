import html2canvas from 'html2canvas';
import type { RunTrialOptions, TrialCriterion, TrialRun, TrialStep } from './types';

const TOTAL_STEPS = 16;
const STORAGE_PREFIX = 'ming.online-trial.shipboard.';
const FIXTURE_PATH = '/trial/shipboard.html';
const activeFrames = new WeakSet<HTMLIFrameElement>();
const validationText = 'Add a task name before continuing.';

// This reviewed plan is deliberately deterministic. No model generates results.
export const TRIAL_CRITERIA = [
  { id: 'SHIP-01', title: 'A new task appears on the board', expected: 'The exact new task is visible in the task list, and the board contains one task.' },
  { id: 'SHIP-02', title: 'The same task survives a reload', expected: 'After a real page reload, the exact task is still visible and the board still contains one task.' },
  { id: 'SHIP-03', title: 'Blank task names are rejected', expected: 'Empty and whitespace-only submissions show an actionable validation message and create no tasks.' },
] as const;

const plan = {
  version: '1.0.0',
  criteria: TRIAL_CRITERIA,
  steps: [
    'open fresh session', 'fill unique name', 'click Add task', 'assert exact visible task and count 1',
    'reload same session', 'assert same exact visible task and count 1',
    'open independent fresh session', 'assert count 0', 'fill empty', 'click Add task',
    'assert visible validation and aria-invalid', 'assert count 0', 'fill whitespace', 'click Add task',
    'assert visible validation and aria-invalid', 'assert count 0',
  ],
};

function cancelled(): DOMException { return new DOMException('The check was cancelled.', 'AbortError'); }
function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw cancelled(); }

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const timer = window.setTimeout(() => { cleanup(); resolve(); }, ms);
    const abort = () => { window.clearTimeout(timer); cleanup(); reject(cancelled()); };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function bound<T>(promise: Promise<T>, signal: AbortSignal | undefined, timeoutMs: number, label: string): Promise<T> {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const cleanup = () => { window.clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(cancelled()); };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error(`${label} timed out.`)); }, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

function documentFor(frame: HTMLIFrameElement): Document {
  const doc = frame.contentDocument;
  if (doc?.documentElement.dataset.trialError) throw new Error(doc.documentElement.dataset.trialError);
  if (!doc || doc.documentElement.dataset.mingTrial !== 'shipboard-v1') {
    throw new Error('The controlled Shipboard application did not load. Please try again.');
  }
  return doc;
}

function required<T extends Element>(doc: Document, selector: string): T {
  const element = doc.querySelector<T>(selector);
  if (!element) throw new Error(`The sample application is missing ${selector}.`);
  return element;
}

function visible(element: Element): boolean {
  const win = element.ownerDocument.defaultView;
  if (!win || !element.isConnected || element.closest('[hidden]')) return false;
  const style = win.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
}

function openFrame(frame: HTMLIFrameElement, url: URL, signal?: AbortSignal, reload = false): Promise<void> {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      frame.removeEventListener('load', loaded);
      frame.removeEventListener('error', failed);
      signal?.removeEventListener('abort', abort);
    };
    const failed = () => { cleanup(); reject(new Error('The sample application could not be loaded.')); };
    const abort = () => { cleanup(); reject(cancelled()); };
    const loaded = () => {
      try {
        const actual = new URL(frame.contentWindow?.location.href ?? 'about:blank');
        const fixturePath = actual.pathname === FIXTURE_PATH || actual.pathname === FIXTURE_PATH.replace(/\.html$/, '');
        if (actual.origin !== url.origin || !fixturePath || actual.search !== url.search) return;
        documentFor(frame);
        cleanup(); resolve();
      } catch (error) { cleanup(); reject(error); }
    };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('The sample application took more than 6 seconds to load.')); }, 6000);
    frame.addEventListener('load', loaded);
    frame.addEventListener('error', failed);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      if (reload) {
        if (!frame.contentWindow) throw new Error('The sample browser is unavailable.');
        frame.contentWindow.location.reload();
      } else frame.src = url.href;
    } catch (error) { cleanup(); reject(error); }
  });
}

function fill(frame: HTMLIFrameElement, value: string): void {
  const input = required<HTMLInputElement>(documentFor(frame), '#taskName');
  input.focus(); input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function submit(frame: HTMLIFrameElement): void {
  required<HTMLButtonElement>(documentFor(frame), '#taskForm button[type="submit"]').click();
}

function taskCount(frame: HTMLIFrameElement): number {
  return required(documentFor(frame), '#taskList').querySelectorAll('.task-item').length;
}

function inspectTask(frame: HTMLIFrameElement, taskName: string): Observation {
  const list = required(documentFor(frame), '#taskList');
  const names = [...list.querySelectorAll('.task-name')];
  const found = names.some(node => node.textContent === taskName && visible(node));
  const count = list.querySelectorAll('.task-item').length;
  const counter = required(documentFor(frame), '#taskCount').textContent?.trim();
  return {
    passed: found && count === 1 && counter === '1 task',
    observed: found
      ? `The exact task “${taskName}” is visible in #taskList. Rows: ${count}; displayed count: ${counter}.`
      : `The exact task “${taskName}” is absent from #taskList. Rows: ${count}; displayed count: ${counter}.`,
  };
}

function inspectEmpty(frame: HTMLIFrameElement): Observation {
  const count = taskCount(frame);
  const displayed = required(documentFor(frame), '#taskCount').textContent?.trim();
  return { passed: count === 0 && displayed === '0 tasks', observed: `Task rows: ${count}; displayed count: ${displayed}.` };
}

function inspectValidation(frame: HTMLIFrameElement): Observation {
  const doc = documentFor(frame);
  const notice = required(doc, '#notice');
  const invalid = required(doc, '#taskName').getAttribute('aria-invalid');
  const text = notice.textContent?.trim() ?? '';
  return { passed: visible(notice) && text === validationText && invalid === 'true', observed: `Validation: “${text || '(none)'}”; field marked invalid: ${invalid === 'true'}.` };
}

interface Observation { passed: boolean; observed: string; }

/** Fresh DOM actions and assertions against a bundled sample, never recorded results. */
export async function runTrial(options: RunTrialOptions): Promise<TrialRun> {
  const { iframe, variant, signal, onProgress } = options;
  const id = crypto.randomUUID();
  const taskName = `${options.taskName.trim().slice(0, 100) || 'Ship the release notes'} · ${id.slice(0, 8)}`;
  const run: TrialRun = {
    id, variant, taskName, startedAt: new Date().toISOString(), finishedAt: '', planFingerprint: '',
    status: 'error', runner: 'in-browser-dom', captureKind: 'dom-render', steps: [],
    criteria: TRIAL_CRITERIA.map(item => ({ ...item, status: 'unchecked', observed: 'Not checked yet.' })),
  };
  const sessions = [crypto.randomUUID(), crypto.randomUUID()];
  let ownsFrame = false;
  let criterion: TrialCriterion | undefined;
  const progress = (step: string) => { try { onProgress?.({ step, completed: run.steps.length, total: TOTAL_STEPS }); } catch { /* An observer cannot determine check outcomes. */ } };

  async function step(id: string, description: string, action: () => Observation | Promise<Observation>, capture = false): Promise<TrialStep> {
    checkAbort(signal);
    progress(description);
    const start = performance.now();
    let item: TrialStep;
    try {
      const result = await action();
      await wait(160, signal);
      item = { id, description, status: result.passed ? 'passed' : 'failed', observed: result.observed, durationMs: Math.round(performance.now() - start) };
      if (capture) {
        try {
          const doc = documentFor(iframe);
          const canvas = await bound(html2canvas(doc.documentElement, {
            backgroundColor: '#f4f5f9', scale: 1, logging: false,
            windowWidth: iframe.clientWidth || 800, windowHeight: iframe.clientHeight || 650,
            width: Math.min(doc.documentElement.scrollWidth, 1400), height: Math.min(doc.documentElement.scrollHeight, 1200),
            useCORS: false, imageTimeout: 2000, removeContainer: true,
          }), signal, 4000, 'DOM capture');
          item.capture = canvas.toDataURL('image/png');
        } catch (error) {
          checkAbort(signal);
          item.observed += ` DOM render unavailable: ${error instanceof Error ? error.message : 'capture failed'}`;
        }
      }
      run.steps.push(item);
      progress(description);
      return item;
    } catch (error) {
      if (!signal?.aborted) run.steps.push({ id, description, status: 'error', observed: error instanceof Error ? error.message : String(error), durationMs: Math.round(performance.now() - start) });
      throw error;
    }
  }

  function complete(target: TrialCriterion, items: TrialStep[]) {
    target.status = items.every(item => item.status === 'passed') ? 'passed' : 'failed';
    target.observed = items.filter(item => item.status !== 'passed').map(item => item.observed).join('\n') || items.map(item => item.observed).join('\n');
    target.capture = [...items].reverse().find(item => item.capture)?.capture;
  }

  function fixtureUrl(session: string): URL {
    const url = new URL(FIXTURE_PATH, window.location.origin);
    url.searchParams.set('variant', variant); url.searchParams.set('session', session);
    return url;
  }

  try {
    checkAbort(signal);
    if (variant !== 'buggy' && variant !== 'fixed') throw new Error('Unknown sample version.');
    if (activeFrames.has(iframe)) throw new Error('A check is already using this sample browser.');
    activeFrames.add(iframe); ownsFrame = true;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(plan)));
    run.planFingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const url = fixtureUrl(sessions[0]);
    criterion = run.criteria[0];
    await step('SHIP-01-S1', 'Open a fresh Shipboard session', async () => { await openFrame(iframe, url, signal); return { passed: true, observed: 'A new isolated sample session loaded.' }; });
    await step('SHIP-01-S2', 'Enter a unique task name', () => { fill(iframe, taskName); return { passed: true, observed: `Entered “${taskName}”.` }; });
    await step('SHIP-01-S3', 'Add the task to the board', () => { submit(iframe); return { passed: true, observed: 'Clicked the actual Add task button.' }; });
    const creation = await step('SHIP-01-S4', 'Check the exact task in the list', () => inspectTask(iframe, taskName), true);
    complete(criterion, [creation]);

    criterion = run.criteria[1];
    if (creation.status === 'passed') {
      await step('SHIP-02-S1', 'Reload the same application page', async () => { await openFrame(iframe, url, signal, true); return { passed: true, observed: 'The iframe completed a real location.reload() with the same session.' }; });
      const persistence = await step('SHIP-02-S2', 'Check the task survived the reload', () => inspectTask(iframe, taskName), true);
      complete(criterion, [persistence]);
    } else criterion.observed = 'Not checked because the task-creation prerequisite failed.';

    criterion = run.criteria[2];
    await step('SHIP-03-S1', 'Open an independent empty board', async () => { await openFrame(iframe, fixtureUrl(sessions[1]), signal); return { passed: true, observed: 'A different isolated sample session loaded.' }; });
    const checks: TrialStep[] = [];
    checks.push(await step('SHIP-03-S2', 'Check the fresh board has no tasks', () => inspectEmpty(iframe)));
    await step('SHIP-03-S3', 'Leave the task name empty', () => { fill(iframe, ''); return { passed: true, observed: 'The task-name field is empty.' }; });
    await step('SHIP-03-S4', 'Try to add an empty task', () => { submit(iframe); return { passed: true, observed: 'Clicked Add task with an empty input.' }; });
    checks.push(await step('SHIP-03-S5', 'Check the validation message', () => inspectValidation(iframe)));
    checks.push(await step('SHIP-03-S6', 'Check no empty task was created', () => inspectEmpty(iframe), true));
    await step('SHIP-03-S7', 'Enter a whitespace-only task name', () => { fill(iframe, '   '); return { passed: true, observed: 'Entered three spaces.' }; });
    await step('SHIP-03-S8', 'Try to add a whitespace-only task', () => { submit(iframe); return { passed: true, observed: 'Clicked Add task with whitespace only.' }; });
    checks.push(await step('SHIP-03-S9', 'Check whitespace also triggers validation', () => inspectValidation(iframe)));
    checks.push(await step('SHIP-03-S10', 'Check the task board is still empty', () => inspectEmpty(iframe), true));
    complete(criterion, checks);
    run.status = 'completed';
  } catch (error) {
    run.status = signal?.aborted || (error instanceof DOMException && error.name === 'AbortError') ? 'cancelled' : 'error';
    run.error = run.status === 'cancelled' ? 'The check was cancelled. Completed observations are preserved.' : error instanceof Error ? error.message : String(error);
    if (criterion?.status === 'unchecked') criterion.observed = run.error;
  } finally {
    // Never clear the site's storage: delete only the unique keys owned by this run.
    if (ownsFrame) {
      try { iframe.contentDocument?.dispatchEvent(new Event('ming-trial-dispose')); } catch { /* A closed sample has nothing to dispose. */ }
      if (run.status !== 'completed') {
        // A late navigation must not recreate its storage key after cancellation.
        try { iframe.contentWindow?.stop(); iframe.src = 'about:blank'; } catch { /* A removed frame has already stopped. */ }
      }
    }
    for (const session of sessions) {
      try { window.localStorage.removeItem(STORAGE_PREFIX + session); } catch { /* Storage may be disabled by the browser. */ }
    }
    if (ownsFrame) activeFrames.delete(iframe);
    run.finishedAt = new Date().toISOString();
    progress(run.status === 'completed' ? 'Check complete' : run.status === 'cancelled' ? 'Check cancelled' : 'Check could not finish');
  }
  return run;
}

export function makeRepairBrief(run: TrialRun): string {
  const failures = run.criteria.filter(item => item.status === 'failed');
  return [
    '# Ming acceptance evidence',
    `Run: ${run.id}`, `Sample version: ${run.variant}`, `Started: ${run.startedAt}`, `Finished: ${run.finishedAt}`,
    `Runner: ${run.runner} (actions and assertions executed in the visitor's browser)`,
    `Plan SHA-256: ${run.planFingerprint}`, `Unique task: ${run.taskName}`, `Run status: ${run.status}`,
    'Capture type: DOM renders, not native browser screenshots.',
    '', '## Acceptance results',
    ...run.criteria.flatMap(item => [`### ${item.id}: ${item.title} — ${item.status}`, `Expected: ${item.expected}`, `Observed: ${item.observed}`, '']),
    '## Reproduction steps',
    ...run.steps.map(item => `- ${item.id} [${item.status}] ${item.description}: ${item.observed}`),
    '', '## Repair request',
    failures.length
      ? 'Use the failed observations above to inspect the sample source and implement a fix. Preserve the original evidence and rerun the same acceptance plan. Do not report success without a fresh passing run.'
      : 'No failed criterion is available in this run. An incomplete or cancelled run is not acceptance evidence for unchecked criteria.',
    '', 'This brief is ready to copy to a coding AI. No AI was called and no code was repaired by this browser trial.',
  ].join('\n');
}
