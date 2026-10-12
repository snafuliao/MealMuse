import type { LlmPurpose, ProviderCapabilities } from '@mealmuse/shared';
import { desc, eq, gte, sql } from 'drizzle-orm';
import type { DbExecutor } from '../../../providers/database.js';
import { llmCalls, llmProviders } from './schema.js';

export type ProviderRow = typeof llmProviders.$inferSelect;
export type NewProvider = typeof llmProviders.$inferInsert;
export type NewCall = typeof llmCalls.$inferInsert;

export async function listProviders(db: DbExecutor): Promise<ProviderRow[]> {
  return db.select().from(llmProviders).orderBy(desc(llmProviders.createdAt));
}

export async function findProvider(db: DbExecutor, id: string): Promise<ProviderRow | null> {
  const [row] = await db.select().from(llmProviders).where(eq(llmProviders.id, id)).limit(1);
  return row ?? null;
}

export async function findActiveProvider(db: DbExecutor): Promise<ProviderRow | null> {
  const [row] = await db
    .select()
    .from(llmProviders)
    .where(eq(llmProviders.isActive, true))
    .limit(1);
  return row ?? null;
}

export async function findProviderByName(
  db: DbExecutor,
  name: string,
): Promise<ProviderRow | null> {
  const [row] = await db.select().from(llmProviders).where(eq(llmProviders.name, name)).limit(1);
  return row ?? null;
}

export async function insertProvider(db: DbExecutor, values: NewProvider): Promise<ProviderRow> {
  const [row] = await db.insert(llmProviders).values(values).returning();
  if (!row) throw new Error('insert llm_providers returned no row');
  return row;
}

export async function updateProvider(
  db: DbExecutor,
  id: string,
  values: Partial<NewProvider>,
): Promise<ProviderRow | null> {
  const [row] = await db
    .update(llmProviders)
    .set({ ...values, updatedAt: sql`now()` })
    .where(eq(llmProviders.id, id))
    .returning();
  return row ?? null;
}

export async function deleteProvider(db: DbExecutor, id: string): Promise<boolean> {
  const rows = await db
    .delete(llmProviders)
    .where(eq(llmProviders.id, id))
    .returning({ id: llmProviders.id });
  return rows.length > 0;
}

/** 先全部停用再启用目标；部分唯一索引保证同一时刻最多一个启用。 */
export async function activateProvider(db: DbExecutor, id: string): Promise<void> {
  await db.update(llmProviders).set({ isActive: false }).where(eq(llmProviders.isActive, true));
  await db
    .update(llmProviders)
    .set({ isActive: true, updatedAt: sql`now()` })
    .where(eq(llmProviders.id, id));
}

export async function saveCapabilities(
  db: DbExecutor,
  id: string,
  capabilities: ProviderCapabilities,
): Promise<ProviderRow | null> {
  return updateProvider(db, id, { capabilities });
}

export async function insertCall(db: DbExecutor, values: NewCall): Promise<void> {
  await db.insert(llmCalls).values(values);
}

export async function usageSince(
  db: DbExecutor,
  since: Date,
): Promise<
  Array<{
    purpose: LlmPurpose;
    calls: number;
    failures: number;
    avgLatencyMs: number;
    inputTokens: number;
    outputTokens: number;
  }>
> {
  return db
    .select({
      purpose: llmCalls.purpose,
      calls: sql<number>`count(*)::int`,
      failures: sql<number>`count(*) filter (where ${llmCalls.status} <> 'ok')::int`,
      avgLatencyMs: sql<number>`coalesce(round(avg(${llmCalls.latencyMs})), 0)::int`,
      inputTokens: sql<number>`coalesce(sum(${llmCalls.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${llmCalls.outputTokens}), 0)::int`,
    })
    .from(llmCalls)
    .where(gte(llmCalls.createdAt, since))
    .groupBy(llmCalls.purpose);
}
