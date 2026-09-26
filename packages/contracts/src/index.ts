// ============================================================
// Ming 共享类型定义（Stage A + Stage B）
// ============================================================

export type StepType =
  | "navigate"
  | "fill"
  | "click"
  | "reload"
  | "selectOption"
  | "check"
  | "uncheck"
  | "assertValue"
  | "assertUrl"
  | "assertVisible"
  | "assertVisibleIn"    // text visible within a scoped CSS locator
  | "assertNotVisible"
  | "assertCount"
  | "assertInputEnabled"
  | "assertInputDisabled";

export interface PlanStep {
  id: string;
  type: StepType;
  /** 可访问名称或明确定位器 */
  locator?: string;
  /** 填入值 */
  value?: string;
  /** 页面 URL（navigate 专用） */
  url?: string;
  /** 断言期望值：数字(assertCount) / 字符串(assertVisible) */
  expected?: string | number;
  description: string;
}

export interface AcceptanceCriteria {
  id: string;
  title: string;
  description: string;
  /** 步骤列表 */
  steps: PlanStep[];
  /** 前置条件：依赖的 criteria id。依赖的标准必须已 passed 才执行本条。 */
  dependsOn?: string[];
  /**
   * 上下文继承模式：
   *   "fresh"  (默认) — 每次执行使用独立浏览器上下文
   *   "inherit" — 继续使用前一个依赖标准留下的浏览器上下文（共享页面状态）
   */
  contextMode?: "fresh" | "inherit";
  // ── Stage B 扩展字段 ────────────────────────────────────────
  /** 对应需求的原文引用/摘录，可供用户核对来源 */
  requirementRef?: string;
  /** 预期行为摘要（生成时填写） */
  expectedBehavior?: string;
  /** 前置条件说明 */
  prerequisites?: string;
  /** 待确认的问题或歧义（生成时填写，用户解答后可更新） */
  openQuestions?: string[];
}

export interface AcceptancePlan {
  planId: string;
  version: string;
  /** fixture = 固定开发验证夹具；generated = 模型生成（阶段B） */
  source: "fixture" | "generated" | "manual";
  /**
   * 传输来源标记（Stage B）：
   *   "live" = 真实模型 API 返回；"test" = 本地测试传输夹具
   *   fixture source 时此字段不适用
   */
  transportProvenance?: "live" | "test";
  title: string;
  description: string;
  criteria: AcceptanceCriteria[];
  /** 计划内容的 SHA256 指纹（不含本字段自身） */
  fingerprint: string;
  createdAt: string;
  // ── Stage B 扩展字段 ────────────────────────────────────────
  /** 关联的项目 ID */
  projectId?: string;
  /** 关联的需求记录 ID */
  requirementId?: string;
  /** 原始需求文本（保留，便于引用核对） */
  originalRequirement?: string;
}

export type StepStatus = "pending" | "running" | "passed" | "failed" | "error" | "skipped";
export type CriteriaStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "blocked"
  | "error"
  | "not_run";   // plan rejected or fatal error before execution reached this criterion
export type RunStatus = "pending" | "running" | "passed" | "failed" | "error";

export interface StepResult {
  stepId: string;
  description: string;
  status: StepStatus;
  /** 实际观察到的值（文本摘要等） */
  actual?: string;
  expected?: string | number;
  error?: string;
  screenshotPath?: string;
  durationMs?: number;
}

export interface CriteriaResult {
  criteriaId: string;
  title: string;
  status: CriteriaStatus;
  /** 若为 blocked / not_run，说明原因 */
  blockedReason?: string;
  steps: StepResult[];
}

export interface RunRecord {
  runId: string;
  planId: string;
  planVersion: string;
  planFingerprint: string;
  /** 目标版本：normal | buggy | 其他配置名 */
  targetVariant: string;
  /** 目标地址 */
  targetUrl: string;
  /** 目标源码/配置指纹 */
  targetFingerprint: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  criteria: CriteriaResult[];
  /** 致命错误（非业务失败），如目标不可达 */
  fatalError?: string;
  // ── Stage B 扩展字段 ────────────────────────────────────────
  /** 关联的确认记录 ID */
  confirmationId?: string;
  /** 关联的需求 ID */
  requirementId?: string;
  /** 测试实现版本指纹（runner 代码） */
  runnerFingerprint?: string;
  // ── Stage C 扩展字段 ────────────────────────────────────────
  /**
   * True when the target source file changed between run-start snapshot and run-end re-check.
   * A verified-repair claim is blocked when this is true.
   */
  sourceChangedDuringRun?: boolean;
  /** Exact execution plan retained for provenance and later repair. */
  planSnapshot?: AcceptancePlan;
  /** Only the captured document is frozen; this does not cover external assets/APIs. */
  sourceBinding?: "self-contained-html-snapshot" | "live-url-observed";
  terminationReason?: "cancelled" | "deadline" | "interrupted";
  diagnostics?: Array<{ kind: "console" | "pageerror" | "network"; level?: string; message: string; url?: string; status?: number; at: string }>;
}

