import {
  CreatedInviteSchema,
  MeSchema,
  RedeemInviteResponseSchema,
  UserSummarySchema,
} from '@mealmuse/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../../app.js';
import { composeServices } from '../../composition.js';
import { createTestInfrastructure, resetDatabase } from '../../testing/database.js';

const infrastructure = createTestInfrastructure();
const services = composeServices(infrastructure);
const app = createApp(services);

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

async function adminCookie(): Promise<string> {
  const { token } = await services.identity.issueAdminToken('站长');
  const res = await post('/api/admin/session', { token });
  expect(res.status).toBe(200);
  const cookie = res.headers.get('set-cookie') ?? '';
  expect(cookie).toContain('HttpOnly');
  return cookie.split(';')[0] ?? '';
}

async function createInvite(cookie: string, body: object = {}) {
  const res = await post('/api/admin/invites', body, { cookie });
  expect(res.status).toBe(200);
  return CreatedInviteSchema.parse(await res.json());
}

const redeem = (code: string, displayName = '小明') =>
  post('/api/auth/redeem', { code, displayName, deviceName: 'iPhone 18 Pro' });

beforeEach(() => resetDatabase(infrastructure));
afterAll(() => infrastructure.database.close());

describe('invite → register → authenticated requests', () => {
  it('lets a friend register with an invite and use the token', async () => {
    const cookie = await adminCookie();
    const { code } = await createInvite(cookie);
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    // 输入时大小写与连字符都可以随意。
    const res = await redeem(code.toLowerCase().replace('-', ''));
    expect(res.status).toBe(200);
    const { token, user } = RedeemInviteResponseSchema.parse(await res.json());
    expect(user).toMatchObject({ displayName: '小明', role: 'member' });

    const me = await app.request('/api/me', { headers: bearer(token) });
    expect(MeSchema.parse(await me.json()).id).toBe(user.id);
  });

  it('rejects a used-up, revoked or unknown invite', async () => {
    const cookie = await adminCookie();
    const single = await createInvite(cookie, { maxUses: 1 });
    expect((await redeem(single.code)).status).toBe(200);
    expect((await redeem(single.code, '小红')).status).toBe(400);

    const revoked = await createInvite(cookie);
    const revoke = await post(`/api/admin/invites/${revoked.invite.id}/revoke`, {}, { cookie });
    expect(revoke.status).toBe(200);
    expect((await redeem(revoked.code)).status).toBe(400);

    const unknown = await redeem('ZZZZ-ZZZZ');
    expect(await unknown.json()).toMatchObject({ error: { code: 'invalid_invite' } });
  });

  it('does not store invite codes or tokens in plain text', async () => {
    const cookie = await adminCookie();
    const { code } = await createInvite(cookie);
    const { token } = RedeemInviteResponseSchema.parse(await (await redeem(code)).json());
    const dump = JSON.stringify(
      await infrastructure.database.db.execute(
        sql`select code_hash as v from invite_codes union all select token_hash from device_tokens`,
      ),
    );
    expect(dump).not.toContain(code.replace('-', ''));
    expect(dump).not.toContain(token);
  });
});

describe('authorization', () => {
  it('keeps members out of admin routes', async () => {
    const { code } = await createInvite(await adminCookie());
    const { token } = RedeemInviteResponseSchema.parse(await (await redeem(code)).json());
    const res = await app.request('/api/admin/users', { headers: bearer(token) });
    expect(res.status).toBe(403);
    expect((await post('/api/admin/session', { token })).status).toBe(403);
  });

  it('stops accepting a token once its device is revoked', async () => {
    const cookie = await adminCookie();
    const { code } = await createInvite(cookie);
    const { token, user } = RedeemInviteResponseSchema.parse(await (await redeem(code)).json());

    const users = z
      .array(UserSummarySchema)
      .parse(await (await app.request('/api/admin/users', { headers: { cookie } })).json());
    const device = users.find((u) => u.id === user.id)?.devices[0];
    expect(device?.deviceName).toBe('iPhone 18 Pro');

    expect((await post(`/api/admin/devices/${device?.id}/revoke`, {}, { cookie })).status).toBe(
      204,
    );
    expect((await app.request('/api/me', { headers: bearer(token) })).status).toBe(401);
  });

  it('logs a device out', async () => {
    const { code } = await createInvite(await adminCookie());
    const { token } = RedeemInviteResponseSchema.parse(await (await redeem(code)).json());
    const res = await app.request('/api/auth/session', {
      method: 'DELETE',
      headers: bearer(token),
    });
    expect(res.status).toBe(204);
    expect((await app.request('/api/me', { headers: bearer(token) })).status).toBe(401);
  });

  it('validates request bodies at the boundary', async () => {
    const res = await post('/api/auth/redeem', { code: 'X', displayName: '', deviceName: 'p' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'invalid_request' } });
  });
});
