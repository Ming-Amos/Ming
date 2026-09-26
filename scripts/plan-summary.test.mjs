import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { summarizeUploadPlan } from '../apps/web/src/upload/plan-summary.ts';

const step = (action, selector = '#field', value = '', id = action) => ({ id, action, selector, value, description: 'Description is not evidence of feature coverage.' });
const element = (selector, label, tag = 'input') => ({ selector, label, tag, type: '', text: '' });

test('The saved real Shipboard draft becomes three sequence-preserving scenarios', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('../docs/evidence/shipboard-doubao/2026-09-26T17-49-25-055Z-0db01f40/provider-draft.json', import.meta.url), 'utf8'));
  const original = structuredClone(fixture.draft.steps);
  const summary = summarizeUploadPlan(original, [element('#taskName', 'Task name'), element(original[1].selector, '+ Add task', 'button')]);
  assert.deepEqual(summary.scenarios.map(card => [card.startIndex, card.endIndex]), [[1, 4], [5, 7], [8, 9]]);
  assert.deepEqual(summary.scenarios.flatMap(card => card.steps.map(item => item.id)), original.map(item => item.id));
  assert.deepEqual(summary.scenarios.map(card => card.expectedOutcomes.length), [2, 1, 1]);
  assert.equal(summary.scenarios[2].title, 'Reload the page');
  assert.deepEqual(original, fixture.draft.steps);
});

test('All nine actions stay in the actual order with distinct semantics', () => {
  const steps = [step('click'), step('fill', '#field', ''), step('select', '#field', 'value-a'), step('check'), step('uncheck'), step('reload', ''), step('assertText', '#field', 'Saved'), step('assertCount', '.rows', '0'), step('assertValue', '#field', '')];
  const summary = summarizeUploadPlan(steps, [element('#field', 'Choice')]);
  const items = summary.scenarios.flatMap(card => card.steps);
  assert.deepEqual(items.map(item => item.action), steps.map(item => item.action));
  assert.match(items[1].text, /^Clear /);
  assert.match(items[2].text, /option with value/);
  assert.match(items[3].text, /^Check /); assert.match(items[4].text, /^Uncheck /);
  assert.match(items[6].expectedOutcome, /is visible.*includes/);
  assert.equal(items[7].expectedOutcome, 'The chosen target matches exactly 0 elements.');
  assert.match(items[8].expectedOutcome, /empty value/);
});

test('Missing labels and inventory ID fallbacks never expose selectors or invented names', () => {
  const summary = summarizeUploadPlan([step('click', '#privateThing'), step('assertText', 'body > main:nth-of-type(1)', 'Done')], [element('#privateThing', 'privateThing')]);
  const display = summary.scenarios.flatMap(card => card.steps.map(item => item.text)).join(' ');
  assert.match(display, /selected item/); assert.doesNotMatch(display, /privateThing|nth-of-type|body >|Description is|target element/);
});

test('An empty plan and the untouched manual placeholder make no acceptance claims', () => {
  const empty = summarizeUploadPlan([]), placeholder = summarizeUploadPlan([{ ...step('assertText', 'body'), description: '' }]);
  assert.equal(empty.isEmpty, true); assert.equal(empty.scenarios.length, 0);
  assert.equal(placeholder.isEmpty, true); assert.equal(placeholder.hasIncompleteSteps, true);
  assert.equal(placeholder.scenarios[0].complete, false); assert.deepEqual(placeholder.scenarios[0].expectedOutcomes, []);
});

test('Exact-value whitespace is preserved and unchecked actions have no invented outcome', () => {
  const summary = summarizeUploadPlan([step('assertValue', '#field', ' a\nb '), step('click', '#button')]);
  assert.ok(summary.scenarios[0].expectedOutcomes[0].includes(JSON.stringify(' a\nb ')));
  assert.equal(summary.scenarios[1].complete, false); assert.deepEqual(summary.scenarios[1].expectedOutcomes, []);
  assert.match(summary.note, /do not establish coverage/);
});

test('Invalid assertion parameters remain visibly incomplete', () => {
  const summary = summarizeUploadPlan([step('assertCount', '.rows', '-1'), step('assertText', '', 'Ready')]);
  assert.equal(summary.hasIncompleteSteps, true); assert.deepEqual(summary.scenarios[0].expectedOutcomes, []);
});

test('Current output text is never misrepresented as its own field label', () => {
  const inventory = [{ ...element('#taskCount', '0 tasks', 'span'), text: '0 tasks' }];
  const summary = summarizeUploadPlan([step('assertText', '#taskCount', '0 tasks')], inventory);
  assert.equal(summary.scenarios[0].expectedOutcomes[0], 'Visible text includes "0 tasks".');
  assert.equal(summary.scenarios[0].steps[0].targetLabel, null);
});

test('Input and exact expected values longer than 140 characters remain fully visible', () => {
  const value = `  ${'long value '.repeat(20)}\nexact ending  `;
  const summary = summarizeUploadPlan([step('fill', '#field', value), step('assertValue', '#field', value), step('assertText', '#field', value)]);
  const items = summary.scenarios.flatMap(card => card.steps);
  for (const item of items) assert.ok(item.text.includes(JSON.stringify(value)));
  for (const outcome of summary.scenarios.flatMap(card => card.expectedOutcomes)) assert.ok(outcome.includes(JSON.stringify(value)));
});
