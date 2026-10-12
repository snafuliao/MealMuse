import { HealthStatusSchema, type HealthStatus } from '@mealmuse/shared';

/** 所有服务端响应在这里按共享 schema 解析，UI 层只拿到已校验的数据。 */
export async function fetchHealth(fetchImpl: typeof fetch = fetch): Promise<HealthStatus> {
  const res = await fetchImpl('/api/health');
  if (!res.ok) {
    throw new Error(`health request failed with HTTP ${res.status}`);
  }
  return HealthStatusSchema.parse(await res.json());
}
