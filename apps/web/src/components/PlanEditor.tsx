import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CircleNotch,
  DownloadSimple,
  FloppyDisk,
  Info,
  Plus,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  AcceptanceCriteriaInfo,
  DraftRecord,
  PlanStepInfo,
  ProjectRecord,
  RequirementRecord,
} from "../types";
import { api, downloadText } from "../lib/api";
import Sheet from "./Sheet";

const ACTIONS = [
  ["navigate", "Open the project page"],
  ["fill", "Enter text"],
  ["click", "Click a button or link"],
  ["selectOption", "Select an option"],
  ["check", "Check a box"],
  ["uncheck", "Uncheck a box"],
  ["reload", "Reload the page"],
  ["assertVisible", "Text should be visible"],
  ["assertVisibleIn", "Text should appear in a region"],
  ["assertNotVisible", "Text should not be visible"],
  ["assertCount", "Element count should match"],
  ["assertValue", "Field value should match"],
  ["assertUrl", "Page URL should match"],
  ["assertInputEnabled", "Field should be enabled"],
  ["assertInputDisabled", "Field should be disabled"],
] as const;
const LOCATOR_ACTIONS = new Set([
  "fill",
  "click",
  "selectOption",
  "check",
  "uncheck",
  "assertVisibleIn",
  "assertCount",
  "assertValue",
  "assertInputEnabled",
  "assertInputDisabled",
]);
const VALUE_ACTIONS = new Set([
  "fill",
  "selectOption",
  "assertVisible",
  "assertVisibleIn",
  "assertNotVisible",
  "assertValue",
  "assertUrl",
]);
type EditablePlan = {
  title: string;
  description: string;
  criteria: AcceptanceCriteriaInfo[];
};
function newStep(type: string, id: string): PlanStepInfo {
  return {
    id,
    type,
    description: ACTIONS.find((a) => a[0] === type)?.[1] || type,
    ...(type === "navigate" ? { url: "{{TARGET_URL}}" } : {}),
    ...(LOCATOR_ACTIONS.has(type) ? { locator: "" } : {}),
    ...(VALUE_ACTIONS.has(type) ? { value: "" } : {}),
    ...(type === "assertCount" ? { expected: 0 } : {}),
  };
}
function newCriterion(id: string): AcceptanceCriteriaInfo {
  return {
    id,
    title: "",
    description: "",
    requirementRef: "",
    expectedBehavior: "",
    contextMode: "fresh",
    openQuestions: [],
    steps: [
      newStep("navigate", `${id}-S1`),
      newStep("assertVisible", `${id}-S2`),
    ],
  };
}

