import { ErrorResponseSchema } from '@mealmuse/shared';
import type { z } from 'zod';

/** 服务端返回的业务错误（ErrorResponse），或网络层错误。 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * 管理端唯一的请求入口：同源 Cookie 鉴权；成功响应按 schema 解析，失败统一抛 ApiError。
 * schema 为 null 表示期望 204 无内容。
 */
export async function request<T>(
  method: Method,
  path: string,
  schema: z.ZodType<T> | null,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, 'network', '无法连接服务端');
  }
  if (!res.ok) {
    const parsed = ErrorResponseSchema.safeParse(await res.json().catch(() => null));
    throw parsed.success
      ? new ApiError(res.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiError(res.status, 'http_error', `请求失败（HTTP ${res.status}）`);
  }
  if (schema === null) return undefined as T;
  return schema.parse(await res.json());
}

export const isUnauthenticated = (error: unknown) =>
  error instanceof ApiError && error.status === 401;
