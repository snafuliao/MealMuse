import { z } from 'zod';

export const RoleSchema = z.enum(['member', 'admin']).meta({ id: 'Role' });
export type Role = z.infer<typeof RoleSchema>;

export const DisplayNameSchema = z.string().trim().min(1).max(20);

export const MeSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string(),
    role: RoleSchema,
  })
  .meta({ id: 'Me' });
export type Me = z.infer<typeof MeSchema>;

export const RedeemInviteRequestSchema = z
  .object({
    code: z.string().trim().min(1).max(32),
    displayName: DisplayNameSchema,
    deviceName: z.string().trim().min(1).max(60),
  })
  .meta({ id: 'RedeemInviteRequest' });
export type RedeemInviteRequest = z.infer<typeof RedeemInviteRequestSchema>;

export const RedeemInviteResponseSchema = z
  .object({
    token: z.string(),
    user: MeSchema,
  })
  .meta({ id: 'RedeemInviteResponse' });
export type RedeemInviteResponse = z.infer<typeof RedeemInviteResponseSchema>;

export const CreateInviteRequestSchema = z
  .object({
    role: RoleSchema.default('member'),
    maxUses: z.int().min(1).max(20).default(1),
    expiresInDays: z.int().min(1).max(90).default(7),
  })
  .meta({ id: 'CreateInviteRequest' });
export type CreateInviteRequest = z.infer<typeof CreateInviteRequestSchema>;

export const InviteSchema = z
  .object({
    id: z.uuid(),
    role: RoleSchema,
    maxUses: z.int(),
    usedCount: z.int(),
    expiresAt: z.iso.datetime(),
    revokedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Invite' });
export type Invite = z.infer<typeof InviteSchema>;

/** 只在创建时返回一次明文邀请码。 */
export const CreatedInviteSchema = z
  .object({
    invite: InviteSchema,
    code: z.string(),
  })
  .meta({ id: 'CreatedInvite' });
export type CreatedInvite = z.infer<typeof CreatedInviteSchema>;

export const DeviceSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(['ios', 'admin_web']),
    deviceName: z.string(),
    lastSeenAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Device' });
export type Device = z.infer<typeof DeviceSchema>;

export const UserSummarySchema = z
  .object({
    id: z.uuid(),
    displayName: z.string(),
    role: RoleSchema,
    createdAt: z.iso.datetime(),
    lastActiveAt: z.iso.datetime().nullable(),
    devices: z.array(DeviceSchema),
  })
  .meta({ id: 'UserSummary' });
export type UserSummary = z.infer<typeof UserSummarySchema>;

export const AdminLoginRequestSchema = z
  .object({ token: z.string().trim().min(1) })
  .meta({ id: 'AdminLoginRequest' });
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;
