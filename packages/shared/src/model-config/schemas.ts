import { z } from 'zod';

export const LlmPurposeSchema = z
  .enum(['recommend', 'swap', 'generate_recipe', 'chat', 'embedding', 'structure_seed', 'probe'])
  .meta({ id: 'LlmPurpose' });
export type LlmPurpose = z.infer<typeof LlmPurposeSchema>;

/** 「测试连接」探测到的能力；推荐与问答据此选择调用方式。 */
export const ProviderCapabilitiesSchema = z
  .object({
    chat: z.boolean(),
    structuredOutput: z.boolean(),
    toolCalling: z.boolean(),
    embedding: z.boolean(),
    embeddingDimensions: z.int().nullable(),
    checkedAt: z.iso.datetime(),
    errors: z.array(z.string()),
  })
  .meta({ id: 'ProviderCapabilities' });
export type ProviderCapabilities = z.infer<typeof ProviderCapabilitiesSchema>;

const ProviderFieldsSchema = z.object({
  name: z.string().trim().min(1).max(40),
  baseUrl: z.url({ protocol: /^https?$/ }),
  chatModel: z.string().trim().min(1).max(100),
  embeddingModel: z.string().trim().min(1).max(100).nullable(),
  timeoutMs: z.int().min(1000).max(120_000),
});

export const ModelProviderSchema = ProviderFieldsSchema.extend({
  id: z.uuid(),
  apiKeyLast4: z.string(),
  isActive: z.boolean(),
  capabilities: ProviderCapabilitiesSchema.nullable(),
  updatedAt: z.iso.datetime(),
}).meta({ id: 'ModelProvider' });
export type ModelProvider = z.infer<typeof ModelProviderSchema>;

export const ModelProviderCreateSchema = ProviderFieldsSchema.extend({
  apiKey: z.string().trim().min(8),
  embeddingModel: z.string().trim().min(1).max(100).nullable().default(null),
  timeoutMs: z.int().min(1000).max(120_000).default(30_000),
}).meta({ id: 'ModelProviderCreate' });
export type ModelProviderCreate = z.infer<typeof ModelProviderCreateSchema>;

/** 更新时 apiKey 可省略，表示保留原值（Key 只写不读）。 */
export const ModelProviderUpdateSchema = ProviderFieldsSchema.partial()
  .extend({ apiKey: z.string().trim().min(8).optional() })
  .meta({ id: 'ModelProviderUpdate' });
export type ModelProviderUpdate = z.infer<typeof ModelProviderUpdateSchema>;

export const LlmUsageRowSchema = z
  .object({
    purpose: LlmPurposeSchema,
    calls: z.int(),
    failures: z.int(),
    avgLatencyMs: z.int(),
    inputTokens: z.int(),
    outputTokens: z.int(),
  })
  .meta({ id: 'LlmUsageRow' });
export type LlmUsageRow = z.infer<typeof LlmUsageRowSchema>;
