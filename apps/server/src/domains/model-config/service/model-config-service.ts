import type {
  LlmUsageRow,
  ModelProvider,
  ModelProviderCreate,
  ModelProviderUpdate,
} from '@mealmuse/shared';
import { AppError } from '../../../providers/http.js';
import type { Infrastructure } from '../../../providers/index.js';
import type { FetchLike } from '../../../providers/llm/http.js';
import { probeCapabilities } from '../../../providers/llm/probe.js';
import type { LlmCallRecord, LlmConfig } from '../../../providers/llm/types.js';
import * as repo from '../repo/model-config-repo.js';

/** 启用中的配置缓存 30 秒；管理端修改后立即失效。 */
const CACHE_TTL_MS = 30_000;

function toModelProvider(row: repo.ProviderRow): ModelProvider {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    chatModel: row.chatModel,
    embeddingModel: row.embeddingModel,
    timeoutMs: row.timeoutMs,
    apiKeyLast4: row.apiKeyLast4,
    isActive: row.isActive,
    capabilities: row.capabilities ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const last4 = (apiKey: string) => apiKey.slice(-4);

/** exactOptionalPropertyTypes 下，部分更新要去掉值为 undefined 的字段。 */
function definedOnly<T extends object>(
  value: T,
): Partial<{ [K in keyof T]: Exclude<T[K], undefined> }> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<{
    [K in keyof T]: Exclude<T[K], undefined>;
  }>;
}

export type ModelConfigService = ReturnType<typeof createModelConfigService>;

export function createModelConfigService(
  providers: Pick<Infrastructure, 'database' | 'secrets' | 'logger'>,
  options: { fetchImpl?: FetchLike } = {},
) {
  const { db } = providers.database;
  let cache: { value: LlmConfig | null; expiresAt: number } | null = null;
  const invalidate = () => {
    cache = null;
  };

  const toConfig = (row: repo.ProviderRow): LlmConfig => ({
    providerId: row.id,
    baseUrl: row.baseUrl,
    apiKey: providers.secrets.decrypt(row.apiKeyCiphertext),
    chatModel: row.chatModel,
    embeddingModel: row.embeddingModel,
    timeoutMs: row.timeoutMs,
    capabilities: row.capabilities ?? null,
  });

  async function requireProvider(id: string): Promise<repo.ProviderRow> {
    const row = await repo.findProvider(db, id);
    if (!row) throw new AppError(404, 'provider_not_found', '模型供应商不存在');
    return row;
  }

  return {
    list: async (): Promise<ModelProvider[]> => (await repo.listProviders(db)).map(toModelProvider),

    async create(input: ModelProviderCreate): Promise<ModelProvider> {
      const row = await repo.insertProvider(db, {
        name: input.name,
        baseUrl: input.baseUrl,
        apiKeyCiphertext: providers.secrets.encrypt(input.apiKey),
        apiKeyLast4: last4(input.apiKey),
        chatModel: input.chatModel,
        embeddingModel: input.embeddingModel,
        timeoutMs: input.timeoutMs,
      });
      providers.logger.info({ providerId: row.id }, 'model provider created');
      return toModelProvider(row);
    },

    async update(id: string, input: ModelProviderUpdate): Promise<ModelProvider> {
      const { apiKey, ...fields } = input;
      const keyFields = apiKey
        ? { apiKeyCiphertext: providers.secrets.encrypt(apiKey), apiKeyLast4: last4(apiKey) }
        : {};
      // 连接参数变了，旧的能力探测结果不再可信。
      const row = await repo.updateProvider(db, id, {
        ...definedOnly(fields),
        ...keyFields,
        capabilities: null,
      });
      if (!row) throw new AppError(404, 'provider_not_found', '模型供应商不存在');
      invalidate();
      providers.logger.info(
        { providerId: id, keyChanged: Boolean(apiKey) },
        'model provider updated',
      );
      return toModelProvider(row);
    },

    async remove(id: string): Promise<void> {
      if (!(await repo.deleteProvider(db, id))) {
        throw new AppError(404, 'provider_not_found', '模型供应商不存在');
      }
      invalidate();
    },

    async activate(id: string): Promise<ModelProvider> {
      await requireProvider(id);
      await db.transaction((tx) => repo.activateProvider(tx, id));
      invalidate();
      providers.logger.info({ providerId: id }, 'model provider activated');
      return toModelProvider(await requireProvider(id));
    },

    async testConnection(id: string): Promise<ModelProvider> {
      const row = await requireProvider(id);
      const capabilities = await probeCapabilities(toConfig(row), options.fetchImpl);
      const updated = await repo.saveCapabilities(db, id, capabilities);
      invalidate();
      providers.logger.info(
        { providerId: id, ...capabilities, errors: capabilities.errors.length },
        'model provider probed',
      );
      return toModelProvider(updated ?? row);
    },

    /** 供 LLM Gateway 使用：返回已解密的启用配置，没有则为 null。 */
    async resolveActive(): Promise<LlmConfig | null> {
      if (cache && cache.expiresAt > Date.now()) return cache.value;
      const row = await repo.findActiveProvider(db);
      const value = row ? toConfig(row) : null;
      cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    },

    /** 记录调用元数据；失败只写日志，绝不影响调用方。 */
    recordCall(record: LlmCallRecord): void {
      repo.insertCall(db, record).catch((error: unknown) => {
        providers.logger.error(
          { err: error, purpose: record.purpose },
          'failed to record llm call',
        );
      });
    },

    async usage(days: number): Promise<LlmUsageRow[]> {
      return repo.usageSince(db, new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    },

    /** 命令行从 .env 导入：同名供应商存在则更新，并设为启用。 */
    async upsertFromEnv(input: ModelProviderCreate): Promise<ModelProvider> {
      const existing = await repo.findProviderByName(db, input.name);
      const provider = existing ? await this.update(existing.id, input) : await this.create(input);
      return this.activate(provider.id);
    },
  };
}
