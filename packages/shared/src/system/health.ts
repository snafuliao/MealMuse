import { z } from 'zod';

export const HealthStatusSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    version: z.string(),
    checks: z.object({
      database: z.enum(['ok', 'unreachable']),
    }),
  })
  .meta({ id: 'HealthStatus' });

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
