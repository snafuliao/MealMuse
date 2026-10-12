import { LlmPurposeSchema, type LlmPurpose, type ProviderCapabilities } from '@mealmuse/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const llmPurposeEnum = pgEnum('llm_purpose', [...LlmPurposeSchema.options] as [
  LlmPurpose,
  ...LlmPurpose[],
]);
export const llmCallStatusEnum = pgEnum('llm_call_status', [
  'ok',
  'error',
  'timeout',
  'invalid_output',
]);

export const llmProviders = pgTable(
  'llm_providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    baseUrl: text('base_url').notNull(),
    /** AES-256-GCM 密文，主密钥来自 MODEL_SECRETS_KEY。 */
    apiKeyCiphertext: text('api_key_ciphertext').notNull(),
    apiKeyLast4: text('api_key_last4').notNull(),
    chatModel: text('chat_model').notNull(),
    embeddingModel: text('embedding_model'),
    timeoutMs: integer('timeout_ms').notNull().default(30_000),
    capabilities: jsonb('capabilities').$type<ProviderCapabilities>(),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  // 最多一个启用的供应商。
  (table) => [
    uniqueIndex('llm_providers_single_active_idx')
      .on(table.isActive)
      .where(sql`${table.isActive}`),
  ],
);

/** 调用元数据，不存提示词与回复正文（docs/SECURITY.md）。 */
export const llmCalls = pgTable(
  'llm_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id').references(() => llmProviders.id, { onDelete: 'set null' }),
    purpose: llmPurposeEnum('purpose').notNull(),
    model: text('model').notNull(),
    status: llmCallStatusEnum('status').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    errorCode: text('error_code'),
    userId: uuid('user_id'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [index('llm_calls_created_at_idx').on(table.createdAt)],
);
