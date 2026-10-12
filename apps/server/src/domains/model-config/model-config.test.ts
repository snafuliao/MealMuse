import { ModelProviderSchema } from '@mealmuse/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestInfrastructure, resetDatabase } from '../../testing/database.js';
import { chatReply, fakeOpenAi, toolReply } from '../../testing/fake-llm.js';
import { createModelConfigService } from './service/model-config-service.js';

const infrastructure = createTestInfrastructure();
const input = {
  name: '中转站',
  baseUrl: 'https://relay.example/v1',
  apiKey: 'sk-secret-abcd1234',
  chatModel: 'gpt-6.1-sol',
  embeddingModel: null,
  timeoutMs: 30_000,
};

beforeEach(() => resetDatabase(infrastructure));
afterAll(() => infrastructure.database.close());

describe('model provider configuration', () => {
  it('stores the API key encrypted and never returns it', async () => {
    const service = createModelConfigService(infrastructure);
    const created = await service.create(input);
    expect(ModelProviderSchema.strict().parse(created).apiKeyLast4).toBe('1234');
    expect(JSON.stringify(created)).not.toContain('sk-secret');

    const [row] = await infrastructure.database.db.execute<{ api_key_ciphertext: string }>(
      sql`select api_key_ciphertext from llm_providers`,
    );
    expect(row?.api_key_ciphertext).toMatch(/^v1:/);
    expect(row?.api_key_ciphertext).not.toContain('sk-secret');
  });

  it('keeps the old key when an update omits it, and resets capabilities', async () => {
    const service = createModelConfigService(infrastructure);
    const created = await service.create(input);
    await service.activate(created.id);
    const updated = await service.update(created.id, { chatModel: 'gpt-6.1-mini' });
    expect(updated).toMatchObject({
      chatModel: 'gpt-6.1-mini',
      apiKeyLast4: '1234',
      capabilities: null,
    });
    expect((await service.resolveActive())?.apiKey).toBe('sk-secret-abcd1234');
  });

  it('keeps at most one provider active', async () => {
    const service = createModelConfigService(infrastructure);
    const a = await service.create(input);
    const b = await service.create({ ...input, name: '备用' });
    await service.activate(a.id);
    await service.activate(b.id);
    const active = (await service.list()).filter((p) => p.isActive).map((p) => p.id);
    expect(active).toEqual([b.id]);
    expect((await service.resolveActive())?.providerId).toBe(b.id);
  });

  it('probes the provider and stores capabilities', async () => {
    const fake = fakeOpenAi([chatReply('ok'), chatReply('{"ok":true}'), toolReply('get_time')]);
    const service = createModelConfigService(infrastructure, { fetchImpl: fake.fetch });
    const created = await service.create(input);
    const tested = await service.testConnection(created.id);
    expect(tested.capabilities).toMatchObject({
      chat: true,
      structuredOutput: true,
      toolCalling: true,
      embedding: false,
    });
    expect(fake.calls[0]?.authorization).toBe('Bearer sk-secret-abcd1234');
  });

  it('aggregates call usage by purpose', async () => {
    const service = createModelConfigService(infrastructure);
    const created = await service.create(input);
    const base = {
      providerId: created.id,
      model: 'm',
      inputTokens: 100,
      outputTokens: 20,
      userId: null,
    };
    service.recordCall({
      ...base,
      purpose: 'recommend',
      status: 'ok',
      latencyMs: 1000,
      errorCode: null,
    });
    service.recordCall({
      ...base,
      purpose: 'recommend',
      status: 'timeout',
      latencyMs: 3000,
      errorCode: 'timeout',
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await service.usage(7)).toEqual([
      {
        purpose: 'recommend',
        calls: 2,
        failures: 1,
        avgLatencyMs: 2000,
        inputTokens: 200,
        outputTokens: 40,
      },
    ]);
  });
});
