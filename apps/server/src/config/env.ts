import { readFileSync } from 'node:fs';
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.url().default('postgres://mealmuse:mealmuse@localhost:5433/mealmuse'),
  PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const PackageJsonSchema = z.object({ version: z.string() });

export type AppConfig = {
  databaseUrl: string;
  port: number;
  logLevel: z.infer<typeof EnvSchema>['LOG_LEVEL'];
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
    version: packageJson.version,
  };
}
