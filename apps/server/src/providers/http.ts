import type { Role } from '@mealmuse/shared';
import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';

export const SESSION_COOKIE = 'mm_session';

/** 经过鉴权的调用方。由鉴权中间件写入请求上下文。 */
export type AuthUser = {
  id: string;
  role: Role;
  deviceTokenId: string;
};

export type AppEnv = { Variables: { user: AuthUser } };

export type Authenticator = (token: string) => Promise<AuthUser | null>;

/** 业务错误：路由层统一转换成 ErrorResponse。 */
export class AppError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 502 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function extractToken(header: string | undefined, cookie: string | undefined): string | null {
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim() || null;
  return cookie ?? null;
}

/** 鉴权：Authorization: Bearer（iOS）或 HttpOnly Cookie（管理端）。 */
export function requireAuth(authenticate: Authenticator): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = extractToken(c.req.header('authorization'), getCookie(c, SESSION_COOKIE));
    const user = token ? await authenticate(token) : null;
    if (!user) throw new AppError(401, 'unauthenticated', '请先登录');
    c.set('user', user);
    await next();
  };
}

export function requireAdmin(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.get('user').role !== 'admin') throw new AppError(403, 'forbidden', '需要管理员权限');
    await next();
  };
}

/** 简单的内存限流（单实例部署足够）：每个 key 在窗口内最多 limit 次。 */
export function rateLimit(options: {
  limit: number;
  windowMs: number;
  key: (ip: string) => string;
}): MiddlewareHandler<AppEnv> {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    const key = options.key(ip);
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
    } else if (++entry.count > options.limit) {
      throw new AppError(429, 'rate_limited', '请求太频繁，请稍后再试');
    }
    await next();
  };
}
