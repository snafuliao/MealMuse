import { RoleSchema, type Role } from '@mealmuse/shared';
import {
  type AnyPgColumn,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const roleEnum = pgEnum('role', [...RoleSchema.options] as [Role, ...Role[]]);
export const deviceKindEnum = pgEnum('device_kind', ['ios', 'admin_web']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  role: roleEnum('role').notNull().default('member'),
  invitedBy: uuid('invited_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  lastActiveAt: timestamptz('last_active_at'),
});

export const inviteCodes = pgTable('invite_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** SHA-256；明文只在创建时返回一次。 */
  codeHash: text('code_hash').notNull().unique(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  role: roleEnum('role').notNull().default('member'),
  maxUses: integer('max_uses').notNull().default(1),
  usedCount: integer('used_count').notNull().default(0),
  expiresAt: timestamptz('expires_at').notNull(),
  revokedAt: timestamptz('revoked_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256；明文只在签发时返回一次。 */
    tokenHash: text('token_hash').notNull().unique(),
    kind: deviceKindEnum('kind').notNull(),
    deviceName: text('device_name').notNull(),
    lastSeenAt: timestamptz('last_seen_at'),
    revokedAt: timestamptz('revoked_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [index('device_tokens_user_id_idx').on(table.userId)],
);
