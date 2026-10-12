import type { RecipeInput } from '@mealmuse/shared';
import { useQuery } from '@tanstack/react-query';
import { ingredients } from '../../api/client';
import { GROUP_LABELS, options } from './labels';

type Line = RecipeInput['ingredients'][number];
type Props = { value: Line[]; onChange(value: Line[]): void };

const BLANK: Line = {
  name: '',
  group: 'side',
  quantity: null,
  unit: 'g',
  prepNote: null,
  optional: false,
};

/** 食材行：名称可从食材库选择，也可以填新名称（保存时服务端新建，之后到食材库补全属性）。 */
export function IngredientRows({ value, onChange }: Props) {
  const library = useQuery({ queryKey: ['ingredients', ''], queryFn: () => ingredients.list() });
  const known = new Set(library.data?.flatMap((i) => [i.name, ...i.aliases]));
  const update = (index: number, patch: Partial<Line>) =>
    onChange(value.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  return (
    <div className="card">
      <datalist id="ingredient-names">
        {library.data?.map((i) => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>
      <table className="rows">
        <thead>
          <tr>
            <th>食材</th>
            <th>分组</th>
            <th>用量（空为适量）</th>
            <th>单位</th>
            <th>处理</th>
            <th>可选</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {value.map((line, index) => (
            <tr key={index}>
              <td>
                <input
                  aria-label={`食材 ${index + 1}`}
                  list="ingredient-names"
                  value={line.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
                {line.name && library.data && !known.has(line.name) && (
                  <span className="hint"> 新食材</span>
                )}
              </td>
              <td>
                <select
                  value={line.group}
                  onChange={(e) => update(index, { group: e.target.value as Line['group'] })}
                >
                  {options(GROUP_LABELS).map(([group, label]) => (
                    <option key={group} value={group}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="narrow"
                  value={line.quantity ?? ''}
                  onChange={(e) =>
                    update(index, {
                      quantity: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </td>
              <td>
                <input
                  className="narrow"
                  value={line.unit}
                  onChange={(e) => update(index, { unit: e.target.value })}
                />
              </td>
              <td>
                <input
                  value={line.prepNote ?? ''}
                  onChange={(e) => update(index, { prepNote: e.target.value || null })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label={`食材 ${index + 1} 可选`}
                  checked={line.optional}
                  onChange={(e) => update(index, { optional: e.target.checked })}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="link"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="actions">
        <button type="button" className="secondary" onClick={() => onChange([...value, BLANK])}>
          添加食材
        </button>
      </div>
    </div>
  );
}
