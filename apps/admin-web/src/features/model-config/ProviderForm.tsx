import type { ModelProvider, ModelProviderCreate } from '@mealmuse/shared';
import { useState, type FormEvent } from 'react';

export type ProviderFormValues = ModelProviderCreate & { apiKey: string };

type Props = {
  initial?: ModelProvider;
  submitting: boolean;
  error: string | null;
  onSubmit(values: ProviderFormValues): void;
  onCancel(): void;
};

const DEFAULTS = {
  name: '中转站',
  baseUrl: 'https://jojocode.com/v1',
  chatModel: 'gpt-6.1-sol',
  embeddingModel: '',
  timeoutMs: '30000',
};

/** 新增与编辑共用。编辑时 API Key 留空表示不修改（Key 只写不读）。 */
export function ProviderForm({ initial, submitting, error, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState({
    name: initial?.name ?? DEFAULTS.name,
    baseUrl: initial?.baseUrl ?? DEFAULTS.baseUrl,
    chatModel: initial?.chatModel ?? DEFAULTS.chatModel,
    embeddingModel: initial?.embeddingModel ?? DEFAULTS.embeddingModel,
    timeoutMs: String(initial?.timeoutMs ?? DEFAULTS.timeoutMs),
    apiKey: '',
  });
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      name: values.name.trim(),
      baseUrl: values.baseUrl.trim(),
      chatModel: values.chatModel.trim(),
      embeddingModel: values.embeddingModel.trim() || null,
      timeoutMs: Number(values.timeoutMs),
      apiKey: values.apiKey.trim(),
    });
  };

  return (
    <form className="card form" onSubmit={submit}>
      <label>
        名称
        <input value={values.name} onChange={set('name')} required />
      </label>
      <label>
        Base URL（OpenAI 兼容）
        <input value={values.baseUrl} onChange={set('baseUrl')} type="url" required />
      </label>
      <label>
        API Key
        <input
          value={values.apiKey}
          onChange={set('apiKey')}
          type="password"
          autoComplete="off"
          placeholder={initial ? `留空则保留原 Key（末 4 位 ${initial.apiKeyLast4}）` : 'sk-...'}
          required={!initial}
        />
      </label>
      <label>
        对话模型
        <input value={values.chatModel} onChange={set('chatModel')} required />
      </label>
      <label>
        Embedding 模型（可空）
        <input value={values.embeddingModel} onChange={set('embeddingModel')} />
      </label>
      <label>
        超时（毫秒）
        <input
          value={values.timeoutMs}
          onChange={set('timeoutMs')}
          type="number"
          min={1000}
          max={120000}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" disabled={submitting}>
          {submitting ? '保存中…' : '保存'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}
