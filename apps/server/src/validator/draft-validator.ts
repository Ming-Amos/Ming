/**
 * Draft plan validator.
 * Reused at:
 *   - generation time (before saving a DraftRecord)
 *   - run boundary (before executing a confirmed plan)
 *
 * Extends the runner's structural validation with Stage-B-specific checks:
 *   - assertCount expected must be a non-negative integer (no coercion)
 *   - no unknown step fields
 *   - at least one assertion per criterion
 *   - no unresolved template variables
 *   - navigation target policy (only TARGET_URL allowed)
 *   - no unknown actions (enforced via runner ALLOWED_STEP_TYPES)
 *
 * Returns [] on success, or an array of human-readable error strings.
 */

import { PlanRunner, validateTemplateVars, computeFingerprint } from "@ming/runner";
import type { AcceptancePlan } from "@ming/contracts";

/**
 * Validate a plan fully.
 * Returns empty array if valid; array of error messages otherwise.
 */
export function validateDraftPlan(plan: unknown): string[] {
  const errors: string[] = [];

  // Guard: plan must be a non-null object before we touch anything on it.
  // Fix 2: be total over arbitrary JSON — structural checks first.
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    errors.push("Invalid plan: input must be an object");
    return errors;
  }

  // Cast to AcceptancePlan only after basic guard passes.
  const p = plan as AcceptancePlan;

  // 1. Structural validation (replicated from runner, collects all errors)
  try {
    validateStructure(p, errors);
  } catch (err: unknown) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  // Abort semantic checks if structural errors would cause null-deref
  if (errors.length > 0) return errors;

  // 2. Template variable check
  try {
    const varErrors = validateTemplateVars(p);
    errors.push(...varErrors);
  } catch (err: unknown) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  // 3. Navigation target policy: navigate steps URL must equal {{TARGET_URL}} exactly.
  // Fix 1: no partial match — any URL that is not exactly "{{TARGET_URL}}" is rejected.
  for (const c of p.criteria ?? []) {
    if (!c || !Array.isArray(c.steps)) continue;
    for (const s of c.steps) {
      if (!s) continue;
      if (s.type === "navigate" && s.url !== undefined) {
        if (s.url !== "{{TARGET_URL}}") {
          errors.push(
            `Step "${s.id}" (navigate) URL "${s.url}" is not {{TARGET_URL}}; ` +
            `navigate steps may only use {{TARGET_URL}}`
          );
        }
      }
    }
  }

  return errors;
}

// ── Structural validation (mirrors runner validatePlan logic) ─────

const ALLOWED_STEP_TYPES = new Set([
  "navigate", "fill", "click", "reload",
  "assertVisible", "assertVisibleIn", "assertNotVisible",
  "assertCount", "assertInputEnabled", "assertInputDisabled",
  "selectOption", "check", "uncheck", "assertValue", "assertUrl",
]);

const REQUIRED_FIELDS: Record<string, string[]> = {
  navigate: ["url"],
  fill: ["locator", "value"],
  click: ["locator"],
  reload: [],
  assertVisible: ["value"],
  assertVisibleIn: ["locator", "value"],
  assertNotVisible: ["value"],
  assertCount: ["locator"],
  assertInputEnabled: ["locator"],
  assertInputDisabled: ["locator"],
  selectOption: ["locator", "value"],
  check: ["locator"],
  uncheck: ["locator"],
  assertValue: ["locator", "value"],
  assertUrl: ["value"],
};

const KNOWN_STEP_KEYS = new Set([
  "id", "type", "locator", "value", "url", "expected", "description",
]);

const ASSERTION_TYPES = new Set([
  "assertVisible", "assertVisibleIn", "assertNotVisible",
  "assertCount", "assertInputEnabled", "assertInputDisabled",
  "assertValue", "assertUrl",
]);

