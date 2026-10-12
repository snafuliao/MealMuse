import type { ProviderCapabilities } from '@mealmuse/shared';
import { z } from 'zod';
import {
  ChatCompletionSchema,
  EmbeddingResponseSchema,
  parseJsonContent,
  postJson,
  type FetchLike,
} from './http.js';
import type { LlmConfig } from './types.js';

/**
 * 字段名只出现在 schema 里、不出现在提示词里：中转站若没有把 schema 转给模型（实测经中转的
 * claude-haiku-5-5 会这样），模型猜不出字段名，探测就会失败，Gateway 随后改走「提示词附 schema」的降级路径。
 */
const ProbeSchema = z.object({ dishName: z.string(), servingCount: z.int() });

/**
 * 「测试连接」：依次探测对话、结构化输出、工具调用、Embedding。
 * 每一项独立判断，失败原因写进 errors，便于在管理端逐项展示。
 */
export async function probeCapabilities(
  config: LlmConfig,
  fetchImpl: FetchLike = fetch,
): Promise<ProviderCapabilities> {
  const errors: string[] = [];
  const attempt = async <T>(label: string, run: () => Promise<T>): Promise<T | null> => {
    try {
      return await run();
    } catch (error) {
      errors.push(`${label}：${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };
  const chat = (body: Record<string, unknown>) =>
    postJson(
      fetchImpl,
      config,
      '/chat/completions',
      { model: config.chatModel, ...body },
      ChatCompletionSchema,
    );

  const chatOk = await attempt('对话', async () => {
    const res = await chat({ messages: [{ role: 'user', content: '只回复两个字母：ok' }] });
    return (res.choices[0]?.message.content ?? '').length > 0;
  });

  const structuredOk = await attempt('结构化输出', async () => {
    const res = await chat({
      messages: [{ role: 'user', content: '按给定的 JSON Schema 描述一道两人份的番茄炒蛋。' }],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'probe', schema: z.toJSONSchema(ProbeSchema) },
      },
    });
    const parsed = ProbeSchema.safeParse(parseJsonContent(res.choices[0]?.message.content ?? ''));
    if (!parsed.success) throw new Error('返回内容不符合 JSON Schema');
    return true;
  });

  const toolsOk = await attempt('工具调用', async () => {
    const res = await chat({
      messages: [{ role: 'user', content: '现在几点？请调用 get_time 工具。' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_time',
            description: '获取当前时间',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
          },
        },
      ],
    });
    const called = res.choices[0]?.message.tool_calls?.some((c) => c.function.name === 'get_time');
    if (!called) throw new Error('模型没有发起工具调用');
    return true;
  });

  let embeddingDimensions: number | null = null;
  if (config.embeddingModel) {
    embeddingDimensions = await attempt('Embedding', async () => {
      const res = await postJson(
        fetchImpl,
        config,
        '/embeddings',
        { model: config.embeddingModel, input: ['番茄炒蛋'] },
        EmbeddingResponseSchema,
      );
      const dims = res.data[0]?.embedding.length ?? 0;
      if (dims === 0) throw new Error('返回了空向量');
      return dims;
    });
  }

  return {
    chat: chatOk === true,
    structuredOutput: structuredOk === true,
    toolCalling: toolsOk === true,
    embedding: embeddingDimensions !== null,
    embeddingDimensions,
    checkedAt: new Date().toISOString(),
    errors,
  };
}
