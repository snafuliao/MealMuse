import { ErrorResponseSchema } from '@mealmuse/shared';
import type { z } from 'zod';

const ERROR_DESCRIPTIONS = {
  400: '请求不合法',
  401: '未登录或令牌无效',
  403: '没有权限',
  404: '资源不存在',
  429: '请求太频繁',
  502: '模型服务出错',
  503: '服务端配置不完整',
} as const;

export type ErrorStatus = keyof typeof ERROR_DESCRIPTIONS;

export function json<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } };
}

export function jsonBody<T extends z.ZodType>(schema: T) {
  return { body: { content: { 'application/json': { schema } }, required: true } };
}

/** 路由文档里的错误响应，统一使用 ErrorResponse。 */
export function errors<S extends ErrorStatus>(...statuses: S[]) {
  return Object.fromEntries(
    statuses.map((status) => [status, json(ErrorResponseSchema, ERROR_DESCRIPTIONS[status])]),
  ) as Record<S, ReturnType<typeof json<typeof ErrorResponseSchema>>>;
}

export const BEARER_SECURITY = [{ bearer: [] }];

export const noContent = { 204: { description: '成功，无返回内容' } };
