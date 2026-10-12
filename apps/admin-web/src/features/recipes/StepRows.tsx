import type { RecipeStep } from '@mealmuse/shared';

type Props = { value: RecipeStep[]; onChange(value: RecipeStep[]): void };

const BLANK: RecipeStep = { instruction: '', durationMinutes: null, tip: null };

export function StepRows({ value, onChange }: Props) {
  const update = (index: number, patch: Partial<RecipeStep>) =>
    onChange(value.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  const move = (index: number, offset: -1 | 1) => {
    const next = [...value];
    const [step] = next.splice(index, 1);
    if (step) next.splice(index + offset, 0, step);
    onChange(next);
  };

  return (
    <div className="card">
      <ol className="steps">
        {value.map((step, index) => (
          <li key={index}>
            <span className="hint">第 {index + 1} 步</span>
            <textarea
              aria-label={`步骤 ${index + 1}`}
              rows={2}
              value={step.instruction}
              onChange={(e) => update(index, { instruction: e.target.value })}
            />
            <div className="row">
              <label>
                用时（分钟，可空）
                <input
                  type="number"
                  min={1}
                  className="narrow"
                  value={step.durationMinutes ?? ''}
                  onChange={(e) =>
                    update(index, {
                      durationMinutes: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="grow">
                提示（可空）
                <input
                  value={step.tip ?? ''}
                  onChange={(e) => update(index, { tip: e.target.value || null })}
                />
              </label>
              <button
                type="button"
                className="link"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                上移
              </button>
              <button
                type="button"
                className="link"
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
              >
                下移
              </button>
              <button
                type="button"
                className="link"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                删除
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="actions">
        <button type="button" className="secondary" onClick={() => onChange([...value, BLANK])}>
          添加步骤
        </button>
      </div>
    </div>
  );
}
