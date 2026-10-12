import type { ModelProvider } from '@mealmuse/shared';

type Props = {
  provider: ModelProvider;
  busy: boolean;
  onTest(): void;
  onActivate(): void;
  onEdit(): void;
  onDelete(): void;
};

const CAPABILITIES = [
  ['chat', '对话'],
  ['structuredOutput', '结构化输出'],
  ['toolCalling', '工具调用'],
  ['embedding', 'Embedding'],
] as const;

export function ProviderCard({ provider, busy, onTest, onActivate, onEdit, onDelete }: Props) {
  const caps = provider.capabilities;
  return (
    <article className="card" aria-label={provider.name}>
      <header className="row">
        <h3>{provider.name}</h3>
        {provider.isActive && <span className="badge ok">启用中</span>}
      </header>
      <dl>
        <dt>Base URL</dt>
        <dd>{provider.baseUrl}</dd>
        <dt>对话模型</dt>
        <dd>{provider.chatModel}</dd>
        <dt>Embedding</dt>
        <dd>{provider.embeddingModel ?? '未配置'}</dd>
        <dt>API Key</dt>
        <dd>····{provider.apiKeyLast4}</dd>
      </dl>
      {caps ? (
        <section aria-label="能力探测结果">
          <ul className="caps">
            {CAPABILITIES.map(([key, label]) => (
              <li key={key} className={caps[key] ? 'ok' : 'fail'}>
                {caps[key] ? '✔' : '✖'} {label}
                {key === 'embedding' && caps.embeddingDimensions
                  ? `（${caps.embeddingDimensions} 维）`
                  : ''}
              </li>
            ))}
          </ul>
          {caps.errors.length > 0 && (
            <ul className="errors">
              {caps.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          <p className="hint">探测于 {new Date(caps.checkedAt).toLocaleString('zh-CN')}</p>
        </section>
      ) : (
        <p className="hint">尚未测试连接</p>
      )}
      <div className="actions">
        <button type="button" onClick={onTest} disabled={busy}>
          {busy ? '处理中…' : '测试连接'}
        </button>
        {!provider.isActive && (
          <button type="button" className="secondary" onClick={onActivate} disabled={busy}>
            设为启用
          </button>
        )}
        <button type="button" className="secondary" onClick={onEdit} disabled={busy}>
          编辑
        </button>
        <button type="button" className="danger" onClick={onDelete} disabled={busy}>
          删除
        </button>
      </div>
    </article>
  );
}
