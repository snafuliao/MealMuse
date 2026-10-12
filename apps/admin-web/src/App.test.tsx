import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the server version when healthy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ status: 'ok', version: '0.1.0', checks: { database: 'ok' } }),
      ),
    );
    renderApp();
    expect(await screen.findByText('服务 正常 · v0.1.0')).toBeTruthy();
  });

  it('reports an unreachable server when the payload is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ status: 'great' })),
    );
    renderApp();
    expect(await screen.findByText('服务不可达')).toBeTruthy();
  });
});
