// ============================================================
// Ming 共享类型定义（Stage A + Stage B）
// ============================================================

export type StepType =
  | "navigate"
  | "fill"
  | "click"
  | "reload"
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
  source: "fixture" | "generated";
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
