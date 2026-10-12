import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { TestProject } from 'vitest/node';

const DEFAULT_URL = 'postgres://mealmuse:mealmuse@localhost:5433/mealmuse_test';

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

/** 创建（如不存在）并迁移测试库 mealmuse_test，开发库不受影响。 */
export default async function setup(project: TestProject) {
  const url = new URL(process.env['TEST_DATABASE_URL'] ?? DEFAULT_URL);
  const databaseName = url.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const admin = postgres(adminUrl.toString(), { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    const existing = await admin`select 1 from pg_database where datname = ${databaseName}`;
    if (existing.length === 0) await admin.unsafe(`create database "${databaseName}"`);
  } catch (error) {
    throw new Error(
      `测试需要本地 Postgres（${adminUrl.host}）。修复：在仓库根运行 pnpm dev:db 后重试。`,
      { cause: error },
    );
  } finally {
    await admin.end();
  }

  const client = postgres(url.toString(), { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), {
    migrationsFolder: new URL('../../drizzle', import.meta.url).pathname,
  });
  await client.end();
  project.provide('testDatabaseUrl', url.toString());
}
