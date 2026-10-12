import { RecipeInputSchema, type Recipe, type RecipeInput } from '@mealmuse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { recipes } from '../../api/client';
import { IngredientRows } from './IngredientRows';
import {
  ALLERGEN_LABELS,
  COURSE_LABELS,
  DIET_FLAG_LABELS,
  EQUIPMENT_LABELS,
  MEAL_TYPE_LABELS,
  options,
  SOURCE_LABELS,
  STATUS_LABELS,
} from './labels';
import { StatusActions } from './StatusActions';
import { StepRows } from './StepRows';

type Props = {
  recipeId: string | null;
  onClose(): void;
  onCreated(id: string): void;
};

const EMPTY: RecipeInput = {
  name: '',
  description: '',
  cuisine: null,
  mealTypes: ['lunch', 'dinner'],
  course: 'veg',
  difficulty: 2,
  prepMinutes: 10,
  cookMinutes: 10,
  baseServings: 2,
  flavorTags: [],
  spiceLevel: 0,
  equipment: [],
  tips: null,
  ingredients: [
    { name: '', group: 'main', quantity: null, unit: 'g', prepNote: null, optional: false },
  ],
  steps: [{ instruction: '', durationMinutes: null, tip: null }],
};

const toInput = (r: Recipe): RecipeInput => ({
  name: r.name,
  description: r.description,
  cuisine: r.cuisine,
  mealTypes: r.mealTypes,
  course: r.course,
  difficulty: r.difficulty,
  prepMinutes: r.prepMinutes,
  cookMinutes: r.cookMinutes,
  baseServings: r.baseServings,
  flavorTags: r.flavorTags,
  spiceLevel: r.spiceLevel,
  equipment: r.equipment,
  tips: r.tips,
  ingredients: r.ingredients.map(({ ingredient, ...line }) => ({ name: ingredient.name, ...line })),
  steps: r.steps,
});

