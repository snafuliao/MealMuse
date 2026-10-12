import { OpenAPIHono } from '@hono/zod-openapi';
import type { Providers } from './providers/index.js';
import { systemRoutes } from './domains/system/runtime/routes.js';

export const OPENAPI_INFO = { title: 'MealMuse API', openapi: '3.1.0' } as const;

/** 组合根：把各领域的 runtime 路由挂到 /api 下。 */
export function createApp(providers: Providers) {
  const app = new OpenAPIHono().basePath('/api');
  app.route('/', systemRoutes(providers));
  app.doc31('/openapi.json', {
    openapi: OPENAPI_INFO.openapi,
    info: { title: OPENAPI_INFO.title, version: providers.config.version },
  });
  return app;
}
