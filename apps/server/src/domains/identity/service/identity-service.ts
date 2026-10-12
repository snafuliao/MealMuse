import type {
  CreateInviteRequest,
  CreatedInvite,
  Invite,
  Me,
  RedeemInviteRequest,
  RedeemInviteResponse,
  UserSummary,
} from '@mealmuse/shared';
import { AppError, type AuthUser } from '../../../providers/http.js';
import type { Infrastructure } from '../../../providers/index.js';
import * as repo from '../repo/identity-repo.js';
import { generateDeviceToken, generateInviteCode, normalizeInviteCode, sha256 } from './secrets.js';

const iso = (date: Date) => date.toISOString();
const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null);
/** 活跃时间最多每 5 分钟写一次，避免每个请求都写库。 */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

function toInvite(row: repo.InviteRow): Invite {
  return {
    id: row.id,
    role: row.role,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    expiresAt: iso(row.expiresAt),
    revokedAt: isoOrNull(row.revokedAt),
    createdAt: iso(row.createdAt),
  };
}

const toMe = (user: repo.UserRow): Me => ({
  id: user.id,
  displayName: user.displayName,
  role: user.role,
});

export type IdentityService = ReturnType<typeof createIdentityService>;

export function createIdentityService(providers: Pick<Infrastructure, 'database' | 'logger'>) {
  const { db } = providers.database;

  return {
    async authenticate(token: string): Promise<AuthUser | null> {
      const found = await repo.findActiveToken(db, sha256(token));
      if (!found) return null;
      const lastSeen = found.token.lastSeenAt?.getTime() ?? 0;
      if (Date.now() - lastSeen > TOUCH_INTERVAL_MS) {
        await repo.touchActivity(db, found.token.id, found.user.id);
      }
      return { id: found.user.id, role: found.user.role, deviceTokenId: found.token.id };
    },

    async getMe(userId: string): Promise<Me> {
      const user = await repo.findUserById(db, userId);
      if (!user) throw new AppError(404, 'user_not_found', '用户不存在');
      return toMe(user);
    },

    async createInvite(
      createdBy: string | null,
      input: CreateInviteRequest,
    ): Promise<CreatedInvite> {
      const code = generateInviteCode();
      const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
      const row = await repo.insertInvite(db, {
        codeHash: sha256(normalizeInviteCode(code)),
        createdBy,
        role: input.role,
        maxUses: input.maxUses,
        expiresAt,
      });
      providers.logger.info({ inviteId: row.id, role: row.role, createdBy }, 'invite created');
      return { invite: toInvite(row), code };
    },

    async redeemInvite(input: RedeemInviteRequest): Promise<RedeemInviteResponse> {
      const token = generateDeviceToken();
      const user = await db.transaction(async (tx) => {
        const invite = await repo.consumeInvite(tx, sha256(normalizeInviteCode(input.code)));
        if (!invite) throw new AppError(400, 'invalid_invite', '邀请码无效、已过期或已用完');
        const created = await repo.insertUser(tx, {
          displayName: input.displayName,
          role: invite.role,
          invitedBy: invite.createdBy,
        });
        await repo.insertDeviceToken(tx, {
          userId: created.id,
          tokenHash: sha256(token),
          kind: 'ios',
          deviceName: input.deviceName,
        });
        return created;
      });
      providers.logger.info({ userId: user.id, role: user.role }, 'invite redeemed');
      return { token, user: toMe(user) };
    },

    /** 命令行签发管理员登录令牌：同名管理员已存在则复用。 */
    async issueAdminToken(displayName: string): Promise<{ token: string; user: Me }> {
      const token = generateDeviceToken();
      const user = await db.transaction(async (tx) => {
        const existing = await repo.findAdminByName(tx, displayName);
        const admin =
          existing ?? (await repo.insertUser(tx, { displayName, role: 'admin', invitedBy: null }));
        await repo.insertDeviceToken(tx, {
          userId: admin.id,
          tokenHash: sha256(token),
          kind: 'admin_web',
          deviceName: '管理端（命令行签发）',
        });
        return admin;
      });
      return { token, user: toMe(user) };
    },

    listInvites: async (): Promise<Invite[]> => (await repo.listInvites(db)).map(toInvite),

    async revokeInvite(id: string): Promise<Invite> {
      const row = await repo.revokeInvite(db, id);
      if (!row) throw new AppError(404, 'invite_not_found', '邀请码不存在');
      return toInvite(row);
    },

    async listUsers(): Promise<UserSummary[]> {
      return (await repo.listUsersWithDevices(db)).map(({ user, devices }) => ({
        ...toMe(user),
        createdAt: iso(user.createdAt),
        lastActiveAt: isoOrNull(user.lastActiveAt),
        devices: devices.map((device) => ({
          id: device.id,
          kind: device.kind,
          deviceName: device.deviceName,
          lastSeenAt: isoOrNull(device.lastSeenAt),
          createdAt: iso(device.createdAt),
        })),
      }));
    },

    async revokeDevice(id: string): Promise<void> {
      if (!(await repo.revokeDeviceToken(db, id))) {
        throw new AppError(404, 'device_not_found', '设备不存在或已撤销');
      }
    },
  };
}
