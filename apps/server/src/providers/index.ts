import type { AppConfig } from '../config/env.js';
import { createDatabase, type Database } from './database.js';
import type { LlmGateway } from './llm/gateway.js';
import { createLogger, type Logger } from './logger.js';
import { createSecrets, type Secrets } from './secrets.js';

/**
 * 横切关注点的唯一入口（规则：横切关注点仅可通过 Providers 进入）。
 * 领域代码只依赖这个接口，测试时注入替身。
 */
export type Providers = {
  config: AppConfig;
  logger: Logger;
  database: Database;
  secrets: Secrets;
  llm: LlmGateway;
};

/** 不依赖任何领域的基础设施；llm 需要领域提供配置，由组合根（src/composition.ts）补齐。 */
export type Infrastructure = Omit<Providers, 'llm'>;

export function createInfrastructure(config: AppConfig): Infrastructure {
  return {
    config,
    logger: createLogger(config.logLevel),
    database: createDatabase(config.databaseUrl),
    secrets: createSecrets(config.modelSecretsKey),
  };
}
