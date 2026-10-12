import { readFileSync } from 'node:fs';
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.url().default('postgres://mealmuse:mealmuse@localhost:5433/mealmuse'),
  PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** 32 字节密钥的 base64，用于加密存库的模型 API Key。生成：openssl rand -base64 32 */
  MODEL_SECRETS_KEY: z.string().min(1).optional(),
});

const PackageJsonSchema = z.object({ version: z.string() });

export type AppConfig = {
  databaseUrl: string;
  port: number;
  logLevel: z.infer<typeof EnvSchema>['LOG_LEVEL'];
  environment: z.infer<typeof EnvSchema>['NODE_ENV'];
  modelSecretsKey: string | null;
  version: string;
};

/** 在进程边界解析环境变量；解析失败立即退出，不带着猜测的配置运行。 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  const packageJson = PackageJsonSchema.parse(
    JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')),
  );
  return {
    databaseUrl: parsed.DATABASE_URL,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    environment: parsed.NODE_ENV,
    modelSecretsKey: parsed.MODEL_SECRETS_KEY ?? null,
    version: packageJson.version,
  };
}
