import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ADMIN, installFakeApi, PROVIDER, unauthenticated } from './testing/fake-api';

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

const loggedIn = {
  'GET /api/me': () => ({ json: ADMIN }),
  'GET /api/health': () => ({
    json: { status: 'ok', version: '0.1.0', checks: { database: 'ok' } },
  }),
  'GET /api/admin/model-providers': () => ({ json: [PROVIDER] }),
  'GET /api/admin/llm-usage?days=7': () => ({ json: [] }),
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('login', () => {
  it('asks for an admin token, then shows the console', async () => {
    let authed = false;
    const calls = installFakeApi({
      ...loggedIn,
      'GET /api/me': () => (authed ? { json: ADMIN } : unauthenticated()),
      'POST /api/admin/session': () => {
        authed = true;
        return { json: ADMIN };
      },
    });
    renderApp();
    fireEvent.change(await screen.findByLabelText('管理员登录令牌'), {
      target: { value: 'mm_token' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    expect(await screen.findByText('站长')).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/admin/session')?.body).toEqual({
      token: 'mm_token',
    });
  });

  it('shows the server error for a wrong token', async () => {
    installFakeApi({
      'GET /api/me': unauthenticated,
      'POST /api/admin/session': () => ({
        status: 403,
        json: { error: { code: 'forbidden', message: '需要管理员令牌' } },
      }),
    });
    renderApp();
    fireEvent.change(await screen.findByLabelText('管理员登录令牌'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    expect((await screen.findByRole('alert')).textContent).toBe('需要管理员令牌');
  });
});

describe('model providers', () => {
  it('shows probed capabilities without ever showing the key', async () => {
    installFakeApi(loggedIn);
    renderApp();
    const card = await screen.findByRole('article', { name: '中转站' });
    expect(within(card).getByText('启用中')).toBeTruthy();
    expect(within(card).getByText(/✔ 结构化输出/)).toBeTruthy();
    expect(within(card).getByText(/✖ 工具调用/)).toBeTruthy();
    expect(within(card).getByText('····abcd')).toBeTruthy();
  });

  it('omits the API key from an edit when the field is left empty', async () => {
    const calls = installFakeApi({
      ...loggedIn,
      [`PATCH /api/admin/model-providers/${PROVIDER.id}`]: () => ({ json: PROVIDER }),
    });
    renderApp();
    const card = await screen.findByRole('article', { name: '中转站' });
    fireEvent.click(within(card).getByRole('button', { name: '编辑' }));
    fireEvent.click(await screen.findByRole('button', { name: '保存' }));
    await vi.waitFor(() => expect(calls.some((c) => c.key.startsWith('PATCH'))).toBe(true));
    const body = calls.find((c) => c.key.startsWith('PATCH'))?.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('apiKey');
    expect(body['chatModel']).toBe('gpt-6.1-sol');
  });
});

describe('invites', () => {
  it('shows a freshly created invite code once', async () => {
    installFakeApi({
      ...loggedIn,
      'GET /api/admin/invites': () => ({ json: [] }),
      'GET /api/admin/users': () => ({ json: [] }),
      'POST /api/admin/invites': () => ({
        json: {
          code: 'ABCD-2345',
          invite: {
            id: '00000000-0000-4000-8000-000000000003',
            role: 'member',
            maxUses: 1,
            usedCount: 0,
            expiresAt: '2026-10-19T10:00:00.000Z',
            revokedAt: null,
            createdAt: '2026-10-12T10:00:00.000Z',
          },
        },
      }),
    });
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: '邀请与用户' }));
    fireEvent.click(await screen.findByRole('button', { name: '生成邀请码' }));
    expect(await screen.findByText('ABCD-2345')).toBeTruthy();
    expect(screen.getByText(/只显示这一次/)).toBeTruthy();
  });
});
