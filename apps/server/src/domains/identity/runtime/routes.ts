import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  AdminLoginRequestSchema,
  CreatedInviteSchema,
  CreateInviteRequestSchema,
  InviteSchema,
  MeSchema,
  RedeemInviteRequestSchema,
  RedeemInviteResponseSchema,
  UserSummarySchema,
} from '@mealmuse/shared';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { AppError, rateLimit, SESSION_COOKIE, type AppEnv } from '../../../providers/http.js';
import type { Providers } from '../../../providers/index.js';
import { BEARER_SECURITY, errors, json, jsonBody, noContent } from '../../../providers/openapi.js';
import type { IdentityService } from '../service/identity-service.js';

const IdParams = z.object({ id: z.uuid() });
const tags = ['identity'];

const redeem = createRoute({
  method: 'post',
  path: '/auth/redeem',
  operationId: 'redeemInvite',
  tags,
  summary: '用邀请码注册，返回设备令牌（只返回一次）',
  request: jsonBody(RedeemInviteRequestSchema),
  responses: { 200: json(RedeemInviteResponseSchema, '注册成功'), ...errors(400, 429) },
});
const me = createRoute({
  method: 'get',
  path: '/me',
  operationId: 'getMe',
  tags,
  security: BEARER_SECURITY,
  summary: '当前用户',
  responses: { 200: json(MeSchema, '当前用户'), ...errors(401) },
});
const logout = createRoute({
  method: 'delete',
  path: '/auth/session',
  operationId: 'logout',
  tags,
  security: BEARER_SECURITY,
  summary: '撤销当前设备令牌',
  responses: { ...noContent, ...errors(401) },
});
const adminLogin = createRoute({
  method: 'post',
  path: '/admin/session',
  operationId: 'adminLogin',
  tags: ['admin'],
  summary: '管理端登录：校验管理员令牌并写入 HttpOnly Cookie',
  request: jsonBody(AdminLoginRequestSchema),
  responses: { 200: json(MeSchema, '登录成功'), ...errors(401, 403, 429) },
});
const createInvite = createRoute({
  method: 'post',
  path: '/admin/invites',
  operationId: 'createInvite',
  tags: ['admin'],
  security: BEARER_SECURITY,
  summary: '生成邀请码（明文只返回一次）',
  request: jsonBody(CreateInviteRequestSchema),
  responses: { 200: json(CreatedInviteSchema, '已生成'), ...errors(400, 401, 403) },
});
const listInvites = createRoute({
  method: 'get',
  path: '/admin/invites',
  operationId: 'listInvites',
  tags: ['admin'],
  security: BEARER_SECURITY,
  summary: '邀请码列表（最近 100 条）',
  responses: { 200: json(z.array(InviteSchema), '邀请码列表'), ...errors(401, 403) },
});
const revokeInvite = createRoute({
  method: 'post',
  path: '/admin/invites/{id}/revoke',
  operationId: 'revokeInvite',
  tags: ['admin'],
  security: BEARER_SECURITY,
  summary: '撤销邀请码',
  request: { params: IdParams },
  responses: { 200: json(InviteSchema, '已撤销'), ...errors(401, 403, 404) },
});
const listUsers = createRoute({
  method: 'get',
  path: '/admin/users',
  operationId: 'listUsers',
  tags: ['admin'],
  security: BEARER_SECURITY,
  summary: '用户与设备',
  responses: { 200: json(z.array(UserSummarySchema), '用户列表'), ...errors(401, 403) },
});
const revokeDevice = createRoute({
  method: 'post',
  path: '/admin/devices/{id}/revoke',
  operationId: 'revokeDevice',
  tags: ['admin'],
  security: BEARER_SECURITY,
  summary: '撤销某台设备的令牌',
  request: { params: IdParams },
  responses: { ...noContent, ...errors(401, 403, 404) },
});

const loginLimit = { limit: 10, windowMs: 60_000 };

export function identityRoutes(service: IdentityService, providers: Pick<Providers, 'config'>) {
  const secure = providers.config.environment === 'production';
  const app = new OpenAPIHono<AppEnv>();
  app.use('/auth/redeem', rateLimit({ ...loginLimit, key: (ip) => `redeem:${ip}` }));
  app.use('/admin/session', rateLimit({ ...loginLimit, key: (ip) => `admin-login:${ip}` }));
  return app
    .openapi(redeem, async (c) => c.json(await service.redeemInvite(c.req.valid('json')), 200))
    .openapi(me, async (c) => c.json(await service.getMe(c.get('user').id), 200))
    .openapi(logout, async (c) => {
      await service.revokeDevice(c.get('user').deviceTokenId);
      deleteCookie(c, SESSION_COOKIE, { path: '/api' });
      return c.body(null, 204);
    })
    .openapi(adminLogin, async (c) => {
      const { token } = c.req.valid('json');
      const user = await service.authenticate(token);
      if (!user) throw new AppError(401, 'unauthenticated', '令牌无效或已撤销');
      if (user.role !== 'admin') throw new AppError(403, 'forbidden', '需要管理员令牌');
      setCookie(c, SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'Strict',
        path: '/api',
        secure,
        maxAge: 30 * 24 * 60 * 60,
      });
      return c.json(await service.getMe(user.id), 200);
    })
    .openapi(createInvite, async (c) =>
      c.json(await service.createInvite(c.get('user').id, c.req.valid('json')), 200),
    )
    .openapi(listInvites, async (c) => c.json(await service.listInvites(), 200))
    .openapi(revokeInvite, async (c) =>
      c.json(await service.revokeInvite(c.req.valid('param').id), 200),
    )
    .openapi(listUsers, async (c) => c.json(await service.listUsers(), 200))
    .openapi(revokeDevice, async (c) => {
      await service.revokeDevice(c.req.valid('param').id);
      return c.body(null, 204);
    });
}
