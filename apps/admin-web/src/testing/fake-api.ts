import { vi } from 'vitest';

type Handler = (body: unknown) => { status?: number; json?: unknown };

/** 按「方法 路径」路由的假服务端，替换全局 fetch。未登记的请求返回 404。 */
export function installFakeApi(routes: Record<string, Handler>) {
  const calls: Array<{ key: string; body: unknown }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${input}`;
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ key, body });
      const handler = routes[key];
      if (!handler) {
        return Response.json(
          { error: { code: 'not_found', message: `no fake for ${key}` } },
          { status: 404 },
        );
      }
      const { status = 200, json } = handler(body);
      return status === 204 ? new Response(null, { status }) : Response.json(json, { status });
    }),
  );
  return calls;
}

export const unauthenticated = () => ({
  status: 401,
  json: { error: { code: 'unauthenticated', message: '请先登录' } },
});

export const ADMIN = {
  id: '00000000-0000-4000-8000-000000000001',
  displayName: '站长',
  role: 'admin',
};

export const PROVIDER = {
  id: '00000000-0000-4000-8000-000000000002',
  name: '中转站',
  baseUrl: 'https://jojocode.com/v1',
  chatModel: 'gpt-6.1-sol',
  embeddingModel: null,
  timeoutMs: 30000,
  apiKeyLast4: 'abcd',
  isActive: true,
  updatedAt: '2026-10-12T10:00:00.000Z',
  capabilities: {
    chat: true,
    structuredOutput: true,
    toolCalling: false,
    embedding: false,
    embeddingDimensions: null,
    checkedAt: '2026-10-12T10:00:00.000Z',
    errors: ['工具调用：模型没有发起工具调用'],
  },
};
