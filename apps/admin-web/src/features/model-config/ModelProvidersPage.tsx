import type { ModelProvider } from '@mealmuse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { modelProviders } from '../../api/client';
import { ProviderCard } from './ProviderCard';
import { ProviderForm, type ProviderFormValues } from './ProviderForm';
import { UsageTable } from './UsageTable';

type Editing = { mode: 'create' } | { mode: 'edit'; provider: ModelProvider } | null;

export function ModelProvidersPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing>(null);
  const providers = useQuery({ queryKey: ['model-providers'], queryFn: modelProviders.list });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['model-providers'] });

  const save = useMutation({
    mutationFn: async (values: ProviderFormValues) => {
      if (editing?.mode !== 'edit') return modelProviders.create(values);
      const { apiKey, ...rest } = values;
      return modelProviders.update(editing.provider.id, apiKey ? values : rest);
    },
    onSuccess: async () => {
      setEditing(null);
      await refresh();
    },
  });
  const action = useMutation({
    mutationFn: ({ kind, id }: { kind: 'test' | 'activate' | 'remove'; id: string }) =>
      modelProviders[kind](id),
    onSettled: refresh,
  });

  return (
    <section>
      <header className="row">
        <h2>模型供应商</h2>
        <span className="spacer" />
        {!editing && (
          <button type="button" onClick={() => setEditing({ mode: 'create' })}>
            新增供应商
          </button>
        )}
      </header>
      <p className="hint">
        只支持 OpenAI 兼容接口。同一时间只有一个供应商启用；修改连接参数后需要重新测试连接。
      </p>
      {editing && (
        <ProviderForm
          {...(editing.mode === 'edit' ? { initial: editing.provider } : {})}
          submitting={save.isPending}
          error={save.isError ? save.error.message : null}
          onSubmit={(values) => save.mutate(values)}
          onCancel={() => setEditing(null)}
        />
      )}
      {action.isError && <p role="alert">{action.error.message}</p>}
      {providers.isPending && <p className="hint">加载中…</p>}
      {providers.isError && <p role="alert">{providers.error.message}</p>}
      {providers.data?.length === 0 && !editing && <p className="hint">还没有配置模型供应商。</p>}
      <div className="grid">
        {providers.data?.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            busy={action.isPending && action.variables.id === provider.id}
            onTest={() => action.mutate({ kind: 'test', id: provider.id })}
            onActivate={() => action.mutate({ kind: 'activate', id: provider.id })}
            onEdit={() => setEditing({ mode: 'edit', provider })}
            onDelete={() => {
              if (window.confirm(`删除「${provider.name}」？`))
                action.mutate({ kind: 'remove', id: provider.id });
            }}
          />
        ))}
      </div>
      <h2>近 7 天用量</h2>
      <UsageTable />
    </section>
  );
}
