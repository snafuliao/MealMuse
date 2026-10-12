import type { LlmPurpose } from '@mealmuse/shared';
import { z } from 'zod';
import type { Logger } from '../logger.js';
import {
  ChatCompletionSchema,
  EmbeddingResponseSchema,
  parseJsonContent,
  postJson,
  type FetchLike,
} from './http.js';
import { LlmError, type ChatMessage, type LlmCallRecord, type LlmConfig } from './types.js';

export type CompleteRequest<T> = {
  purpose: LlmPurpose;
  messages: ChatMessage[];
  /** 提供时要求模型输出符合该 schema 的 JSON，并在返回前完成解析。 */
  schema?: { name: string; zod: z.ZodType<T> };
  userId?: string;
  /** 覆盖供应商的默认超时，用于批量结构化这类长输出任务。 */
  timeoutMs?: number;
};

export type LlmGateway = {
  /** 当前是否有启用的供应商。 */
  isConfigured(): Promise<boolean>;
  completeText(request: Omit<CompleteRequest<never>, 'schema'>): Promise<string>;
  completeJson<T>(
    request: CompleteRequest<T> & { schema: { name: string; zod: z.ZodType<T> } },
  ): Promise<T>;
  embed(request: { purpose: LlmPurpose; texts: string[]; userId?: string }): Promise<number[][]>;
};

export type LlmGatewayDeps = {
  logger: Logger;
  resolveConfig(): Promise<LlmConfig | null>;
  recordCall(record: LlmCallRecord): void;
  fetchImpl?: FetchLike;
};

const errorStatus = (error: unknown): LlmCallRecord['status'] =>
  error instanceof LlmError && error.code === 'timeout'
    ? 'timeout'
    : error instanceof LlmError && error.code === 'invalid_output'
      ? 'invalid_output'
      : 'error';

export function createLlmGateway(deps: LlmGatewayDeps): LlmGateway {
  const fetchImpl = deps.fetchImpl ?? fetch;

  async function requireConfig(timeoutMs?: number): Promise<LlmConfig> {
    const config = await deps.resolveConfig();
    if (!config) throw new LlmError('not_configured', '尚未在管理端启用模型供应商');
    return timeoutMs ? { ...config, timeoutMs } : config;
  }

  /** 执行一次调用并记录 llm_calls（不含正文）与结构化日志。 */
  async function tracked<T>(
    config: LlmConfig,
    meta: { purpose: LlmPurpose; model: string; userId?: string },
    run: () => Promise<{ value: T; inputTokens: number; outputTokens: number }>,
  ): Promise<T> {
    const started = performance.now();
    const base = {
      providerId: config.providerId,
      purpose: meta.purpose,
      model: meta.model,
      userId: meta.userId ?? null,
    };
    try {
      const { value, inputTokens, outputTokens } = await run();
      const latencyMs = Math.round(performance.now() - started);
      deps.recordCall({
        ...base,
        status: 'ok',
        latencyMs,
        inputTokens,
        outputTokens,
        errorCode: null,
      });
      deps.logger.info({ ...base, latencyMs, inputTokens, outputTokens }, 'llm call succeeded');
      return value;
    } catch (error) {
      const latencyMs = Math.round(performance.now() - started);
      const errorCode = error instanceof LlmError ? error.code : 'unknown';
      deps.recordCall({
        ...base,
        status: errorStatus(error),
        latencyMs,
        inputTokens: 0,
        outputTokens: 0,
        errorCode,
      });
      deps.logger.warn({ ...base, latencyMs, errorCode }, 'llm call failed');
      throw error;
    }
  }

  async function chat(config: LlmConfig, body: Record<string, unknown>) {
    const completion = await postJson(
      fetchImpl,
      config,
      '/chat/completions',
      body,
      ChatCompletionSchema,
    );
    return {
      content: completion.choices[0]?.message.content ?? '',
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  }

  return {
    async isConfigured() {
      return (await deps.resolveConfig()) !== null;
    },

    async completeText(request) {
      const config = await requireConfig(request.timeoutMs);
      return tracked(config, { ...request, model: config.chatModel }, async () => {
        const result = await chat(config, { model: config.chatModel, messages: request.messages });
        return {
          value: result.content,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        };
      });
    },

    async completeJson(request) {
      const config = await requireConfig(request.timeoutMs);
      const jsonSchema = z.toJSONSchema(request.schema.zod, { io: 'output' });
      const nativeSchema = config.capabilities?.structuredOutput !== false;
      const responseFormat = nativeSchema
        ? { type: 'json_schema', json_schema: { name: request.schema.name, schema: jsonSchema } }
        : { type: 'json_object' };
      const schemaHint: ChatMessage = {
        role: 'system',
        content: `只输出一个 JSON 对象，必须符合以下 JSON Schema：\n${JSON.stringify(jsonSchema)}`,
      };

      return tracked(config, { ...request, model: config.chatModel }, async () => {
        let messages = nativeSchema ? request.messages : [schemaHint, ...request.messages];
        let inputTokens = 0;
        let outputTokens = 0;
        // 解析失败时带着错误信息重试一次（docs/design-docs/recommendation-agent.md 原则 2）。
        for (let attempt = 0; attempt < 2; attempt++) {
          const result = await chat(config, {
            model: config.chatModel,
            messages,
            response_format: responseFormat,
          });
          inputTokens += result.inputTokens;
          outputTokens += result.outputTokens;
          const parsed = request.schema.zod.safeParse(parseJsonContent(result.content));
          if (parsed.success) return { value: parsed.data, inputTokens, outputTokens };
          messages = [
            ...messages,
            { role: 'assistant', content: result.content },
            {
              role: 'user',
              content: `上面的输出不符合要求：${z.prettifyError(parsed.error)}。请只输出修正后的 JSON。`,
            },
          ];
        }
        throw new LlmError('invalid_output', '模型两次输出都不符合 schema');
      });
    },

    async embed(request) {
      const config = await requireConfig();
      const model = config.embeddingModel;
      if (!model) throw new LlmError('unsupported', '当前供应商没有配置 Embedding 模型');
      return tracked(config, { ...request, model }, async () => {
        const response = await postJson(
          fetchImpl,
          config,
          '/embeddings',
          { model, input: request.texts },
          EmbeddingResponseSchema,
        );
        const vectors = [...response.data]
          .sort((a, b) => a.index - b.index)
          .map((d) => d.embedding);
        if (vectors.length !== request.texts.length) {
          throw new LlmError('invalid_output', 'Embedding 返回条数与输入不一致');
        }
        return { value: vectors, inputTokens: response.usage?.prompt_tokens ?? 0, outputTokens: 0 };
      });
    },
  };
}
