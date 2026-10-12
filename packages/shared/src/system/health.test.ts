import { describe, expect, it } from 'vitest';
import { HealthStatusSchema } from './health.js';

describe('HealthStatusSchema', () => {
  it('accepts a well-formed payload', () => {
    const parsed = HealthStatusSchema.parse({
      status: 'ok',
      version: '0.1.0',
      checks: { database: 'ok' },
    });
    expect(parsed.status).toBe('ok');
  });

  it('rejects an unknown status', () => {
    const result = HealthStatusSchema.safeParse({
      status: 'great',
      version: '0.1.0',
      checks: { database: 'ok' },
    });
    expect(result.success).toBe(false);
  });
});