export default function PlanEditor({
  project,
  requirement,
  draft,
  onClose,
  onSaved,
  readOnly,
}: {
  project: ProjectRecord;
  requirement: RequirementRecord;
  draft: DraftRecord | null;
  onClose: () => void;
  onSaved: (draft: DraftRecord) => void;
  readOnly: boolean;
}) {
  const [plan, setPlan] = useState<EditablePlan>(() =>
    draft
      ? structuredClone({
          title: draft.plan.title,
          description: draft.plan.description,
          criteria: draft.plan.criteria,
        })
      : {
          title: `${project.name} · Acceptance plan`,
          description: "Check user actions and expected outcomes against the project requirements.",
          criteria: [newCriterion("AC-01")],
        },
  );
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState("");
  const criterion = plan.criteria[active];
  function updateCriterion(patch: Partial<AcceptanceCriteriaInfo>) {
    setPlan((p) => ({
      ...p,
      criteria: p.criteria.map((c, i) =>
        i === active ? { ...c, ...patch } : c,
      ),
    }));
  }
  function updateStep(index: number, patch: Partial<PlanStepInfo>) {
    updateCriterion({
      steps: (criterion.steps || []).map((step, i) =>
        i === index ? { ...step, ...patch } : step,
      ),
    });
  }
  function moveStep(index: number, offset: number) {
    const steps = [...(criterion.steps || [])];
    [steps[index], steps[index + offset]] = [
      steps[index + offset],
      steps[index],
    ];
    updateCriterion({ steps });
  }
  function addCriterion() {
    const used = new Set(plan.criteria.map((c) => c.id));
    let next = plan.criteria.length + 1;
    while (used.has(`AC-${String(next).padStart(2, "0")}`)) next++;
    const id = `AC-${String(next).padStart(2, "0")}`;
    setPlan((p) => ({ ...p, criteria: [...p.criteria, newCriterion(id)] }));
    setActive(plan.criteria.length);
  }
  function removeCriterion() {
    const id = criterion.id;
    setPlan((p) => ({
      ...p,
      criteria: p.criteria
        .filter((c) => c.id !== id)
        .map((c) =>
          c.dependsOn?.includes(id)
            ? {
                ...c,
                dependsOn: c.dependsOn.filter((value) => value !== id),
                contextMode: "fresh",
              }
            : c,
        ),
    }));
    setActive(Math.max(0, active - 1));
  }
  function validate(): string[] {
    const problems: string[] = [];
    if (!plan.title.trim()) problems.push("Give your acceptance plan a name.");
    plan.criteria.forEach((c, i) => {
      if (!c.title.trim()) problems.push(`Criterion ${i + 1} needs a name.`);
      if (!(c.steps || []).some((s) => s.type.startsWith("assert")))
        problems.push(`${c.id} needs at least one assertion to check the result of its actions.`);
      (c.steps || []).forEach((s, n) => {
        if (!s.description.trim())
          problems.push(`${c.id}, step ${n + 1}: add a description.`);
        if (LOCATOR_ACTIONS.has(s.type) && !s.locator?.trim())
          problems.push(`${c.id}, step ${n + 1}: specify a control or region.`);
        if (
          VALUE_ACTIONS.has(s.type) &&
          !["fill", "assertValue", "selectOption"].includes(s.type) &&
          !s.value?.trim()
        )
          problems.push(`${c.id}, step ${n + 1}: enter the expected content.`);
        if (
          s.type === "assertCount" &&
          (!Number.isInteger(s.expected) || Number(s.expected) < 0)
        )
          problems.push(`${c.id}: the element count must be a non-negative integer.`);
      });
    });
    return problems;
  }
  async function save() {
    const problems = validate();
    setErrors(problems);
    if (problems.length || busy || readOnly) return;
    setBusy(true);
    try {
      const body = {
        projectId: project.projectId,
        requirementId: requirement.requirementId,
        plan: {
          ...plan,
          criteria: plan.criteria.map((c) => ({
            ...c,
            description: c.description || c.expectedBehavior || c.title,
            steps: (c.steps || []).map((s, i) => ({
              ...s,
              id: `${c.id}-S${i + 1}`,
            })),
          })),
        },
      };
      const response = await api<{ draft: DraftRecord }>(
        draft ? `/api/drafts/${draft.draftId}/revise` : "/api/drafts/manual",
        body,
      );
      onSaved(response.draft);
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }
  function importPlan() {
    try {
      const parsed = JSON.parse(advanced) as EditablePlan;
      if (
        !parsed ||
        typeof parsed.title !== "string" ||
        typeof parsed.description !== "string" ||
        !Array.isArray(parsed.criteria) ||
        !parsed.criteria.length ||
        parsed.criteria.length > 20
      )
        throw new Error("Include a title, description, and 1–20 criteria.");
      const ids = new Set<string>();
      let stepCount = 0;
      parsed.criteria.forEach((c) => {
        if (
          !c ||
          typeof c.id !== "string" ||
          !/^[A-Za-z0-9_-]{1,80}$/.test(c.id) ||
          ids.has(c.id) ||
          typeof c.title !== "string" ||
          !Array.isArray(c.steps) ||
          !c.steps.length
        )
          throw new Error("Each criterion needs a unique id, title, and a list of steps.");
        ids.add(c.id);
        for (const field of [
          "description",
          "requirementRef",
          "expectedBehavior",
          "prerequisites",
        ] as const)
          if (c[field] !== undefined && typeof c[field] !== "string")
            throw new Error("Criterion descriptions and requirement references must be text.");
        for (const list of [c.openQuestions, c.dependsOn])
          if (
            list !== undefined &&
            (!Array.isArray(list) ||
              list.some((value) => typeof value !== "string"))
          )
            throw new Error("Open questions and dependencies must be lists of text.");
        if (
          c.contextMode !== undefined &&
          !["fresh", "inherit"].includes(c.contextMode)
        )
          throw new Error("Page context must be fresh or inherit.");
        c.steps.forEach((s, i) => {
          if (
            !s ||
            typeof s.type !== "string" ||
            typeof s.description !== "string" ||
            !ACTIONS.some((a) => a[0] === s.type)
          )
            throw new Error("Invalid step type or description.");
          for (const field of ["url", "locator", "value"] as const)
            if (s[field] !== undefined && typeof s[field] !== "string")
              throw new Error("URLs, controls, and input values must be text.");
          if (
            s.expected !== undefined &&
            typeof s.expected !== "string" &&
            typeof s.expected !== "number"
          )
            throw new Error("Expected values must be text or numbers.");
          s.id = `${c.id}-S${i + 1}`;
          stepCount++;
        });
      });
      if (stepCount > 120)
        throw new Error("A plan can contain up to 120 steps. Split larger plans by feature.");
      setPlan({ title: parsed.title, description: parsed.description, criteria: parsed.criteria });
      setActive(0);
      setErrors([]);
      setAdvanced("");
    } catch (e) {
      setErrors([`Import failed: ${(e as Error).message}`]);
    }
  }
  return (
    <Sheet
      title={draft ? "Edit plan · New revision" : "Create acceptance plan"}
      wide
      onClose={onClose}
      locked={busy}
    >
      <p className="sheet-lead">
        Turn requirements into observable outcomes. Include at least one assertion per criterion. Saving a revision preserves earlier plans and their evidence.
      </p>
      <details className="plan-requirement">
        <summary>
          <FileSourceIcon />
          Source requirements · v{requirement.version}
        </summary>
        <pre>{requirement.text}</pre>
      </details>
      <label className="field">
        Plan name
        <input
          value={plan.title}
          disabled={busy || readOnly}
          onChange={(e) => setPlan((p) => ({ ...p, title: e.target.value }))}
        />
      </label>
      <div className="plan-editor-layout">
        <div className="plan-editor-nav" aria-label="Acceptance criteria">
          {plan.criteria.map((c, i) => (
            <button
              key={c.id}
              className={active === i ? "active" : ""}
              onClick={() => setActive(i)}
            >
              <span>{c.id}</span>
              <strong>{c.title || "Untitled criterion"}</strong>
            </button>
          ))}
          {!readOnly && (
            <button
              className="add-criterion"
              disabled={busy || plan.criteria.length >= 20}
              onClick={addCriterion}
            >
              <Plus size={17} />
              Add criterion
            </button>
          )}
        </div>
        {criterion && (
          <div className="criterion-editor">
            <div className="criterion-editor-heading">
              <strong>{criterion.id}</strong>
              {!readOnly && (
                <button
                  className="subtle-button danger-text"
                  disabled={busy || plan.criteria.length <= 1}
                  onClick={removeCriterion}
                >
                  <Trash size={15} />
                  Remove criterion
                </button>
              )}
            </div>
            <label className="field">
              Criterion name
              <input
                value={criterion.title}
                disabled={busy || readOnly}
                onChange={(e) => updateCriterion({ title: e.target.value })}
                placeholder="e.g. A new task remains after reloading"
              />
            </label>
            <label className="field">
              Expected behavior
              <textarea
                aria-label="Expected behavior"
                rows={2}
                value={
                  criterion.expectedBehavior || criterion.description || ""
                }
                disabled={busy || readOnly}
                onChange={(e) =>
                  updateCriterion({
                    expectedBehavior: e.target.value,
                    description: e.target.value,
                  })
                }
                placeholder="What should the user see after completing this action?"
              />
            </label>
            <label className="field">
              Requirement reference
              <input
                value={criterion.requirementRef || ""}
                disabled={busy || readOnly}
                onChange={(e) =>
                  updateCriterion({ requirementRef: e.target.value })
                }
                placeholder="Quote the relevant sentence from your PRD"
              />
            </label>
            <div className="field-pair">
              <label className="field">
                Depends on
                <select
                  aria-label="Depends on"
                  value={criterion.dependsOn?.[0] || ""}
                  disabled={busy || readOnly || active === 0}
                  onChange={(e) =>
                    updateCriterion({
                      dependsOn: e.target.value ? [e.target.value] : [],
                      contextMode: "fresh",
                    })
                  }
                >
                  <option value="">Run independently</option>
                  {plan.criteria.slice(0, active).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.title || "Untitled"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Browser context
                <select
                  aria-label="Browser context"
                  value={criterion.contextMode || "fresh"}
                  disabled={busy || readOnly}
                  onChange={(e) =>
                    updateCriterion({
                      contextMode: e.target.value as "fresh" | "inherit",
                      ...(e.target.value === "inherit" && active > 0
                        ? { dependsOn: [plan.criteria[active - 1].id] }
                        : {}),
                    })
                  }
                >
                  <option value="fresh">Start fresh</option>
                  <option value="inherit" disabled={active === 0}>
                    Continue from the previous criterion
                  </option>
                </select>
              </label>
            </div>
            <h3 className="editor-section-title">Steps to run, in order</h3>
            <p className="field-help">
              Use a button or field label, or target an element with css=#save.
              For a unique value in each run, use {"{{UNIQUE_CONTENT}}"}.
            </p>
            <div className="editable-steps">
              {(criterion.steps || []).map((s, i) => (
                <div className="editable-step" key={s.id}>
                  <div className="editable-step-heading">
                    <span>Step {i + 1}</span>
                    <div>
                      <button
                        className="icon-button"
                        aria-label={`Move step up: ${i + 1}`}
                        disabled={busy || readOnly || i === 0}
                        onClick={() => moveStep(i, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Move step down: ${i + 1}`}
                        disabled={
                          busy ||
                          readOnly ||
                          i === (criterion.steps?.length || 0) - 1
                        }
                        onClick={() => moveStep(i, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Remove step: ${i + 1}`}
                        disabled={
                          busy || readOnly || criterion.steps?.length === 1
                        }
                        onClick={() =>
                          updateCriterion({
                            steps: criterion.steps?.filter((_, n) => n !== i),
                          })
                        }
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                  <label className="field">
                    Action
                    <select
                      aria-label="Action"
                      value={s.type}
                      disabled={busy || readOnly}
                      onChange={(e) => {
                        const steps = [...(criterion.steps || [])];
                        steps[i] = newStep(e.target.value, s.id);
                        updateCriterion({ steps });
                      }}
                    >
                      {ACTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {LOCATOR_ACTIONS.has(s.type) && (
                    <label className="field">
                      Control or region
                      <input
                        value={s.locator || ""}
                        disabled={busy || readOnly}
                        onChange={(e) =>
                          updateStep(i, { locator: e.target.value })
                        }
                        placeholder={
                          s.type === "assertVisibleIn" ||
                          s.type === "assertCount"
                            ? "css=#task-list"
                            : "e.g. Add task or css=#add"
                        }
                      />
                    </label>
                  )}
                  {VALUE_ACTIONS.has(s.type) && (
                    <label className="field">
                      {s.type === "fill"
                        ? "Enter text"
                        : s.type === "selectOption"
                          ? "Option value"
                          : s.type === "assertUrl"
                            ? "Expected URL or path"
                            : "Expected content"}
                      <input
                        value={s.value || ""}
                        disabled={busy || readOnly}
                        onChange={(e) =>
                          updateStep(i, { value: e.target.value })
                        }
                        placeholder={
                          s.type === "assertUrl"
                            ? "/settings"
                            : "e.g. Task saved"
                        }
                      />
                    </label>
                  )}
                  {s.type === "assertCount" && (
                    <label className="field">
                      Expected element count
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={s.expected ?? 0}
                        disabled={busy || readOnly}
                        onChange={(e) =>
                          updateStep(i, {
                            expected:
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  )}
                  {s.type === "assertValue" && (
                    <p className="field-help">Leave expected content blank to check that the field is empty.</p>
                  )}
                  {s.type === "selectOption" && (
                    <p className="field-help">Use the option's value. Leave it blank to select an option with an empty value.</p>
                  )}
                  {s.type === "navigate" && (
                    <p className="field-help">
                      Opens the test page registered for this project.
                    </p>
                  )}
                  <label className="field step-description-field">
                    Step description
                    <input
                      value={s.description}
                      disabled={busy || readOnly}
                      onChange={(e) =>
                        updateStep(i, { description: e.target.value })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            {!readOnly && (
              <button
                className="secondary-button full-width"
                disabled={busy || (criterion.steps?.length || 0) >= 30}
                onClick={() =>
                  updateCriterion({
                    steps: [
                      ...(criterion.steps || []),
                      newStep("click", `${criterion.id}-new-${Date.now()}`),
                    ],
                  })
                }
              >
                <Plus size={17} />
                Add step
              </button>
            )}
            <label className="field open-questions-field">
              Open questions (one per line)
              <textarea
                aria-label="Open questions (one per line)"
                rows={2}
                value={(criterion.openQuestions || []).join("\n")}
                disabled={busy || readOnly}
                onChange={(e) =>
                  updateCriterion({
                    openQuestions: e.target.value
                      .split("\n")
                      .filter((line) => line.trim()),
                  })
                }
                placeholder="You can save a draft with open questions, but resolve them before confirming the plan."
              />
            </label>
          </div>
        )}
      </div>
      {errors.length > 0 && (
        <div className="message error-message plan-errors" role="alert">
          <WarningCircle size={20} />
          <ul>
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {!readOnly && (
        <div className="editor-save-bar">
          <span>
            <Info size={16} />
            Manual editing uses no model calls
          </span>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? (
              <CircleNotch size={17} className="spin" />
            ) : (
              <FloppyDisk size={17} />
            )}
            {busy ? "Validating and saving…" : draft ? "Save revision" : "Save draft"}
          </button>
        </div>
      )}
      <details className="scope-note">
        <summary>Advanced: Import or export a plan</summary>
        <button
          className="secondary-button"
          onClick={() =>
            downloadText(
              "ming-acceptance-plan.json",
              JSON.stringify(plan, null, 2),
            )
          }
        >
          <DownloadSimple size={16} />
          Export JSON
        </button>
        {!readOnly && (
          <>
            <label className="field">
              Plan JSON
              <textarea
                aria-label="Plan JSON"
                rows={4}
                value={advanced}
                onChange={(e) => setAdvanced(e.target.value)}
                disabled={busy}
              />
            </label>
            <button
              className="secondary-button"
              disabled={busy || !advanced.trim()}
              onClick={importPlan}
            >
              Import into editor
            </button>
          </>
        )}
      </details>
    </Sheet>
  );
}

function FileSourceIcon() {
  return <Info size={16} />;
}
