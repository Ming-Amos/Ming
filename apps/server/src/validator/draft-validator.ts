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
    errors.push("计划结构无效：输入不是对象");
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
            `步骤 "${s.id}" (navigate) URL "${s.url}" 不等于 {{TARGET_URL}}，` +
            `navigate 步骤只允许使用 {{TARGET_URL}}`
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
};

const KNOWN_STEP_KEYS = new Set([
  "id", "type", "locator", "value", "url", "expected", "description",
]);

const ASSERTION_TYPES = new Set([
  "assertVisible", "assertVisibleIn", "assertNotVisible",
  "assertCount", "assertInputEnabled", "assertInputDisabled",
]);

function validateStructure(plan: AcceptancePlan, errors: string[]): void {
  if (!plan.planId || typeof plan.planId !== "string") {
    errors.push("计划结构无效：planId 缺失");
    return; // can't continue without planId
  }
  if (!Array.isArray(plan.criteria) || plan.criteria.length === 0) {
    errors.push("计划结构无效：criteria 为空或不是数组");
    return;
  }

  const seenCriteriaIds = new Set<string>();

  for (const c of plan.criteria) {
    if (!c.id || typeof c.id !== "string") {
      errors.push("criteria 缺少有效 id");
      continue;
    }
    if (seenCriteriaIds.has(c.id)) {
      errors.push(`criteria id "${c.id}" 重复`);
      continue;
    }
    seenCriteriaIds.add(c.id);

    if (!Array.isArray(c.steps) || c.steps.length === 0) {
      errors.push(`criteria "${c.id}"：steps 为空或不是数组`);
      continue;
    }

    const seenStepIds = new Set<string>();
    let hasAssertion = false;

    for (const s of c.steps) {
      if (!s.id || typeof s.id !== "string") {
        errors.push(`criteria "${c.id}" 包含没有有效 id 的步骤`);
        continue;
      }
      if (seenStepIds.has(s.id)) {
        errors.push(`步骤 id "${s.id}" 在 criteria "${c.id}" 中重复`);
        continue;
      }
      seenStepIds.add(s.id);

      if (!ALLOWED_STEP_TYPES.has(s.type)) {
        errors.push(`步骤 "${s.id}" 类型 "${s.type}" 未注册，拒绝执行`);
        continue;
      }

      for (const field of REQUIRED_FIELDS[s.type] ?? []) {
        const val = (s as unknown as Record<string, unknown>)[field];
        if (val === undefined || val === null) {
          errors.push(`步骤 "${s.id}" (${s.type}) 缺少必填字段 "${field}"`);
        }
      }

      if (s.type === "assertCount") {
        const exp = s.expected;
        if (exp === undefined || exp === null) {
          errors.push(`步骤 "${s.id}" (assertCount) 缺少 expected 字段`);
        } else if (typeof exp !== "number") {
          errors.push(
            `步骤 "${s.id}" (assertCount) expected 必须是数字类型，不接受字符串（得到：${JSON.stringify(exp)}）`
          );
        } else if (!Number.isInteger(exp) || exp < 0) {
          errors.push(`步骤 "${s.id}" (assertCount) expected 必须是非负整数，得到：${exp}`);
        }
      }

      const sRec = s as unknown as Record<string, unknown>;
      if (sRec["script"] !== undefined || sRec["eval"] !== undefined) {
        errors.push(`步骤 "${s.id}" 包含禁止字段 script/eval`);
      }

      for (const key of Object.keys(sRec)) {
        if (!KNOWN_STEP_KEYS.has(key)) {
          errors.push(`步骤 "${s.id}" 包含未知字段 "${key}"，拒绝执行`);
        }
      }

      if (ASSERTION_TYPES.has(s.type)) hasAssertion = true;
    }

    if (!hasAssertion) {
      errors.push(`criteria "${c.id}" 没有任何断言步骤，无法验证预期行为`);
    }
  }

  // Dependency references
  const orderedIds: string[] = [];
  for (const c of plan.criteria) {
    for (const dep of c.dependsOn ?? []) {
      if (!orderedIds.includes(dep)) {
        errors.push(
          `criteria "${c.id}" 依赖 "${dep}"，但 "${dep}" 不存在或出现在后面（不支持后向/循环依赖）`
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
          `criteria "${c.id}" 的 openQuestions 必须是字符串数组，当前是 ${typeof oq}` +
          `（值：${JSON.stringify(oq)}），此草稿将被标记为含待确认问题`
        );
      } else {
        for (const q of oq) {
          if (typeof q !== "string") {
            errors.push(`criteria "${c.id}" 的 openQuestions 包含非字符串元素：${JSON.stringify(q)}`);
          }
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
      errors.push(`计划包含未知顶层字段 "${key}"，拒绝执行`);
    }
  }

  // Fix 3: unknown fields on criterion objects
  const KNOWN_CRITERION_KEYS = new Set([
    "id", "title", "description", "contextMode", "steps", "dependsOn", "openQuestions",
  ]);
  for (const c of plan.criteria) {
    for (const key of Object.keys(c as unknown as Record<string, unknown>)) {
      if (!KNOWN_CRITERION_KEYS.has(key)) {
        errors.push(`criteria "${c.id}" 包含未知字段 "${key}"，拒绝执行`);
      }
    }
  }

  // Fix 4: contextMode=inherit must depend on the IMMEDIATELY PRECEDING criterion
  for (let i = 0; i < plan.criteria.length; i++) {
    const c = plan.criteria[i];
    if (c.contextMode === "inherit") {
      if (i === 0) {
        errors.push(
          `criteria "${c.id}" 使用 contextMode=inherit，但它是第一个 criteria，没有前驱，无法继承上下文`
        );
      } else {
        const prev = plan.criteria[i - 1];
        const deps = c.dependsOn ?? [];
        if (!deps.includes(prev.id)) {
          errors.push(
            `criteria "${c.id}" 使用 contextMode=inherit，但没有依赖紧前一个 criteria "${prev.id}"` +
            `（dependsOn=${JSON.stringify(deps)}），inherit 只能从紧前项继承上下文`
          );
        }
      }
    }
  }
}

// Re-export computeFingerprint for use by callers
export { computeFingerprint };
