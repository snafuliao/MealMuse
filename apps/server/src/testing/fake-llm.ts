import type { FetchLike } from '../providers/llm/http.js';

export type FakeCall = { url: string; body: Record<string, unknown>; authorization: string | null };
type Reply = { status?: number; json?: unknown } | Error;

/** 模拟 OpenAI 兼容接口：按顺序返回预设响应，并记录每次请求。 */
export function fakeOpenAi(replies: Reply[]): { fetch: FetchLike; calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  const queue = [...replies];
  const fetchImpl: FetchLike = async (url, init) => {
    const headers = new Headers(init.headers);
    calls.push({
      url,
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
      authorization: headers.get('authorization'),
    });
    const reply = queue.shift();
    if (!reply) throw new Error(`fake llm: unexpected request to ${url}`);
    if (reply instanceof Error) throw reply;
    return Response.json(reply.json ?? {}, { status: reply.status ?? 200 });
  };
  return { fetch: fetchImpl, calls };
}

export const chatReply = (
  content: string,
  usage = { prompt_tokens: 10, completion_tokens: 5 },
) => ({
  json: { choices: [{ message: { content } }], usage },
});

export const toolReply = (name: string) => ({
  json: {
    choices: [
      { message: { content: null, tool_calls: [{ function: { name, arguments: '{}' } }] } },
    ],
  },
});
