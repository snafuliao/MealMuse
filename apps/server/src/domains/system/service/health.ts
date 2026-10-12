import type { HealthStatus } from '@mealmuse/shared';
import type { Providers } from '../../../providers/index.js';

export async function getHealth(providers: Providers): Promise<HealthStatus> {
  const databaseOk = await providers.database.ping();
  return {
    status: databaseOk ? 'ok' : 'degraded',
    version: providers.config.version,
    checks: { database: databaseOk ? 'ok' : 'unreachable' },
  };
}
