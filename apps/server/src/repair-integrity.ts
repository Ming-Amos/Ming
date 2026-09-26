import { AcceptancePlan, RepairComparison, RepairTaskRecord, RunRecord } from "@ming/contracts";
import { computeFingerprint } from "@ming/runner";

export function planIntegrity(plan: AcceptancePlan, fingerprint: string): boolean {
  return Boolean(plan && fingerprint && plan.fingerprint === fingerprint && computeFingerprint(plan) === fingerprint);
}

/** One predicate drives both task completion and the public comparison. */
export function compareRepair(task: RepairTaskRecord, baseline: RunRecord, rerun: RunRecord): RepairComparison {
  const blockers: string[] = [];
  const plan = task.planSnapshot;
  const known = (value: string | undefined): value is string => Boolean(value && value !== "unknown");
  const planFingerprintMatch = planIntegrity(plan, task.planFingerprint) &&
    baseline.planFingerprint === task.planFingerprint && rerun.planFingerprint === task.planFingerprint &&
    baseline.planId === task.planId && rerun.planId === task.planId && plan.planId === task.planId &&
    baseline.planVersion === task.planVersion && rerun.planVersion === task.planVersion && plan.version === task.planVersion &&
    Boolean(baseline.planSnapshot && planIntegrity(baseline.planSnapshot, task.planFingerprint)) &&
    Boolean(rerun.planSnapshot && planIntegrity(rerun.planSnapshot, task.planFingerprint));
  if (!planFingerprintMatch) blockers.push("计划内容、版本或不可变快照不一致，无法验证修复。");
  const baselineRunnerFingerprint = baseline.runnerFingerprint ?? "unknown";
  const rerunRunnerFingerprint = rerun.runnerFingerprint ?? "unknown";
  const runnerFingerprintKnown = known(baselineRunnerFingerprint) && known(rerunRunnerFingerprint);
  const runnerFingerprintMatch = runnerFingerprintKnown && baselineRunnerFingerprint === rerunRunnerFingerprint &&
    task.baselineRunnerFingerprint === baselineRunnerFingerprint;
  if (!runnerFingerprintMatch) blockers.push("执行器指纹未知或不同，需要使用同一执行器重新获取基准。");
  const targetIdentityMatch = baseline.targetVariant === task.targetVariant && rerun.targetVariant === task.targetVariant &&
    baseline.targetUrl === task.targetUrl && rerun.targetUrl === task.targetUrl;
  if (!targetIdentityMatch) blockers.push("目标身份或地址发生变化。");
  const sourceFingerprintKnown = known(baseline.targetFingerprint) && known(rerun.targetFingerprint) &&
    task.baselineTargetFingerprint === baseline.targetFingerprint && task.repairedTargetFingerprint === rerun.targetFingerprint &&
    baseline.sourceBinding === "self-contained-html-snapshot" && rerun.sourceBinding === "self-contained-html-snapshot" &&
    baseline.sourceChangedDuringRun === false && rerun.sourceChangedDuringRun === false;
  if (!sourceFingerprintKnown) blockers.push("源码快照来源缺失、不一致或在运行过程中发生变化。");
  const targetFingerprintChanged = known(baseline.targetFingerprint) && known(rerun.targetFingerprint) &&
    baseline.targetFingerprint !== rerun.targetFingerprint;
  if (!targetFingerprintChanged) blockers.push("目标源码未发生变化，重跑通过也不能证明代码已修复。");
  if (baseline.runId !== task.baselineRunId || rerun.runId !== task.rerunId ||
      baseline.confirmationId !== task.confirmationId || rerun.confirmationId !== task.confirmationId ||
      baseline.requirementId !== task.requirementId || rerun.requirementId !== task.requirementId) {
    blockers.push("运行、确认或需求记录的关联不一致。");
  }
  const expected = plan?.criteria ?? [];
  const complete = (run: RunRecord) => expected.length > 0 && run.criteria.length === expected.length &&
    expected.every((criterion, i) => run.criteria[i]?.criteriaId === criterion.id &&
      run.criteria[i].steps.length === criterion.steps.length &&
      criterion.steps.every((step, j) => run.criteria[i].steps[j]?.stepId === step.id));
  if (!complete(baseline) || !complete(rerun)) blockers.push("运行结果缺少标准或步骤，不能比较不完整的验收结果。");
  const assertionFailure = baseline.criteria.some(c => c.status === "failed" && c.steps.some(s =>
    s.status === "failed" && expected.find(p => p.id === c.criteriaId)?.steps.some(p => p.id === s.stepId && p.type.startsWith("assert"))));
  if (!assertionFailure || baseline.status !== "failed" || baseline.fatalError) {
    blockers.push("基准没有完整的业务断言失败；基础设施错误恢复不算功能修复。");
  }
  if (rerun.status !== "passed" || rerun.fatalError || !rerun.finishedAt ||
      !rerun.criteria.every(c => c.status === "passed" && c.steps.every(s => s.status === "passed"))) {
    blockers.push("重跑尚未全部通过，或存在执行错误。");
  }
  const failedIds = new Set(baseline.criteria.filter(c => c.status !== "passed").map(c => c.criteriaId));
  const passedIds = new Set(rerun.criteria.filter(c => c.status === "passed").map(c => c.criteriaId));
  const notPassedIds = new Set(rerun.criteria.filter(c => c.status !== "passed").map(c => c.criteriaId));
  return {
    taskId: task.taskId, baselineRunId: task.baselineRunId, rerunId: task.rerunId ?? rerun.runId,
    planFingerprintMatch, runnerFingerprintMatch, runnerFingerprintKnown, targetIdentityMatch,
    targetFingerprintChanged, sourceFingerprintKnown,
    baselineTargetFingerprint: baseline.targetFingerprint, repairedTargetFingerprint: rerun.targetFingerprint,
    baselineRunnerFingerprint, rerunRunnerFingerprint,
    previouslyFailedNowPassed: [...failedIds].filter(id => passedIds.has(id)),
    previouslyFailedStillFailing: [...failedIds].filter(id => !passedIds.has(id)),
    newFailures: [...notPassedIds].filter(id => !failedIds.has(id)),
    verifiedRepair: blockers.length === 0, blockers,
  };
}
