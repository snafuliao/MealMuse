import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

export type Database = {
  db: PostgresJsDatabase;
  /** 在超时内探测数据库是否可达，绝不抛出。 */
  ping(timeoutMs?: number): Promise<boolean>;
  close(): Promise<void>;
};

export function createDatabase(url: string): Database {
  const client = postgres(url, { max: 10, connect_timeout: 5 });
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
