import { ModelProviderCreateSchema } from '@mealmuse/shared';
import { z } from 'zod';
import { createServices } from '../composition.js';
import { loadConfig } from '../config/env.js';

/**
 * 从 .env 导入模型供应商并设为启用，然后测试连接。API Key 只经过本机进程，不出现在命令行参数里。
 * 用法：在 .env 中填写 LLM_* 变量后运行 pnpm --filter @mealmuse/server llm:import-env
 */
const EnvSchema = z.object({
  LLM_PROVIDER_NAME: z.string().default('中转站'),
  LLM_BASE_URL: z.string().min(1),
  LLM_API_KEY: z.string().min(8, 'LLM_API_KEY 为空或太短'),
  LLM_CHAT_MODEL: z.string().min(1),
  LLM_EMBEDDING_MODEL: z.string().optional(),
});

const parsedEnv = EnvSchema.safeParse(process.env);
if (!parsedEnv.success) {
  process.stderr.write(
    `缺少模型配置。修复：在仓库根的 .env 中填写 LLM_BASE_URL、LLM_API_KEY、LLM_CHAT_MODEL（参考 .env.example）。\n${z.prettifyError(parsedEnv.error)}\n`,
  );
  process.exit(1);
}
const env = parsedEnv.data;
const input = ModelProviderCreateSchema.parse({
  name: env.LLM_PROVIDER_NAME,
  baseUrl: env.LLM_BASE_URL,
  apiKey: env.LLM_API_KEY,
  chatModel: env.LLM_CHAT_MODEL,
  embeddingModel: env.LLM_EMBEDDING_MODEL || null,
});

const services = createServices(loadConfig());
try {
  const provider = await services.modelConfig.upsertFromEnv(input);
  process.stdout.write(
    `已导入并启用：${provider.name}（Key 末 4 位 ${provider.apiKeyLast4}），正在测试连接…\n`,
  );
  const tested = await services.modelConfig.testConnection(provider.id);
  const caps = tested.capabilities;
  const mark = (ok: boolean | undefined) => (ok ? '✔' : '✖');
  process.stdout.write(
    [
      `${mark(caps?.chat)} 对话`,
      `${mark(caps?.structuredOutput)} 结构化输出`,
      `${mark(caps?.toolCalling)} 工具调用`,
      `${mark(caps?.embedding)} Embedding${caps?.embeddingDimensions ? `（${caps.embeddingDimensions} 维）` : ''}`,
      ...(caps?.errors ?? []).map((e) => `  · ${e}`),
    ].join('\n') + '\n',
  );
} finally {
  await services.shutdown();
}
