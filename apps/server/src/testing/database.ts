import { sql } from 'drizzle-orm';
import { pino } from 'pino';
import { inject } from 'vitest';
import { createDatabase } from '../providers/database.js';
import type { Infrastructure } from '../providers/index.js';
import { createSecrets } from '../providers/secrets.js';
import { TEST_SECRETS_KEY, testConfig } from './fakes.js';

/** 连接测试库的真实基础设施。每个测试文件创建一次，afterAll 中关闭。 */
export function createTestInfrastructure(): Infrastructure {
  const databaseUrl = inject('testDatabaseUrl');
  return {
    config: testConfig({ databaseUrl }),
    logger: pino({ level: 'silent' }),
    database: createDatabase(databaseUrl),
    secrets: createSecrets(TEST_SECRETS_KEY),
  };
}

/** 清空所有业务表（保留迁移记录）。 */
export async function resetDatabase(infrastructure: Infrastructure): Promise<void> {
  const tables = await infrastructure.database.db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  const names = tables.map((row) => `"${row.tablename}"`).join(', ');
  if (names) await infrastructure.database.db.execute(sql.raw(`truncate ${names} cascade`));
}
