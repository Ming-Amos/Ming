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
  ["navigate", "打开项目页面"],
  ["fill", "输入内容"],
  ["click", "点击按钮或链接"],
  ["selectOption", "选择下拉选项"],
  ["check", "勾选选项"],
  ["uncheck", "取消勾选"],
  ["reload", "刷新当前页面"],
  ["assertVisible", "页面应显示内容"],
  ["assertVisibleIn", "指定区域应显示内容"],
  ["assertNotVisible", "页面不应显示内容"],
  ["assertCount", "元素数量应为"],
  ["assertValue", "输入值应为"],
  ["assertUrl", "页面地址应为"],
  ["assertInputEnabled", "输入框应可用"],
  ["assertInputDisabled", "输入框应禁用"],
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
          title: `${project.name} · 功能验收`,
          description: "根据项目需求检查用户操作与预期结果。",
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
    if (!plan.title.trim()) problems.push("请为验收计划命名。");
    plan.criteria.forEach((c, i) => {
      if (!c.title.trim()) problems.push(`第 ${i + 1} 项验收条件需要名称。`);
      if (!(c.steps || []).some((s) => s.type.startsWith("assert")))
        problems.push(`${c.id} 至少需要一个「应当」检查，不能只有操作。`);
      (c.steps || []).forEach((s, n) => {
        if (!s.description.trim())
          problems.push(`${c.id} 的第 ${n + 1} 步需要操作说明。`);
        if (LOCATOR_ACTIONS.has(s.type) && !s.locator?.trim())
          problems.push(`${c.id} 的第 ${n + 1} 步需要指定控件或区域。`);
        if (VALUE_ACTIONS.has(s.type) && s.type !== "fill" && !s.value?.trim())
          problems.push(`${c.id} 的第 ${n + 1} 步需要填写预期内容。`);
        if (
          s.type === "assertCount" &&
          (!Number.isInteger(s.expected) || Number(s.expected) < 0)
        )
          problems.push(`${c.id} 的元素数量必须是非负整数。`);
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
        throw new Error("需要包含 title、description 和 1–20 项 criteria。");
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
          throw new Error("每项条件需要唯一的 id、title 和步骤列表。");
        ids.add(c.id);
        for (const field of [
          "description",
          "requirementRef",
          "expectedBehavior",
        ] as const)
          if (c[field] !== undefined && typeof c[field] !== "string")
            throw new Error("条件说明和需求引用必须是文本。");
        for (const list of [c.openQuestions, c.dependsOn, c.prerequisites])
          if (
            list !== undefined &&
            (!Array.isArray(list) ||
              list.some((value) => typeof value !== "string"))
          )
            throw new Error("待澄清问题、前置条件和依赖必须是文本列表。");
        if (
          c.contextMode !== undefined &&
          !["fresh", "inherit"].includes(c.contextMode)
        )
          throw new Error("页面上下文只能为 fresh 或 inherit。");
        c.steps.forEach((s, i) => {
          if (
            !s ||
            typeof s.type !== "string" ||
            typeof s.description !== "string" ||
            !ACTIONS.some((a) => a[0] === s.type)
          )
            throw new Error("步骤类型或说明无效。");
          for (const field of ["url", "locator", "value"] as const)
            if (s[field] !== undefined && typeof s[field] !== "string")
              throw new Error("地址、控件和输入值必须是文本。");
          if (
            s.expected !== undefined &&
            typeof s.expected !== "string" &&
            typeof s.expected !== "number"
          )
            throw new Error("预期值必须是文本或数字。");
          s.id = `${c.id}-S${i + 1}`;
          stepCount++;
        });
      });
      if (stepCount > 120)
        throw new Error("一个计划最多 120 个步骤，请拆分为多个功能验收。");
      setPlan(parsed);
      setActive(0);
      setErrors([]);
      setAdvanced("");
    } catch (e) {
      setErrors([`导入失败：${(e as Error).message}`]);
    }
  }
  return (
    <Sheet
      title={draft ? "修改验收标准 · 保存为新版本" : "编写验收标准"}
      wide
      onClose={onClose}
      locked={busy}
    >
      <p className="sheet-lead">
        从需求中定义可见的结果。每项条件至少包含一个检查；修改不会覆盖旧版本及其运行证据。
      </p>
      <details className="plan-requirement">
        <summary>
          <FileSourceIcon />
          需求依据 · v{requirement.version}
        </summary>
        <pre>{requirement.text}</pre>
      </details>
      <label className="field">
        验收计划名称
        <input
          value={plan.title}
          disabled={busy || readOnly}
          onChange={(e) => setPlan((p) => ({ ...p, title: e.target.value }))}
        />
      </label>
      <div className="plan-editor-layout">
        <div className="plan-editor-nav" aria-label="验收条件列表">
          {plan.criteria.map((c, i) => (
            <button
              key={c.id}
              className={active === i ? "active" : ""}
              onClick={() => setActive(i)}
            >
              <span>{c.id}</span>
              <strong>{c.title || "未命名条件"}</strong>
            </button>
          ))}
          {!readOnly && (
            <button
              className="add-criterion"
              disabled={busy || plan.criteria.length >= 20}
              onClick={addCriterion}
            >
              <Plus size={17} />
              添加验收条件
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
                  删除条件
                </button>
              )}
            </div>
            <label className="field">
              条件名称
              <input
                value={criterion.title}
                disabled={busy || readOnly}
                onChange={(e) => updateCriterion({ title: e.target.value })}
                placeholder="例如：刷新后仍能看到刚添加的任务"
              />
            </label>
            <label className="field">
              预期行为
              <textarea
                aria-label="预期行为"
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
                placeholder="用户完成操作后，页面上应该出现什么？"
              />
            </label>
            <label className="field">
              对应的需求原文
              <input
                value={criterion.requirementRef || ""}
                disabled={busy || readOnly}
                onChange={(e) =>
                  updateCriterion({ requirementRef: e.target.value })
                }
                placeholder="从 PRD 引用相关语句，便于核对"
              />
            </label>
            <div className="field-pair">
              <label className="field">
                前置验收条件
                <select
                  aria-label="前置验收条件"
                  value={criterion.dependsOn?.[0] || ""}
                  disabled={busy || readOnly || active === 0}
                  onChange={(e) =>
                    updateCriterion({
                      dependsOn: e.target.value ? [e.target.value] : [],
                      contextMode: "fresh",
                    })
                  }
                >
                  <option value="">独立执行</option>
                  {plan.criteria.slice(0, active).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.title || "未命名"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                页面上下文
                <select
                  aria-label="页面上下文"
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
                  <option value="fresh">独立浏览器</option>
                  <option value="inherit" disabled={active === 0}>
                    接续前一项页面
                  </option>
                </select>
              </label>
            </div>
            <h3 className="editor-section-title">按顺序执行这些步骤</h3>
            <p className="field-help">
              控件可以填写页面上的按钮/字段名称；也可用 css=#save
              精确定位。每轮唯一测试值可填写 {"{{UNIQUE_CONTENT}}"}。
            </p>
            <div className="editable-steps">
              {(criterion.steps || []).map((s, i) => (
                <div className="editable-step" key={s.id}>
                  <div className="editable-step-heading">
                    <span>步骤 {i + 1}</span>
                    <div>
                      <button
                        className="icon-button"
                        aria-label={`上移步骤 ${i + 1}`}
                        disabled={busy || readOnly || i === 0}
                        onClick={() => moveStep(i, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`下移步骤 ${i + 1}`}
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
                        aria-label={`删除步骤 ${i + 1}`}
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
                    操作类型
                    <select
                      aria-label="操作类型"
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
                      控件或区域
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
                            : "例如：添加任务 或 css=#add"
                        }
                      />
                    </label>
                  )}
                  {VALUE_ACTIONS.has(s.type) && (
                    <label className="field">
                      {s.type === "fill"
                        ? "输入内容"
                        : s.type === "selectOption"
                          ? "选项值"
                          : s.type === "assertUrl"
                            ? "预期地址或路径"
                            : "预期内容"}
                      <input
                        value={s.value || ""}
                        disabled={busy || readOnly}
                        onChange={(e) =>
                          updateStep(i, { value: e.target.value })
                        }
                        placeholder={
                          s.type === "assertUrl"
                            ? "/settings"
                            : "例如：任务已保存"
                        }
                      />
                    </label>
                  )}
                  {s.type === "assertCount" && (
                    <label className="field">
                      预期元素数量
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
                  {s.type === "navigate" && (
                    <p className="field-help">
                      打开当前项目登记的测试页面，不会跳转到其他项目。
                    </p>
                  )}
                  <label className="field step-description-field">
                    步骤说明
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
                添加步骤
              </button>
            )}
            <label className="field open-questions-field">
              尚未明确的问题（每行一个）
              <textarea
                aria-label="尚未明确的问题（每行一个）"
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
                placeholder="存在待澄清问题时，草稿可以保存，但不能确认执行。"
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
            手动编辑不会调用模型
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
            {busy ? "校验并保存中…" : draft ? "保存为新版本" : "保存验收草稿"}
          </button>
        </div>
      )}
      <details className="scope-note">
        <summary>高级：导入或导出计划</summary>
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
          导出 JSON
        </button>
        {!readOnly && (
          <>
            <label className="field">
              计划 JSON
              <textarea
                aria-label="计划 JSON"
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
              导入到编辑器
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