/** 前端轮询进度用的精简格式 */
export interface RunProgress {
  runId: string;
  status: RunStatus;
  currentCriteria?: string;
  finishedCriteria: number;
  totalCriteria: number;
  fatalError?: string;
}

/** 目标配置，随每次执行保存 */
export interface TargetConfig {
  variant: string;
  url: string;
  fingerprint: string;
  /**
   * Stage C: captured HTML content at run-start (for self-contained HTML sample targets).
   * When present, the runner fulfills every navigation request to `url` from this snapshot
   * instead of fetching live content, binding execution to a specific source version.
   */
  htmlSnapshot?: string;
  sourceBinding?: "self-contained-html-snapshot" | "live-url-observed";
}

/** Persisted local target. A URL observation is not a frozen source snapshot. */
export interface TargetRecord {
  variant: string;
  label: string;
  url: string;
  kind: "url" | "html";
  projectId?: string;
  htmlPath?: string;
  sourceDir?: string;
  isSample: boolean;
  archived: boolean;
  createdAt?: string;
  fingerprint?: string;
  sourceBinding?: "self-contained-html-snapshot" | "live-url-observed";
}

// ============================================================
// Stage B 专用类型
// ============================================================

/** 项目记录：保存目标配置和关联需求 */
export interface ProjectRecord {
  projectId: string;
  name: string;
  /** 允许的目标变体（引用 ALLOWED_VARIANTS 的 key） */
  targetVariant: string;
  targetUrl: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}

/** 需求记录：保存原始需求文本和版本 */
export interface RequirementRecord {
  requirementId: string;
  projectId: string;
  /** 版本号，每次修改后递增 */
  version: number;
  /** 原始需求文本 */
  text: string;
  createdAt: string;
}

/** 页面上下文：从目标页面获取的有界结构信息 */
export interface PageContext {
  projectId: string;
  targetVariant: string;
  targetUrl: string;
  /** 页面标题 */
  title: string;
  /** 可操作元素摘要（label/role/selector） */
  elements: Array<{
    label: string;
    role: string;
    selector?: string;
  }>;
  /** 页面可见文本摘要（截断至有界长度） */
  visibleTextSummary: string;
  capturedAt: string;
  /** 获取失败时的错误说明 */
  error?: string;
}

/** 生成草稿：模型返回的待确认计划 */
export interface DraftRecord {
  draftId: string;
  projectId: string;
  requirementId: string;
  /** 草稿版本（同一需求可多次生成） */
  draftVersion: number;
  /** Revising creates a new record; the old draft and its evidence are retained. */
  supersedesDraftId?: string;
  plan: AcceptancePlan;
  /** 模型调用信息 */
  usage: GenerationUsage;
  /** 是否有未解答的问题 */
  hasOpenQuestions: boolean;
  /** 校验结果：通过则可确认 */
  validationErrors: string[];
  createdAt: string;
}

/** 模型调用使用信息 */
export interface GenerationUsage {
  /** 使用的提供商标签 */
  providerLabel: string;
  /** 使用的模型 ID */
  modelId: string;
  /** 调用时间 ISO 字符串 */
  invokedAt: string;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 是否为真实 live 调用 */
  isLive: boolean;
  /** 成功还是错误 */
  status: "success" | "error";
  /** 错误分类（仅在 status=error 时） */
  errorCategory?: ProviderErrorCategory;
  /** 错误消息（仅在 status=error 时） */
  errorMessage?: string;
  /** 输入 token 数（仅 live 成功时可能有值；未知时为 null） */
  inputTokens: number | null;
  /** 输出 token 数（仅 live 成功时可能有值；未知时为 null） */
  outputTokens: number | null;
}

/** 提供商错误分类（用于区分展示） */
export type ProviderErrorCategory =
  | "missing_config"    // 未配置密钥或地址
  | "auth"              // 认证失败（401/403）
  | "quota"             // 额度/速率限制（429）
  | "timeout"           // 超时
  | "network"           // 网络错误
  | "invalid_output"    // 返回内容不符合预期格式
  | "unknown";

/** 已确认的计划记录 */
export interface ConfirmationRecord {
  confirmationId: string;
  draftId: string;
  planId: string;
  planFingerprint: string;
  planVersion: string;
  projectId: string;
  requirementId: string;
  targetVariant: string;
  confirmedAt: string;
  /** 确认时展示给用户的计划摘要（不可变快照） */
  planSnapshot: AcceptancePlan;
}

/** 提供商配置状态（安全，不含 key） */
export interface ProviderStatus {
  configured: boolean;
  providerLabel: string;
  baseUrl: string;
  modelId: string;
  /** 未配置时的说明 */
  missingFields: string[];
}

