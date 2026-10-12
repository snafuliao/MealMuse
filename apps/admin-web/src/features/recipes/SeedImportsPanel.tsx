import type { SeedImportItem } from '@mealmuse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { seedImports } from '../../api/client';
import { formatTime, options, SEED_STATUS_LABELS } from './labels';

type Status = SeedImportItem['status'];

/** 种子导入记录：查看失败原因，单条重新导入（会调用模型，约 30–90 秒）。 */
export function SeedImportsPanel({ onOpenRecipe }: { onOpenRecipe(id: string): void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status | ''>('');
  const list = useQuery({
    queryKey: ['seed-imports', status],
    queryFn: () => seedImports.list(status || undefined),
  });
  const retry = useMutation({
    mutationFn: seedImports.retry,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['seed-imports'] });
      await queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
  const counts = list.data?.reduce<Partial<Record<Status, number>>>(
    (acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }),
    {},
  );

  return (
    <>
      <div className="card row filters">
        <label>
          状态
          <select value={status} onChange={(e) => setStatus(e.target.value as Status | '')}>
            <option value="">全部</option>
            {options(SEED_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="hint">
          {counts
            ? options(SEED_STATUS_LABELS)
                .map(([value, label]) => `${label} ${counts[value] ?? 0}`)
                .join(' · ')
            : '加载中…'}
        </span>
      </div>
      <p className="hint">
        批量导入用命令行 <code>pnpm --filter @mealmuse/server seed:import</code>
        ；这里只处理单条失败的记录。已导入的菜请直接在菜谱列表里修改。
      </p>
      {list.isError && <p role="alert">{list.error.message}</p>}
      {retry.isError && <p role="alert">{retry.error.message}</p>}
      <table>
        <thead>
          <tr>
            <th>源文件</th>
            <th>状态</th>
            <th>错误</th>
            <th>批次</th>
            <th>时间</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.data?.map((item) => (
            <tr key={item.id}>
              <td>{item.sourcePath}</td>
              <td>{SEED_STATUS_LABELS[item.status]}</td>
              <td className="errors">{item.error ?? ''}</td>
              <td>{item.batch}</td>
              <td>{formatTime(item.createdAt)}</td>
              <td>
                {item.recipeId ? (
                  <button
                    type="button"
                    className="link"
                    onClick={() => item.recipeId && onOpenRecipe(item.recipeId)}
                  >
                    查看菜谱
                  </button>
                ) : (
                  <button
                    type="button"
                    className="link"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(item.id)}
                  >
                    {retry.isPending && retry.variables === item.id ? '导入中…' : '重新导入'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
