import type { AppConfig } from '../config/env.js';
import { createDatabase, type Database } from './database.js';
import { createLogger, type Logger } from './logger.js';

/**
 * 横切关注点的唯一入口（规则：横切关注点仅可通过 Providers 进入）。
 * 领域代码只依赖这个接口，测试时注入替身。
 */
export type Providers = {
  config: AppConfig;
  logger: Logger;
  database: Pick<Database, 'ping'>;
};

export function createProviders(config: AppConfig): Providers & { shutdown(): Promise<void> } {
  const logger = createLogger(config.logLevel);
  const database = createDatabase(config.databaseUrl);
  return {
    config,
    logger,
    database,
    shutdown: () => database.close(),
  };
}