// ============================================================
// Stage C 专用类型
// ============================================================

/**
 * 修复任务状态:
 *   waiting  — 已创建，等待 Bob 认领
 *   claimed  — Bob 已认领，正在修复中
 *   rerunning — 正在重新执行验收计划
 *   passed   — 修复后重跑全部通过（已验证修复）
 *   review   — 同一标准复验全部通过，但修复来源证据仍需确认
 *   failed   — 重跑后仍有失败
 *   error    — 执行错误（非业务失败）
 *   blocked  — 停止进展（工具错误或两次尝试无进展）
 */
export type RepairTaskStatus =
  | "waiting"
  | "claimed"
  | "rerunning"
  | "passed"
  | "review"
  | "failed"
  | "error"
  | "blocked";

/** 失败标准摘要（含期望/实际值，用于修复任务描述） */
export interface FailedCriteriaSummary {
  criteriaId: string;
  title: string;
  /** failed / error / blocked */
  status: string;
  /** 失败步骤摘要 */
  failedSteps: Array<{
    stepId: string;
    description: string;
    expected?: string | number;
    actual?: string;
    error?: string;
    screenshotPath?: string;
  }>;
}

/** 修复任务记录（不可变基准 + 动态状态） */
export interface RepairTaskRecord {
  taskId: string;
  /** 创建任务的基准运行 ID（不可变引用） */
  baselineRunId: string;
  /** 基准运行所属目标变体 */
  targetVariant: string;
  /** 目标 URL */
  targetUrl: string;
  /** 计划 ID */
  planId: string;
  /** 计划版本 */
  planVersion: string;
  /** 计划内容指纹（不可变，重跑时必须匹配） */
  planFingerprint: string;
  /** 不可变计划快照（重跑时使用，而非重新从磁盘加载） */
  planSnapshot: AcceptancePlan;
  /** 基准目标源码指纹（修复前） */
  baselineTargetFingerprint: string;
  /** 基准 runner 版本指纹（必须与重跑 runner 匹配才能声明已验证修复） */
  baselineRunnerFingerprint: string;
  /** 关联需求 ID（如有） */
  requirementId?: string;
  /** 关联确认 ID（如有） */
  confirmationId?: string;
  /** 失败标准摘要（含期望/实际值） */
  failedCriteria: FailedCriteriaSummary[];
  /** 执行错误（与业务失败分开） */
  executionErrors: string[];
  /** 复现步骤说明 */
  reproductionSteps: string;
  /** 当前任务状态 */
  status: RepairTaskStatus;
  /** 认领者标识（Bob 工具调用 id） */
  claimedBy?: string;
  /** 认领时间 */
  claimedAt?: string;
  /** 重跑 run ID（修复后执行） */
  rerunId?: string;
  /** 修复后目标源码指纹（intentional change, not equal to baseline） */
  repairedTargetFingerprint?: string;
  attemptCount?: number;
  maxAttempts?: number;
  attemptRunIds?: string[];
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** 修复对比结果 */
export interface RepairComparison {
  taskId: string;
  baselineRunId: string;
  rerunId: string;
  /** 计划指纹相同（必须） */
  planFingerprintMatch: boolean;
  /** runner 指纹相同且已知（两侧均非 "unknown"） */
  runnerFingerprintMatch: boolean;
  /** 两侧 runner 指纹均已知（非 "unknown"）—— 缺失则无法声明已验证修复 */
  runnerFingerprintKnown: boolean;
  /** 目标 ID / 变体相同 */
  targetIdentityMatch: boolean;
  /** 目标源码指纹是否变更（修复造成的 intentional change） */
  targetFingerprintChanged: boolean;
  /** 目标源码指纹来源已知（非 "unknown"） */
  sourceFingerprintKnown: boolean;
  baselineTargetFingerprint: string;
  repairedTargetFingerprint: string;
  /** 基准 runner 指纹 */
  baselineRunnerFingerprint: string;
  /** 重跑 runner 指纹 */
  rerunRunnerFingerprint: string;
  /** 基准失败的标准在重跑中是否通过 */
  previouslyFailedNowPassed: string[];
  previouslyFailedStillFailing: string[];
  /** 重跑新出现的失败 */
  newFailures: string[];
  /** Same plan, runner and target; complete terminal rerun passes. Source proof is separate. */
  acceptancePassed: boolean;
  /**
   * 整体验证修复：
   *   - 重跑 status === "passed"
   *   - 无 fatalError
   *   - 计划指纹相同
   *   - runner 指纹相同且已知
   *   - 目标身份相同
   *   - 目标源码指纹已知（不含 "unknown"）
   *   - 无 blockers
   */
  verifiedRepair: boolean;
  /** 不可判断或阻止修复声明的原因 */
  blockers: string[];
}
