import type { Recipe, RecipeStatusChange } from '@mealmuse/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { recipes } from '../../api/client';

/** 审核与上下架。驳回必须写原因；发布、下架的备注可空。 */
export function StatusActions({ recipe }: { recipe: Recipe }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const change = useMutation({
    mutationFn: (status: RecipeStatusChange['status']) =>
      recipes.changeStatus(recipe.id, { status, note: note.trim() || null }),
    onSuccess: async (result) => {
      queryClient.setQueryData(['recipe', result.id], result);
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  return (
    <div className="row">
      <label className="grow">
        审核备注
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="驳回时必填，例如：用量不合理"
        />
      </label>
      {recipe.status !== 'published' && (
        <button
          type="button"
          disabled={change.isPending}
          onClick={() => change.mutate('published')}
        >
          发布
        </button>
      )}
      {recipe.status === 'pending_review' && (
        <button
          type="button"
          className="danger"
          disabled={change.isPending || note.trim() === ''}
          onClick={() => change.mutate('rejected')}
        >
          驳回
        </button>
      )}
      {recipe.status === 'published' && (
        <button
          type="button"
          className="danger"
          disabled={change.isPending}
          onClick={() => change.mutate('archived')}
        >
          下架
        </button>
      )}
      {change.isError && <p role="alert">{change.error.message}</p>}
    </div>
  );
}
