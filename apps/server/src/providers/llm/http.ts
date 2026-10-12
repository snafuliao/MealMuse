import { z } from 'zod';
import { LlmError, type LlmConfig } from './types.js';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

const UsageSchema = z
  .object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
  })
  .optional();

export const ChatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(z.object({ function: z.object({ name: z.string(), arguments: z.string() }) }))
            .optional(),
        }),
      }),
    )
    .min(1),
  usage: UsageSchema,
});
export type ChatCompletion = z.infer<typeof ChatCompletionSchema>;

export const EmbeddingResponseSchema = z.object({
  data: z.array(z.object({ index: z.number(), embedding: z.array(z.number()) })),
  usage: UsageSchema,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 向 OpenAI 兼容接口 POST 一个 JSON 请求，并用 schema 解析响应。
 * 网络错误、超时、429 与 5xx 指数退避重试最多 2 次；其他 4xx 不重试。
 */
export async function postJson<T>(
  fetchImpl: FetchLike,
  config: LlmConfig,
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}${path}`;
  let lastError: LlmError = new LlmError('network', '请求未发出');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      lastError = timedOut
        ? new LlmError('timeout', `模型请求超过 ${config.timeoutMs}ms 未返回`)
        : new LlmError('network', '无法连接模型服务');
      continue;
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      lastError = new LlmError(
        'http_error',
        `模型服务返回 HTTP ${response.status}：${detail}`,
        response.status,
      );
      if (RETRYABLE_STATUS.has(response.status)) continue;
      throw lastError;
    }

    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new LlmError('invalid_output', '模型服务返回的结构不符合 OpenAI 兼容格式');
    }
    return parsed.data;
  }
  throw lastError;
}

const FENCED_JSON = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/;

/**
 * 解析模型回复里的 JSON。部分中转站（如经 OpenAI 兼容层转发的 Claude）会忽略 response_format，
 * 把 JSON 包在 Markdown 代码块里；这里去掉外层代码块再解析，结果仍由调用方的 zod schema 校验。
 * 解析失败返回 null。
 */
export function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const body = FENCED_JSON.exec(trimmed)?.[1] ?? trimmed;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
