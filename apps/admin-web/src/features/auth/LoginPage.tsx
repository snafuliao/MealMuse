import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { auth } from '../../api/client';

export function LoginPage() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const login = useMutation({
    mutationFn: auth.login,
    onSuccess: (me) => queryClient.setQueryData(['me'], me),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate(token.trim());
  };

  return (
    <main className="login">
      <h1>MealMuse 管理端</h1>
      <form onSubmit={submit} className="card">
        <label>
          管理员登录令牌
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="mm_..."
            autoComplete="off"
            required
          />
        </label>
        <p className="hint">
          在仓库根运行 <code>pnpm --filter @mealmuse/server admin:token --name 你的名字</code>{' '}
          获取。
        </p>
        {login.isError && <p role="alert">{login.error.message}</p>}
        <button type="submit" disabled={login.isPending}>
          {login.isPending ? '登录中…' : '登录'}
        </button>
      </form>
    </main>
  );
}