/** 新建与编辑共用；编辑时先加载详情，保存后服务端重新派生过敏原与饮食标记。 */
export function RecipeEditor({ recipeId, onClose, onCreated }: Props) {
  const detail = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => recipes.get(recipeId ?? ''),
    enabled: recipeId !== null,
  });
  if (recipeId !== null && detail.isPending) return <p className="hint">加载中…</p>;
  if (detail.isError) return <p role="alert">{detail.error.message}</p>;
  return (
    <RecipeForm
      key={detail.data?.id ?? 'new'}
      recipe={detail.data ?? null}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function RecipeForm({
  recipe,
  onClose,
  onCreated,
}: Omit<Props, 'recipeId'> & { recipe: Recipe | null }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<RecipeInput>(recipe ? toInput(recipe) : EMPTY);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const patch = (values: Partial<RecipeInput>) => {
    setDraft((d) => ({ ...d, ...values }));
    setSaved(false);
  };
  const text = (key: 'name' | 'description') => (e: { target: { value: string } }) =>
    patch({ [key]: e.target.value });
  const num =
    (key: 'difficulty' | 'prepMinutes' | 'cookMinutes' | 'baseServings' | 'spiceLevel') =>
    (e: { target: { value: string } }) =>
      patch({ [key]: Number(e.target.value) });
  const toggle = <T extends string>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const save = useMutation({
    mutationFn: (input: RecipeInput) =>
      recipe ? recipes.update(recipe.id, input) : recipes.create(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.setQueryData(['recipe', result.id], result);
      setSaved(true);
      if (!recipe) onCreated(result.id);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = RecipeInputSchema.safeParse(draft);
    setInvalid(parsed.success ? null : z.prettifyError(parsed.error));
    if (parsed.success) save.mutate(parsed.data);
  };

  return (
    <form className="editor" onSubmit={submit}>
      <div className="row">
        <button type="button" className="secondary" onClick={onClose}>
          ← 返回列表
        </button>
        <h2>{recipe ? `编辑：${recipe.name}` : '新建菜谱'}</h2>
      </div>
      {recipe && (
        <div className="card">
          <dl>
            <dt>状态</dt>
            <dd>
              {STATUS_LABELS[recipe.status]}（{SOURCE_LABELS[recipe.source]}）
              {recipe.reviewNote && `，备注：${recipe.reviewNote}`}
            </dd>
            <dt>过敏原</dt>
            <dd>{recipe.allergenTags.map((a) => ALLERGEN_LABELS[a]).join('、') || '无'}</dd>
            <dt>饮食标记</dt>
            <dd>{recipe.dietFlags.map((f) => DIET_FLAG_LABELS[f]).join('、') || '无'}</dd>
            {recipe.sourceRef && (
              <>
                <dt>原文</dt>
                <dd>{recipe.sourceRef}</dd>
              </>
            )}
          </dl>
          <p className="hint">过敏原与饮食标记由食材推导，改食材后保存即可更新。</p>
          <StatusActions recipe={recipe} />
        </div>
      )}

      <div className="card form wide">
        <label>
          菜名
          <input value={draft.name} onChange={text('name')} required />
        </label>
        <label>
          简介
          <textarea value={draft.description} onChange={text('description')} rows={2} />
        </label>
        <div className="row">
          <label>
            菜系
            <input
              value={draft.cuisine ?? ''}
              onChange={(e) => patch({ cuisine: e.target.value || null })}
            />
          </label>
          <label>
            类别
            <select
              value={draft.course}
              onChange={(e) => patch({ course: e.target.value as RecipeInput['course'] })}
            >
              {options(COURSE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            难度（1–5）
            <input
              type="number"
              min={1}
              max={5}
              value={draft.difficulty}
              onChange={num('difficulty')}
            />
          </label>
          <label>
            辣度（0–3）
            <input
              type="number"
              min={0}
              max={3}
              value={draft.spiceLevel}
              onChange={num('spiceLevel')}
            />
          </label>
        </div>
        <div className="row">
          <label>
            准备（分钟）
            <input type="number" min={0} value={draft.prepMinutes} onChange={num('prepMinutes')} />
          </label>
          <label>
            烹饪（分钟）
            <input type="number" min={0} value={draft.cookMinutes} onChange={num('cookMinutes')} />
          </label>
          <label>
            基准人数
            <input
              type="number"
              min={1}
              max={20}
              value={draft.baseServings}
              onChange={num('baseServings')}
            />
          </label>
        </div>
        <fieldset>
          <legend>餐次</legend>
          {options(MEAL_TYPE_LABELS).map(([value, label]) => (
            <label key={value} className="inline">
              <input
                type="checkbox"
                checked={draft.mealTypes.includes(value)}
                onChange={() => patch({ mealTypes: toggle(draft.mealTypes, value) })}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>需要的厨具（炉灶、炒锅、汤锅不用勾）</legend>
          {options(EQUIPMENT_LABELS).map(([value, label]) => (
            <label key={value} className="inline">
              <input
                type="checkbox"
                checked={draft.equipment.includes(value)}
                onChange={() => patch({ equipment: toggle(draft.equipment, value) })}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label>
          口味标签（用顿号或逗号分隔）
          <input
            value={draft.flavorTags.join('、')}
            onChange={(e) =>
              patch({
                flavorTags: e.target.value
                  .split(/[、,，]/)
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <label>
          小贴士
          <textarea
            value={draft.tips ?? ''}
            onChange={(e) => patch({ tips: e.target.value || null })}
            rows={3}
          />
        </label>
      </div>

      <h3>食材</h3>
      <IngredientRows
        value={draft.ingredients}
        onChange={(ingredients) => patch({ ingredients })}
      />
      <h3>步骤</h3>
      <StepRows value={draft.steps} onChange={(steps) => patch({ steps })} />

      {invalid && <pre role="alert">{invalid}</pre>}
      {save.isError && <p role="alert">{save.error.message}</p>}
      <div className="actions">
        <button type="submit" disabled={save.isPending}>
          {save.isPending ? '保存中…' : recipe ? '保存修改' : '创建并发布'}
        </button>
        {saved && <span role="status">已保存</span>}
      </div>
    </form>
  );
}
