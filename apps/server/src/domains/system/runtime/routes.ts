import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { HealthStatusSchema } from '@mealmuse/shared';
import type { Providers } from '../../../providers/index.js';
import { getHealth } from '../service/health.js';

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  operationId: 'getHealth',
  tags: ['system'],
  summary: '服务健康状态',
  responses: {
    200: {
      description: '服务存活；数据库不可达时 status 为 degraded',
      content: { 'application/json': { schema: HealthStatusSchema } },
    },
  },
});

export function systemRoutes(providers: Providers) {
  return new OpenAPIHono().openapi(healthRoute, async (c) =>
    c.json(await getHealth(providers), 200),
  );
}
