import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { auth, isUnauthenticated } from './api/client';
import { LoginPage } from './features/auth/LoginPage';
import { InvitesPage } from './features/invites/InvitesPage';
import { ModelProvidersPage } from './features/model-config/ModelProvidersPage';
import { RecipesPage } from './features/recipes/RecipesPage';
import { HealthBadge } from './features/system/HealthBadge';

const TABS = [
  { id: 'models', label: '模型配置' },
  { id: 'invites', label: '邀请与用户' },
  { id: 'recipes', label: '菜谱管理' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function App() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>('models');
  const me = useQuery({ queryKey: ['me'], queryFn: auth.me, retry: false });
  const logout = useMutation({
    mutationFn: auth.logout,
    onSettled: () => queryClient.clear(),
  });

  if (me.isPending) return <main className="loading">加载中…</main>;
  if (me.isError && isUnauthenticated(me.error)) return <LoginPage />;
  if (me.isError) return <main role="alert">{me.error.message}</main>;

  return (
    <div className="shell">
      <header>
        <h1>MealMuse 管理端</h1>
        <HealthBadge />
        <span className="spacer" />
        <span>{me.data.displayName}</span>
        <button type="button" className="link" onClick={() => logout.mutate()}>
          退出
        </button>
      </header>
      <nav>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === tab ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'models' && <ModelProvidersPage />}
        {tab === 'invites' && <InvitesPage />}
        {tab === 'recipes' && <RecipesPage />}
      </main>
    </div>
  );
}