function validateStructure(plan: AcceptancePlan, errors: string[]): void {
  if (!plan.planId || typeof plan.planId !== "string") {
    errors.push("Invalid plan: planId is required");
    return; // can't continue without planId
  }
  if (!Array.isArray(plan.criteria) || plan.criteria.length === 0) {
    errors.push("Invalid plan: criteria must be a non-empty array");
    return;
  }
  if (plan.criteria.length > 20) { errors.push("A plan supports up to 20 acceptance criteria"); return; }
  if (plan.criteria.reduce((count, c) => count + (Array.isArray(c?.steps) ? c.steps.length : 0), 0) > 120) { errors.push("A plan supports up to 120 steps"); return; }
  if (!["fixture", "generated", "manual"].includes(plan.source)) errors.push("Plan source must be fixture, generated, or manual");
  if (typeof plan.title !== "string" || !plan.title.trim() || plan.title.length > 200) errors.push("The plan title must contain 1–200 characters");
  if (typeof plan.description !== "string" || plan.description.length > 4000) errors.push("The plan description must be text with at most 4,000 characters");

  const seenCriteriaIds = new Set<string>();

  for (const c of plan.criteria) {
    if (!c || typeof c !== "object") { errors.push("Each acceptance criterion must be an object"); continue; }
    if (typeof c.title !== "string" || !c.title.trim() || c.title.length > 200) errors.push("A criterion title must contain 1–200 characters");
    if (typeof c.description !== "string" || c.description.length > 4000) errors.push("A criterion description must be text with at most 4,000 characters");
    for (const field of ["requirementRef", "expectedBehavior", "prerequisites"] as const) {
      if (c[field] !== undefined && (typeof c[field] !== "string" || c[field]!.length > 4000)) errors.push(`Criterion "${c.id}": ${field} must be text with at most 4,000 characters`);
    }
    if (c.contextMode !== undefined && !["fresh", "inherit"].includes(c.contextMode)) errors.push(`Criterion "${c.id}": contextMode must be fresh or inherit`);
    if (c.dependsOn !== undefined && (!Array.isArray(c.dependsOn) || c.dependsOn.some(d => typeof d !== "string"))) errors.push(`Criterion "${c.id}": dependsOn must be an array of strings`);
    if (!c.id || typeof c.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(c.id)) {
      errors.push("A criterion is missing a valid ID");
      continue;
    }
    if (seenCriteriaIds.has(c.id)) {
      errors.push(`Duplicate criterion ID: "${c.id}"`);
      continue;
    }
    seenCriteriaIds.add(c.id);

    if (!Array.isArray(c.steps) || c.steps.length === 0) {
      errors.push(`Criterion "${c.id}": steps must be a non-empty array`);
      continue;
    }

    const seenStepIds = new Set<string>();
    let hasAssertion = false;

    for (const s of c.steps) {
      if (!s || typeof s !== "object") { errors.push(`Criterion "${c.id}" contains an invalid step`); continue; }
      if (typeof s.description !== "string" || s.description.length > 1000) errors.push(`Criterion "${c.id}": step descriptions must be text with at most 1,000 characters`);
      if (!s.id || typeof s.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(s.id)) {
        errors.push(`Criterion "${c.id}" contains a step without a valid ID`);
        continue;
      }
      if (seenStepIds.has(s.id)) {
        errors.push(`Duplicate step ID "${s.id}" in criterion "${c.id}"`);
        continue;
      }
      seenStepIds.add(s.id);

      if (!ALLOWED_STEP_TYPES.has(s.type)) {
        errors.push(`Step "${s.id}" uses unsupported type "${s.type}"; execution refused`);
        continue;
      }

      for (const field of REQUIRED_FIELDS[s.type] ?? []) {
        const val = (s as unknown as Record<string, unknown>)[field];
        if (val === undefined || val === null) {
          errors.push(`Step "${s.id}" (${s.type}) is missing required field "${field}"`);
        }
        else if (typeof val !== "string" || val.length > 4000 || (field !== "value" && !val.trim())) errors.push(`Step "${s.id}": ${field} must be a valid string with at most 4,000 characters`);
      }

      if (s.type === "assertCount") {
        const exp = s.expected;
        if (exp === undefined || exp === null) {
          errors.push(`Step "${s.id}" (assertCount) is missing expected`);
        } else if (typeof exp !== "number") {
          errors.push(
            `Step "${s.id}" (assertCount): expected must be a number, not a string (received: ${JSON.stringify(exp)})`
          );
        } else if (!Number.isInteger(exp) || exp < 0) {
          errors.push(`Step "${s.id}" (assertCount): expected must be a non-negative integer (received: ${exp})`);
        }
      }

      const sRec = s as unknown as Record<string, unknown>;
      if (sRec["script"] !== undefined || sRec["eval"] !== undefined) {
        errors.push(`Step "${s.id}" contains a prohibited script/eval field`);
      }

      for (const key of Object.keys(sRec)) {
        if (!KNOWN_STEP_KEYS.has(key)) {
          errors.push(`Step "${s.id}" contains unknown field "${key}"; execution refused`);
        }
      }

      if (ASSERTION_TYPES.has(s.type)) hasAssertion = true;
    }

    if (!hasAssertion) {
      errors.push(`Criterion "${c.id}" has no assertion steps and cannot verify expected behavior`);
    }
  }

  // Dependency references
  if (errors.length) return;
  const orderedIds: string[] = [];
  for (const c of plan.criteria) {
    for (const dep of c.dependsOn ?? []) {
      if (!orderedIds.includes(dep)) {
        errors.push(
          `Criterion "${c.id}" depends on "${dep}", which is missing or appears later; forward or circular dependencies are not supported`
        );
      }
    }
    orderedIds.push(c.id);
  }

  // Fix 3: openQuestions must be a bounded string array; any nonempty string is an open question
  for (const c of plan.criteria) {
    const oq = (c as unknown as Record<string, unknown>)["openQuestions"];
    if (oq !== undefined && oq !== null) {
      if (!Array.isArray(oq)) {
        errors.push(
          `Criterion "${c.id}": openQuestions must be an array of strings; received ${typeof oq}` +
          ` (value: ${JSON.stringify(oq)}). This draft will be marked as having unresolved questions`
        );
      } else {
        if (oq.length > 20) errors.push(`Criterion "${c.id}" supports up to 20 open questions`);
        for (const q of oq) {
          if (typeof q !== "string") {
            errors.push(`Criterion "${c.id}": openQuestions contains a non-string value: ${JSON.stringify(q)}`);
          }
          else if (q.length > 1000) errors.push(`Criterion "${c.id}": an open question must not exceed 1,000 characters`);
        }
      }
    }
  }

  // Fix 3: unknown fields on plan-level object
  const KNOWN_PLAN_KEYS = new Set([
    "planId", "version", "source", "title", "description", "fingerprint",
    "createdAt", "updatedAt", "criteria", "projectId", "requirementId",
    "originalRequirement", "transportProvenance",
  ]);
  for (const key of Object.keys(plan as unknown as Record<string, unknown>)) {
    if (!KNOWN_PLAN_KEYS.has(key)) {
      errors.push(`The plan contains unknown top-level field "${key}"; execution refused`);
    }
  }

  // Fix 3: unknown fields on criterion objects
  const KNOWN_CRITERION_KEYS = new Set([
    "id", "title", "description", "contextMode", "steps", "dependsOn", "openQuestions",
    "requirementRef", "expectedBehavior", "prerequisites",
  ]);
  for (const c of plan.criteria) {
    for (const key of Object.keys(c as unknown as Record<string, unknown>)) {
      if (!KNOWN_CRITERION_KEYS.has(key)) {
        errors.push(`Criterion "${c.id}" contains unknown field "${key}"; execution refused`);
      }
    }
  }

  // Fix 4: contextMode=inherit must depend on the IMMEDIATELY PRECEDING criterion
  for (let i = 0; i < plan.criteria.length; i++) {
    const c = plan.criteria[i];
    if (c.contextMode === "inherit") {
      if (i === 0) {
        errors.push(
          `Criterion "${c.id}" uses contextMode=inherit, but it is first and has no preceding context to inherit`
        );
      } else {
        const prev = plan.criteria[i - 1];
        const deps = c.dependsOn ?? [];
        if (!deps.includes(prev.id)) {
          errors.push(
            `Criterion "${c.id}" uses contextMode=inherit but does not depend on the immediately preceding criterion "${prev.id}"` +
            ` (dependsOn=${JSON.stringify(deps)}); context can only be inherited from the immediately preceding criterion`
          );
        }
      }
    }
  }
}

// Re-export computeFingerprint for use by callers
export { computeFingerprint };
