import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../../api/client';

export function HealthBadge() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => fetchHealth(),
  });

  if (isPending) return <span role="status">检查服务中…</span>;
  if (isError) return <span role="status">服务不可达</span>;
  return (
    <span role="status">
      服务 {data.status === 'ok' ? '正常' : '降级'} · v{data.version}
    </span>
  );
}
