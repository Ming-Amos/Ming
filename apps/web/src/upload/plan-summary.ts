import type { PageElement, UploadAction, UploadStep } from './types';

export interface PlanStepSummary {
  id: string;
  /** Position in the original executable plan, starting at one. */
  index: number;
  action: UploadAction;
  kind: 'action' | 'assertion';
  text: string;
  expectedOutcome?: string;
  targetLabel: string | null;
  complete: boolean;
}
export interface PlanScenarioSummary {
  id: string;
  title: string;
  steps: PlanStepSummary[];
  actionSummaries: string[];
  expectedOutcomes: string[];
  assertionCount: number;
  complete: boolean;
  startIndex: number;
  endIndex: number;
}
export interface PlanSummary {
  scenarios: PlanScenarioSummary[];
  stepCount: number;
  /** Includes assertions still missing a target or expected value. */
  assertionCount: number;
  isEmpty: boolean;
  hasIncompleteSteps: boolean;
  note: string;
}

const assertions = new Set<UploadAction>(['assertText', 'assertCount', 'assertValue']);
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const shorten = (value: string, limit: number) => value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
// Preserve whitespace-sensitive values; JSON quoting makes newlines visible.
const quote = (value: string) => JSON.stringify(value);

function observedLabel(selector: string, elements: readonly PageElement[]): string | null {
  const matches = elements.filter(element => element.selector === selector);
  if (matches.length !== 1) return null;
  const element = matches[0], label = clean(element.label);
  // The inventory sometimes falls back to an element ID. That is a locator,
  // not a user-facing label; do not infer words or a feature name from it.
  if (!label || label === selector || selector === `#${label}` || /[{}<>]|(?:^|\s)[#.][\w-]+|:nth-|\[[^\]]+\]/.test(label)) return null;
  // Output text such as "0 tasks" names the current state, not the field.
  if (!['input', 'textarea', 'select', 'button'].includes(element.tag.toLowerCase()) && label === clean(element.text)) return null;
  return shorten(label, 70);
}

function describeStep(step: UploadStep, index: number, elements: readonly PageElement[]): PlanStepSummary {
  const kind = assertions.has(step.action) ? 'assertion' : 'action';
  const targetLabel = step.action === 'reload' ? null : observedLabel(step.selector, elements);
  const target = targetLabel ? quote(targetLabel) : ['fill', 'select', 'assertValue'].includes(step.action) ? 'the selected field' : ['check', 'uncheck'].includes(step.action) ? 'the selected checkbox' : 'the selected item';
  const complete = (step.action === 'reload' || Boolean(step.selector.trim()))
    && (step.action !== 'assertText' || Boolean(step.value.trim()))
    && (step.action !== 'assertCount' || /^\d+$/.test(step.value) && Number(step.value) <= 10000)
    && step.selector.length <= 500 && step.value.length <= 5000;
  let text: string, expectedOutcome: string | undefined;
  switch (step.action) {
    case 'click': text = `Click ${target}`; break;
    case 'fill': text = step.value === '' ? `Clear ${target}` : `Enter ${quote(step.value)} in ${target}`; break;
    case 'select': text = `Select the option with value ${quote(step.value)} in ${target}`; break;
    case 'check': text = `Check ${target}`; break;
    case 'uncheck': text = `Uncheck ${target}`; break;
    case 'reload': text = 'Reload the page'; break;
    case 'assertText':
      text = step.value.trim() ? targetLabel ? `Check that ${target} displays text containing ${quote(step.value)}` : `Check for visible text containing ${quote(step.value)}` : 'Choose the text that should be visible';
      if (complete) expectedOutcome = targetLabel ? `${quote(targetLabel)} is visible and its text includes ${quote(step.value)}.` : `Visible text includes ${quote(step.value)}.`;
      break;
    case 'assertCount':
      text = complete ? `Check for exactly ${Number(step.value)} matching ${Number(step.value) === 1 ? 'element' : 'elements'}` : 'Choose the expected number of matching elements';
      if (complete) expectedOutcome = `The chosen target matches exactly ${Number(step.value)} ${Number(step.value) === 1 ? 'element' : 'elements'}.`;
      break;
    case 'assertValue':
      text = step.value === '' ? `Check that ${target} has an empty value` : `Check that the value of ${target} is exactly ${quote(step.value)}`;
      if (complete) expectedOutcome = `${targetLabel ? quote(targetLabel) : 'The selected field'} has ${step.value === '' ? 'an empty value' : `the exact value ${quote(step.value)}`}.`;
      break;
  }
  return { id: step.id, index: index + 1, action: step.action, kind, text, expectedOutcome, targetLabel, complete };
}

/** Summarizes the executable sequence, never the PRD or untested feature coverage.
 * Each card is one uninterrupted action sequence followed by its assertions.
 * A later action starts a new card; original steps and positions stay intact. */
export function summarizeUploadPlan(steps: readonly UploadStep[], elements: readonly PageElement[] = []): PlanSummary {
  const described = steps.map((step, index) => describeStep(step, index, elements));
  const groups: PlanStepSummary[][] = [];
  for (const step of described) {
    let group = groups[groups.length - 1];
    if (!group || step.kind === 'action' && group.some(item => item.kind === 'assertion')) { group = []; groups.push(group); }
    group.push(step);
  }
  const scenarios = groups.map(group => {
    const actions = group.filter(step => step.kind === 'action'), checks = group.filter(step => step.kind === 'assertion');
    const title = actions.length ? actions[0].text : checks.some(step => step.complete) ? 'Check the expected results' : 'Define an expected result';
    return { id: `scenario-${group[0].index}`, title, steps: group, actionSummaries: actions.map(step => step.text),
      expectedOutcomes: checks.flatMap(step => step.expectedOutcome ? [step.expectedOutcome] : []),
      assertionCount: checks.length, complete: group.every(step => step.complete) && checks.length > 0,
      startIndex: group[0].index, endIndex: group[group.length - 1].index };
  });
  const isEmpty = !steps.length || steps.every(step => step.action === 'assertText' && !step.value.trim() && !step.description.trim() && ['', 'body'].includes(step.selector.trim()));
  return { scenarios, stepCount: steps.length, assertionCount: described.filter(step => step.kind === 'assertion').length, isEmpty,
    hasIncompleteSteps: described.some(step => !step.complete),
    note: isEmpty ? 'No acceptance check has been defined yet.' : 'These cards describe the listed steps only. They do not establish coverage of every requirement or predict a passing result.' };
}
