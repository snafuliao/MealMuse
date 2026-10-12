import { desc, eq } from 'drizzle-orm';
import type { DbExecutor } from '../../../providers/database.js';
import { seedImportItems } from './schema.js';

export type SeedItemRow = typeof seedImportItems.$inferSelect;

export async function findSeedItem(
  db: DbExecutor,
  sourcePath: string,
): Promise<SeedItemRow | null> {
  const [row] = await db
    .select()
    .from(seedImportItems)
    .where(eq(seedImportItems.sourcePath, sourcePath))
    .limit(1);
  return row ?? null;
}

export async function findSeedItemById(db: DbExecutor, id: string): Promise<SeedItemRow | null> {
  const [row] = await db.select().from(seedImportItems).where(eq(seedImportItems.id, id)).limit(1);
  return row ?? null;
}

/** 每个源文件只保留最新一次导入结果。 */
export async function recordSeedItem(
  db: DbExecutor,
  values: Pick<SeedItemRow, 'batch' | 'sourcePath' | 'status' | 'recipeId' | 'error'> &
    Partial<Pick<SeedItemRow, 'structured' | 'promptVersion'>>,
): Promise<void> {
  await db
    .insert(seedImportItems)
    .values(values)
    .onConflictDoUpdate({
      target: seedImportItems.sourcePath,
      set: { ...values, createdAt: new Date() },
    });
}

export async function listSeedItems(
  db: DbExecutor,
  status: SeedItemRow['status'] | undefined,
): Promise<SeedItemRow[]> {
  return db
    .select()
    .from(seedImportItems)
    .where(status ? eq(seedImportItems.status, status) : undefined)
    .orderBy(desc(seedImportItems.createdAt))
    .limit(500);
}
