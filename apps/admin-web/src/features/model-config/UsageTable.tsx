import type { LlmPurpose } from '@mealmuse/shared';
import { useQuery } from '@tanstack/react-query';
import { modelProviders } from '../../api/client';

const PURPOSE_LABELS: Record<LlmPurpose, string> = {
  recommend: '每日推荐',
  swap: '换菜',
  generate_recipe: '新菜生成',
  chat: '问答',
  embedding: 'Embedding',
  structure_seed: '种子结构化',
  probe: '测试连接',
};

export function UsageTable() {
  const usage = useQuery({ queryKey: ['llm-usage'], queryFn: () => modelProviders.usage(7) });
  if (usage.isPending) return <p className="hint">加载用量…</p>;
  if (usage.isError) return <p role="alert">{usage.error.message}</p>;
  if (usage.data.length === 0) return <p className="hint">近 7 天还没有模型调用。</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>用途</th>
          <th>调用</th>
          <th>失败率</th>
          <th>平均耗时</th>
          <th>输入 / 输出 token</th>
        </tr>
      </thead>
      <tbody>
        {usage.data.map((row) => (
          <tr key={row.purpose}>
            <td>{PURPOSE_LABELS[row.purpose]}</td>
            <td>{row.calls}</td>
            <td>{row.calls ? `${Math.round((row.failures / row.calls) * 100)}%` : '—'}</td>
            <td>{(row.avgLatencyMs / 1000).toFixed(1)} 秒</td>
            <td>
              {row.inputTokens.toLocaleString()} / {row.outputTokens.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
