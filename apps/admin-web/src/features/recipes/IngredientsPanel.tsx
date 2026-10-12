import type { Ingredient, IngredientUpdate } from '@mealmuse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ingredients } from '../../api/client';
import { ALLERGEN_LABELS, CATEGORY_LABELS, DIET_TAG_LABELS, options } from './labels';

/** 食材库：修改过敏原、饮食标记后，服务端会重新派生用到它的菜谱。 */
export function IngredientsPanel() {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['ingredients', q.trim()],
    queryFn: () => ingredients.list(q.trim() || undefined),
  });

  return (
    <>
      <div className="card row filters">
        <label>
          搜索
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名称或别名" />
        </label>
        <span className="hint">{list.data ? `${list.data.length} 种食材` : '加载中…'}</span>
      </div>
      {list.isError && <p role="alert">{list.error.message}</p>}
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>别名</th>
            <th>品类</th>
            <th>过敏原</th>
            <th>饮食标记</th>
            <th>常备</th>
            <th>采购搜索词</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.data?.map((item) =>
            editing === item.id ? (
              <tr key={item.id}>
                <td colSpan={8}>
                  <IngredientForm ingredient={item} onDone={() => setEditing(null)} />
                </td>
              </tr>
            ) : (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.aliases.join('、') || '—'}</td>
                <td>{CATEGORY_LABELS[item.category]}</td>
                <td>{item.allergenTags.map((a) => ALLERGEN_LABELS[a]).join('、') || '—'}</td>
                <td>{item.dietTags.map((d) => DIET_TAG_LABELS[d]).join('、') || '—'}</td>
                <td>{item.isPantryStaple ? '是' : ''}</td>
                <td>{item.searchKeyword ?? '—'}</td>
                <td>
                  <button type="button" className="link" onClick={() => setEditing(item.id)}>
                    修改
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </>
  );
}

function IngredientForm({ ingredient, onDone }: { ingredient: Ingredient; onDone(): void }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    name: ingredient.name,
    aliases: ingredient.aliases.join('、'),
    category: ingredient.category,
    allergenTags: ingredient.allergenTags,
    dietTags: ingredient.dietTags,
    isPantryStaple: ingredient.isPantryStaple,
    searchKeyword: ingredient.searchKeyword ?? '',
  });
  const toggle = <T extends string>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  const save = useMutation({
    mutationFn: (patch: IngredientUpdate) => ingredients.update(ingredient.id, patch),
    onSuccess: async () => {
      // 食材属性会影响菜谱的过敏原与饮食标记，一并刷新。
      await queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      await queryClient.invalidateQueries({ queryKey: ['recipes'] });
      await queryClient.invalidateQueries({ queryKey: ['recipe'] });
      onDone();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({
      name: values.name.trim(),
      aliases: values.aliases
        .split(/[、,，]/)
        .map((a) => a.trim())
        .filter(Boolean),
      category: values.category,
      allergenTags: values.allergenTags,
      dietTags: values.dietTags,
      isPantryStaple: values.isPantryStaple,
      searchKeyword: values.searchKeyword.trim() || null,
    });
  };

  return (
    <form className="form wide" onSubmit={submit}>
      <div className="row">
        <label>
          标准名
          <input
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            required
          />
        </label>
        <label className="grow">
          别名（顿号分隔）
          <input
            value={values.aliases}
            onChange={(e) => setValues({ ...values, aliases: e.target.value })}
          />
        </label>
        <label>
          品类
          <select
            value={values.category}
            onChange={(e) =>
              setValues({ ...values, category: e.target.value as Ingredient['category'] })
            }
          >
            {options(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          采购搜索词
          <input
            value={values.searchKeyword}
            onChange={(e) => setValues({ ...values, searchKeyword: e.target.value })}
          />
        </label>
      </div>
      <fieldset>
        <legend>过敏原</legend>
        {options(ALLERGEN_LABELS).map(([value, label]) => (
          <label key={value} className="inline">
            <input
              type="checkbox"
              checked={values.allergenTags.includes(value)}
              onChange={() =>
                setValues({ ...values, allergenTags: toggle(values.allergenTags, value) })
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>饮食标记</legend>
        {options(DIET_TAG_LABELS).map(([value, label]) => (
          <label key={value} className="inline">
            <input
              type="checkbox"
              checked={values.dietTags.includes(value)}
              onChange={() => setValues({ ...values, dietTags: toggle(values.dietTags, value) })}
            />
            {label}
          </label>
        ))}
        <label className="inline">
          <input
            type="checkbox"
            checked={values.isPantryStaple}
            onChange={(e) => setValues({ ...values, isPantryStaple: e.target.checked })}
          />
          常备调料（采购清单默认不列）
        </label>
      </fieldset>
      {save.isError && <p role="alert">{save.error.message}</p>}
      <div className="actions">
        <button type="submit" disabled={save.isPending}>
          {save.isPending ? '保存中…' : '保存'}
        </button>
        <button type="button" className="secondary" onClick={onDone}>
          取消
        </button>
      </div>
    </form>
  );
}
