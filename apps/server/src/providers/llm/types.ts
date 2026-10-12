import type { LlmPurpose, ProviderCapabilities } from '@mealmuse/shared';

/** 当前启用的供应商（已解密）。只在服务端内存中存在。 */
export type LlmConfig = {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  embeddingModel: string | null;
  timeoutMs: number;
  capabilities: ProviderCapabilities | null;
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmCallRecord = {
  providerId: string;
  purpose: LlmPurpose;
  model: string;
  status: 'ok' | 'error' | 'timeout' | 'invalid_output';
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  errorCode: string | null;
  userId: string | null;
};

export type LlmErrorCode =
  'not_configured' | 'timeout' | 'network' | 'http_error' | 'invalid_output' | 'unsupported';

export class LlmError extends Error {
  constructor(
    readonly code: LlmErrorCode,
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
  }
}
