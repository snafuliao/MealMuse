import { HealthStatusSchema } from '@mealmuse/shared';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { Providers } from './providers/index.js';

function fakeProviders(databaseUp: boolean): Providers {
  return {
    config: { databaseUrl: 'postgres://unused', port: 0, logLevel: 'silent', version: '9.9.9' },
    logger: pino({ level: 'silent' }),
    database: { ping: async () => databaseUp },
  };
}

describe('GET /api/health', () => {
  it('reports ok when the database answers', async () => {
    const res = await createApp(fakeProviders(true)).request('/api/health');
    expect(res.status).toBe(200);
    const body = HealthStatusSchema.parse(await res.json());
    expect(body).toEqual({ status: 'ok', version: '9.9.9', checks: { database: 'ok' } });
  });

  it('reports degraded when the database is unreachable', async () => {
    const res = await createApp(fakeProviders(false)).request('/api/health');
    const body = HealthStatusSchema.parse(await res.json());
    expect(body.status).toBe('degraded');
    expect(body.checks.database).toBe('unreachable');
  });
});

describe('GET /api/openapi.json', () => {
  it('documents the health operation', async () => {
    const res = await createApp(fakeProviders(true)).request('/api/openapi.json');
    const doc = (await res.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toContain('/api/health');
  });
});
