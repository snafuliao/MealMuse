import { HealthStatusSchema } from '@mealmuse/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { fakeProviders, fakeServices } from './testing/fakes.js';

describe('GET /api/health', () => {
  it('reports ok when the database answers', async () => {
    const res = await createApp(fakeServices()).request('/api/health');
    expect(res.status).toBe(200);
    const body = HealthStatusSchema.parse(await res.json());
    expect(body).toEqual({ status: 'ok', version: '9.9.9', checks: { database: 'ok' } });
  });

  it('reports degraded when the database is unreachable', async () => {
    const app = createApp(fakeServices(fakeProviders({ databaseUp: false })));
    const body = HealthStatusSchema.parse(await (await app.request('/api/health')).json());
    expect(body.status).toBe('degraded');
    expect(body.checks.database).toBe('unreachable');
  });
});

describe('GET /api/openapi.json', () => {
  it('documents public and protected operations', async () => {
    const res = await createApp(fakeServices()).request('/api/openapi.json');
    const doc = (await res.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/api/health', '/api/auth/redeem', '/api/admin/model-providers']),
    );
  });
});

describe('authentication gate', () => {
  const services = { ...fakeServices(), identity: { authenticate: async () => null } as never };

  it('rejects protected routes with an unknown token', async () => {
    const res = await createApp(services).request('/api/me', {
      headers: { authorization: 'Bearer nope' },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'unauthenticated', message: '请先登录' } });
  });

  it('rejects admin routes without a token', async () => {
    const res = await createApp(services).request('/api/admin/users');
    expect(res.status).toBe(401);
  });
});
