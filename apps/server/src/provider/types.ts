/**
 * Provider transport interface.
 * Implementing a new protocol:
 *   1. Create a class implementing ProviderTransport
 *   2. Wire it in createTransport() in provider/index.ts
 *   3. Document required env vars in .env.example
 */

import type { AcceptancePlan, PageContext, GenerationUsage, ProviderErrorCategory } from "@ming/contracts";

export interface GenerateRequest {
  /** 原始需求文本 */
  requirement: string;
  /** 页面上下文（可能为 null，若检查失败） */
  pageContext: PageContext | null;
  /** 项目 ID（用于生成 planId 前缀） */
  projectId: string;
  /** 需求 ID */
  requirementId: string;
}

export interface GenerateResult {
  ok: true;
  plan: AcceptancePlan;
  usage: GenerationUsage;
}

export interface GenerateError {
  ok: false;
  usage: GenerationUsage;
}

export type GenerateOutcome = GenerateResult | GenerateError;

export interface ProviderTransport {
  /** 人类可读标签（不含密钥） */
  readonly label: string;
  readonly modelId: string;
  readonly baseUrl: string;

  /**
   * 调用模型生成草稿计划。
   * 永不静默回退；未配置时立即返回 missing_config 错误。
   * 不重试（避免无限重试）。
   */
  generate(req: GenerateRequest): Promise<GenerateOutcome>;
}

/** 用于测试传输的常量，防止拼写错误 */
export const TEST_TRANSPORT_LABEL = "test-fixture-transport";

/** 区分错误类型 */
export function classifyHttpStatus(status: number): ProviderErrorCategory {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "quota";
  return "unknown";
}
