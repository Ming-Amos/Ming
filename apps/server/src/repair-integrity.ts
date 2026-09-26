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
  if (!planFingerprintMatch) blockers.push("The plan content, version, or immutable snapshot does not match. The repair cannot be verified.");
  const baselineRunnerFingerprint = baseline.runnerFingerprint ?? "unknown";
  const rerunRunnerFingerprint = rerun.runnerFingerprint ?? "unknown";
  const runnerFingerprintKnown = known(baselineRunnerFingerprint) && known(rerunRunnerFingerprint);
  const runnerFingerprintMatch = runnerFingerprintKnown && baselineRunnerFingerprint === rerunRunnerFingerprint &&
    task.baselineRunnerFingerprint === baselineRunnerFingerprint;
  if (!runnerFingerprintMatch) blockers.push("Runner fingerprints are unknown or different. Record a new baseline with the same runner.");
  const targetIdentityMatch = baseline.targetVariant === task.targetVariant && rerun.targetVariant === task.targetVariant &&
    baseline.targetUrl === task.targetUrl && rerun.targetUrl === task.targetUrl;
  if (!targetIdentityMatch) blockers.push("The target identity or URL has changed.");
  const sourceFingerprintKnown = known(baseline.targetFingerprint) && known(rerun.targetFingerprint) &&
    task.baselineTargetFingerprint === baseline.targetFingerprint && task.repairedTargetFingerprint === rerun.targetFingerprint &&
    baseline.sourceBinding === "self-contained-html-snapshot" && rerun.sourceBinding === "self-contained-html-snapshot" &&
    baseline.sourceChangedDuringRun === false && rerun.sourceChangedDuringRun === false;
  if (!sourceFingerprintKnown) blockers.push(baseline.sourceBinding === "live-url-observed" || rerun.sourceBinding === "live-url-observed"
    ? "A live URL is not bound to an executed source snapshot. Acceptance results are available, but a file fingerprint alone cannot verify the source of a repair."
    : "The source snapshot is missing, inconsistent, or changed during execution.");
  const targetFingerprintChanged = known(baseline.targetFingerprint) && known(rerun.targetFingerprint) &&
    baseline.targetFingerprint !== rerun.targetFingerprint;
  if (!targetFingerprintChanged) blockers.push("The target source has not changed. A passing rerun alone does not prove a code repair.");
  const linksMatch = baseline.runId === task.baselineRunId && rerun.runId === task.rerunId &&
    baseline.confirmationId === task.confirmationId && rerun.confirmationId === task.confirmationId &&
    baseline.requirementId === task.requirementId && rerun.requirementId === task.requirementId;
  if (!linksMatch) {
    blockers.push("The run, confirmation, or requirement record links do not match.");
  }
  const expected = plan?.criteria ?? [];
  const complete = (run: RunRecord) => expected.length > 0 && run.criteria.length === expected.length &&
    expected.every((criterion, i) => run.criteria[i]?.criteriaId === criterion.id &&
      run.criteria[i].steps.length === criterion.steps.length &&
      criterion.steps.every((step, j) => run.criteria[i].steps[j]?.stepId === step.id));
  if (!complete(baseline) || !complete(rerun)) blockers.push("The run is missing criteria or steps. Incomplete acceptance results cannot be compared.");
  const assertionFailure = baseline.criteria.some(c => c.status === "failed" && c.steps.some(s =>
    s.status === "failed" && expected.find(p => p.id === c.criteriaId)?.steps.some(p => p.id === s.stepId && p.type.startsWith("assert"))));
  if (!assertionFailure || baseline.status !== "failed" || baseline.fatalError) {
    blockers.push("The baseline has no complete business assertion failure. Recovery from an infrastructure error does not count as a feature repair.");
  }
  const rerunFullyPassed = rerun.status === "passed" && !rerun.fatalError && Boolean(rerun.finishedAt) &&
    rerun.criteria.every(c => c.status === "passed" && c.steps.every(s => s.status === "passed"));
  if (!rerunFullyPassed) {
    blockers.push("The rerun has not fully passed or contains execution errors.");
  }
  const failedIds = new Set(baseline.criteria.filter(c => c.status !== "passed").map(c => c.criteriaId));
  const passedIds = new Set(rerun.criteria.filter(c => c.status === "passed").map(c => c.criteriaId));
  const notPassedIds = new Set(rerun.criteria.filter(c => c.status !== "passed").map(c => c.criteriaId));
  const acceptancePassed = planFingerprintMatch && runnerFingerprintMatch && targetIdentityMatch && linksMatch &&
    complete(baseline) && complete(rerun) && rerunFullyPassed;
  return {
    taskId: task.taskId, baselineRunId: task.baselineRunId, rerunId: task.rerunId ?? rerun.runId,
    planFingerprintMatch, runnerFingerprintMatch, runnerFingerprintKnown, targetIdentityMatch,
    targetFingerprintChanged, sourceFingerprintKnown,
    baselineTargetFingerprint: baseline.targetFingerprint, repairedTargetFingerprint: rerun.targetFingerprint,
    baselineRunnerFingerprint, rerunRunnerFingerprint,
    previouslyFailedNowPassed: [...failedIds].filter(id => passedIds.has(id)),
    previouslyFailedStillFailing: [...failedIds].filter(id => !passedIds.has(id)),
    newFailures: [...notPassedIds].filter(id => !failedIds.has(id)),
    acceptancePassed, verifiedRepair: blockers.length === 0, blockers,
  };
}
