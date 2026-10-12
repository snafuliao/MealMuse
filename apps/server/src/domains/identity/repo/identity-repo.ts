import type { Role } from '@mealmuse/shared';
import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import type { DbExecutor } from '../../../providers/database.js';
import { deviceTokens, inviteCodes, users } from './schema.js';

export type UserRow = typeof users.$inferSelect;
export type InviteRow = typeof inviteCodes.$inferSelect;
export type DeviceTokenRow = typeof deviceTokens.$inferSelect;

export async function insertUser(
  db: DbExecutor,
  values: { displayName: string; role: Role; invitedBy: string | null },
): Promise<UserRow> {
  const [row] = await db.insert(users).values(values).returning();
  if (!row) throw new Error('insert users returned no row');
  return row;
}

export async function findUserById(db: DbExecutor, id: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function findAdminByName(
  db: DbExecutor,
  displayName: string,
): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.displayName, displayName), eq(users.role, 'admin')))
    .limit(1);
  return row ?? null;
}

export async function insertInvite(
  db: DbExecutor,
  values: {
    codeHash: string;
    createdBy: string | null;
    role: Role;
    maxUses: number;
    expiresAt: Date;
  },
): Promise<InviteRow> {
  const [row] = await db.insert(inviteCodes).values(values).returning();
  if (!row) throw new Error('insert invite_codes returned no row');
  return row;
}

/** 原子地消耗一次邀请码：未撤销、未过期、还有剩余次数才成功。 */
export async function consumeInvite(db: DbExecutor, codeHash: string): Promise<InviteRow | null> {
  const [row] = await db
    .update(inviteCodes)
    .set({ usedCount: sql`${inviteCodes.usedCount} + 1` })
    .where(
      and(
        eq(inviteCodes.codeHash, codeHash),
        isNull(inviteCodes.revokedAt),
        gt(inviteCodes.expiresAt, sql`now()`),
        lt(inviteCodes.usedCount, inviteCodes.maxUses),
      ),
    )
    .returning();
  return row ?? null;
}

export async function listInvites(db: DbExecutor): Promise<InviteRow[]> {
  return db.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt)).limit(100);
}

export async function revokeInvite(db: DbExecutor, id: string): Promise<InviteRow | null> {
  const [row] = await db
    .update(inviteCodes)
    .set({ revokedAt: sql`coalesce(${inviteCodes.revokedAt}, now())` })
    .where(eq(inviteCodes.id, id))
    .returning();
  return row ?? null;
}

export async function insertDeviceToken(
  db: DbExecutor,
  values: { userId: string; tokenHash: string; kind: DeviceTokenRow['kind']; deviceName: string },
): Promise<DeviceTokenRow> {
  const [row] = await db.insert(deviceTokens).values(values).returning();
  if (!row) throw new Error('insert device_tokens returned no row');
  return row;
}

export async function findActiveToken(
  db: DbExecutor,
  tokenHash: string,
): Promise<{ token: DeviceTokenRow; user: UserRow } | null> {
  const [row] = await db
    .select({ token: deviceTokens, user: users })
    .from(deviceTokens)
    .innerJoin(users, eq(users.id, deviceTokens.userId))
    .where(and(eq(deviceTokens.tokenHash, tokenHash), isNull(deviceTokens.revokedAt)))
    .limit(1);
  return row ?? null;
}

export async function touchActivity(
  db: DbExecutor,
  tokenId: string,
  userId: string,
): Promise<void> {
  await db
    .update(deviceTokens)
    .set({ lastSeenAt: sql`now()` })
    .where(eq(deviceTokens.id, tokenId));
  await db
    .update(users)
    .set({ lastActiveAt: sql`now()` })
    .where(eq(users.id, userId));
}

export async function revokeDeviceToken(db: DbExecutor, id: string): Promise<boolean> {
  const rows = await db
    .update(deviceTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(deviceTokens.id, id), isNull(deviceTokens.revokedAt)))
    .returning({ id: deviceTokens.id });
  return rows.length > 0;
}

export async function listUsersWithDevices(
  db: DbExecutor,
): Promise<Array<{ user: UserRow; devices: DeviceTokenRow[] }>> {
  const userRows = await db.select().from(users).orderBy(desc(users.createdAt));
  const tokenRows = await db
    .select()
    .from(deviceTokens)
    .where(isNull(deviceTokens.revokedAt))
    .orderBy(desc(deviceTokens.createdAt));
  return userRows.map((user) => ({
    user,
    devices: tokenRows.filter((token) => token.userId === user.id),
  }));
}
