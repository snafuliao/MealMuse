import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

export type Db = PostgresJsDatabase;
/** 数据库或事务：repo 函数接受二者之一，事务由 service 层开启。 */
export type DbExecutor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

export type Database = {
  db: Db;
  /** 在超时内探测数据库是否可达，绝不抛出。 */
  ping(timeoutMs?: number): Promise<boolean>;
  close(): Promise<void>;
};

export function createDatabase(url: string): Database {
  const client = postgres(url, { max: 10, connect_timeout: 5, onnotice: () => {} });
  const db = drizzle(client);
  return {
    db,
    async ping(timeoutMs = 1000) {
      const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs));
      const probe = db.execute(sql`select 1`).then(
        () => true,
        () => false,
      );
      return Promise.race([probe, timeout]);
    },
    async close() {
      await client.end({ timeout: 5 });
    },
  };
}
