import { OpenAPIHono } from '@hono/zod-openapi';
import type { ErrorResponse } from '@mealmuse/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import type { AppServices } from './composition.js';
import { identityRoutes } from './domains/identity/runtime/routes.js';
import { modelConfigRoutes } from './domains/model-config/runtime/routes.js';
import { systemRoutes } from './domains/system/runtime/routes.js';
import { AppError, requireAdmin, requireAuth, type AppEnv } from './providers/http.js';
import { LlmError } from './providers/llm/types.js';
import { SecretsUnavailableError } from './providers/secrets.js';

export const OPENAPI_INFO = { title: 'MealMuse API', openapi: '3.1.0' } as const;

/** 不需要登录的接口；其余 /api 下的接口都要求设备令牌。 */
const PUBLIC_ROUTES = new Set([
  'GET /api/health',
  'GET /api/openapi.json',
  'POST /api/auth/redeem',
  'POST /api/admin/session',
]);

const body = (code: string, message: string): ErrorResponse => ({ error: { code, message } });

/** 组合根：挂载鉴权、错误处理与各领域路由。 */
export function createApp(services: AppServices) {
  const { providers } = services;
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(body('invalid_request', z.prettifyError(result.error)), 400);
      }
    },
  }).basePath('/api');

  const auth = requireAuth((token) => services.identity.authenticate(token));
  const admin = requireAdmin();
  app.use('*', (c, next) =>
    PUBLIC_ROUTES.has(`${c.req.method} ${c.req.path}`) ? next() : auth(c, next),
  );
  app.use('/admin/*', (c, next) =>
    PUBLIC_ROUTES.has(`${c.req.method} ${c.req.path}`) ? next() : admin(c, next),
  );

  app.onError((error, c) => {
    if (error instanceof AppError) return c.json(body(error.code, error.message), error.status);
    if (error instanceof LlmError) {
      const status: ContentfulStatusCode = error.code === 'not_configured' ? 503 : 502;
      return c.json(body(`llm_${error.code}`, error.message), status);
    }
    if (error instanceof SecretsUnavailableError) {
      return c.json(body('secrets_unavailable', error.message), 503);
    }
    providers.logger.error({ err: error, path: c.req.path }, 'unhandled error');
    return c.json(body('internal_error', '服务器内部错误'), 500);
  });

  app.route('/', systemRoutes(providers));
  app.route('/', identityRoutes(services.identity, providers));
  app.route('/', modelConfigRoutes(services.modelConfig));

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearer', {
    type: 'http',
    scheme: 'bearer',
    description: '设备令牌（iOS）；管理端使用同一令牌的 HttpOnly Cookie',
  });
  app.doc31('/openapi.json', {
    openapi: OPENAPI_INFO.openapi,
    info: { title: OPENAPI_INFO.title, version: providers.config.version },
  });
  return app;
}
