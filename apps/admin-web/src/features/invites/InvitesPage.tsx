import type { CreatedInvite, Invite } from '@mealmuse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { invites } from '../../api/client';
import { UsersPanel } from './UsersPanel';

const formatTime = (iso: string) => new Date(iso).toLocaleString('zh-CN');

function inviteState(invite: Invite): string {
  if (invite.revokedAt) return '已撤销';
  if (new Date(invite.expiresAt) < new Date()) return '已过期';
  if (invite.usedCount >= invite.maxUses) return '已用完';
  return '可用';
}

export function InvitesPage() {
  const queryClient = useQueryClient();
  const [maxUses, setMaxUses] = useState('1');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const list = useQuery({ queryKey: ['invites'], queryFn: invites.list });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['invites'] });

  const create = useMutation({
    mutationFn: () =>
      invites.create({
        role: 'member',
        maxUses: Number(maxUses),
        expiresInDays: Number(expiresInDays),
      }),
    onSuccess: async (result) => {
      setCreated(result);
      await refresh();
    },
  });
  const revoke = useMutation({ mutationFn: invites.revoke, onSettled: refresh });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <section>
      <h2>邀请码</h2>
      <form className="card row" onSubmit={submit}>
        <label>
          可用次数
          <input
            type="number"
            min={1}
            max={20}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
        </label>
        <label>
          有效天数
          <input
            type="number"
            min={1}
            max={90}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
          />
        </label>
        <button type="submit" disabled={create.isPending}>
          生成邀请码
        </button>
      </form>
      {create.isError && <p role="alert">{create.error.message}</p>}
      {created && (
        <div className="card highlight" role="status">
          <p>
            邀请码：<strong className="code">{created.code}</strong>
          </p>
          <p className="hint">只显示这一次。发给朋友，在 App 首次打开时输入。</p>
        </div>
      )}
      {list.isError && <p role="alert">{list.error.message}</p>}
      <table>
        <thead>
          <tr>
            <th>状态</th>
            <th>已用 / 次数</th>
            <th>过期时间</th>
            <th>创建时间</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.data?.map((invite) => (
            <tr key={invite.id}>
              <td>{inviteState(invite)}</td>
              <td>
                {invite.usedCount} / {invite.maxUses}
              </td>
              <td>{formatTime(invite.expiresAt)}</td>
              <td>{formatTime(invite.createdAt)}</td>
              <td>
                {inviteState(invite) === '可用' && (
                  <button type="button" className="link" onClick={() => revoke.mutate(invite.id)}>
                    撤销
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <UsersPanel />
    </section>
  );
}
