import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { chatReply, fakeOpenAi } from '../../testing/fake-llm.js';
import { createLlmGateway } from './gateway.js';
import { probeCapabilities } from './probe.js';
import { LlmError, type LlmCallRecord, type LlmConfig } from './types.js';

const config: LlmConfig = {
  providerId: '00000000-0000-4000-8000-000000000001',
  baseUrl: 'https://relay.example/v1/',
  apiKey: 'sk-test-1234',
  chatModel: 'gpt-6.1-sol',
  embeddingModel: 'text-embedding-3-small',
  timeoutMs: 1000,
  capabilities: null,
};

function gateway(replies: Parameters<typeof fakeOpenAi>[0], active: LlmConfig | null = config) {
  const fake = fakeOpenAi(replies);
  const records: LlmCallRecord[] = [];
  const llm = createLlmGateway({
    logger: pino({ level: 'silent' }),
    resolveConfig: async () => active,
    recordCall: (record) => records.push(record),
    fetchImpl: fake.fetch,
  });
  return { llm, calls: fake.calls, records };
}

const DishSchema = z.object({ name: z.string(), minutes: z.number() });

describe('completeJson', () => {
  it('sends a json_schema request to the relay and parses the reply', async () => {
    const { llm, calls, records } = gateway([chatReply('{"name":"番茄炒蛋","minutes":10}')]);
    const dish = await llm.completeJson({
      purpose: 'recommend',
      messages: [{ role: 'user', content: '推荐一道菜' }],
      schema: { name: 'dish', zod: DishSchema },
    });
    expect(dish).toEqual({ name: '番茄炒蛋', minutes: 10 });
    expect(calls[0]?.url).toBe('https://relay.example/v1/chat/completions');
    expect(calls[0]?.authorization).toBe('Bearer sk-test-1234');
    expect(calls[0]?.body).toMatchObject({
      model: 'gpt-6.1-sol',
      response_format: { type: 'json_schema' },
    });
    expect(records).toMatchObject([{ purpose: 'recommend', status: 'ok', inputTokens: 10 }]);
  });

  it('asks the model to fix output that does not match the schema, once', async () => {
    const { llm, calls } = gateway([
      chatReply('{"name":"番茄炒蛋"}'),
      chatReply('{"name":"番茄炒蛋","minutes":8}'),
    ]);
    const dish = await llm.completeJson({
      purpose: 'recommend',
      messages: [{ role: 'user', content: '推荐一道菜' }],
      schema: { name: 'dish', zod: DishSchema },
    });
    expect(dish.minutes).toBe(8);
    const retryMessages = calls[1]?.body['messages'] as Array<{ content: string }>;
    expect(retryMessages.at(-1)?.content).toContain('不符合要求');
  });

  it('gives up with invalid_output after two bad replies and records it', async () => {
    const { llm, records } = gateway([chatReply('不是 JSON'), chatReply('{}')]);
    const request = llm.completeJson({
      purpose: 'recommend',
      messages: [{ role: 'user', content: 'x' }],
      schema: { name: 'dish', zod: DishSchema },
    });
    await expect(request).rejects.toMatchObject({ code: 'invalid_output' });
    expect(records[0]?.status).toBe('invalid_output');
  });

  it('falls back to json_object when the relay lacks structured output', async () => {
    const noSchema = {
      ...config,
      capabilities: { structuredOutput: false } as LlmConfig['capabilities'],
    };
    const { llm, calls } = gateway([chatReply('{"name":"a","minutes":1}')], noSchema);
    await llm.completeJson({
      purpose: 'chat',
      messages: [],
      schema: { name: 'dish', zod: DishSchema },
    });
    expect(calls[0]?.body['response_format']).toEqual({ type: 'json_object' });
    const messages = calls[0]?.body['messages'] as Array<{ role: string; content: string }>;
    expect(messages[0]?.content).toContain('JSON Schema');
  });
});

describe('transport', () => {
  it('retries 5xx responses and network errors, then succeeds', async () => {
    const { llm, calls } = gateway([
      { status: 502 },
      new TypeError('fetch failed'),
      chatReply('好的'),
    ]);
    expect(await llm.completeText({ purpose: 'chat', messages: [] })).toBe('好的');
    expect(calls).toHaveLength(3);
  });

  it('does not retry 4xx responses', async () => {
    const { llm, calls } = gateway([{ status: 401, json: { error: 'bad key' } }]);
    await expect(llm.completeText({ purpose: 'chat', messages: [] })).rejects.toMatchObject({
      code: 'http_error',
      httpStatus: 401,
    });
    expect(calls).toHaveLength(1);
  });

  it('lets a single call override the provider timeout', async () => {
    const { llm } = gateway([new DOMException('timed out', 'TimeoutError'), chatReply('ok')]);
    // 只验证参数能传入且不影响正常返回；超时本身由 AbortSignal 实现。
    expect(await llm.completeText({ purpose: 'chat', messages: [], timeoutMs: 120_000 })).toBe(
      'ok',
    );
  });

  it('reports not_configured when no provider is active', async () => {
    const { llm } = gateway([], null);
    await expect(llm.completeText({ purpose: 'chat', messages: [] })).rejects.toBeInstanceOf(
      LlmError,
    );
    expect(await llm.isConfigured()).toBe(false);
  });

  it('returns embeddings in input order', async () => {
    const { llm } = gateway([
      {
        json: {
          data: [
            { index: 1, embedding: [2] },
            { index: 0, embedding: [1] },
          ],
        },
      },
    ]);
    expect(await llm.embed({ purpose: 'embedding', texts: ['a', 'b'] })).toEqual([[1], [2]]);
  });
});

describe('probeCapabilities', () => {
  it('reports each capability independently', async () => {
    const fake = fakeOpenAi([
      chatReply('ok'),
      chatReply('{"ok":true}'),
      chatReply('现在是中午'), // 没有发起工具调用
      { json: { data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }] } },
    ]);
    const result = await probeCapabilities(config, fake.fetch);
    expect(result).toMatchObject({
      chat: true,
      structuredOutput: true,
      toolCalling: false,
      embedding: true,
      embeddingDimensions: 3,
    });
    expect(result.errors).toEqual([expect.stringContaining('工具调用')]);
  });
});
