import type { Recipe } from '@mealmuse/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi } from '../../testing/fake-api';
import { RecipesPage } from './RecipesPage';

const EGG = {
  id: '00000000-0000-4000-8000-0000000000e1',
  name: '鸡蛋',
  aliases: [],
  category: 'egg_dairy',
  allergenTags: ['egg'],
  dietTags: [],
  isPantryStaple: false,
  searchKeyword: '鸡蛋',
};

const RECIPE: Recipe = {
  id: '00000000-0000-4000-8000-0000000000a1',
  name: '番茄炒蛋',
  description: '家常菜',
  cuisine: '家常',
  mealTypes: ['lunch'],
  course: 'veg',
  difficulty: 2,
  prepMinutes: 5,
  cookMinutes: 10,
  baseServings: 2,
  flavorTags: ['酸甜'],
  spiceLevel: 0,
  equipment: [],
  tips: null,
  status: 'pending_review',
  source: 'llm',
  sourceRef: null,
  reviewNote: null,
  allergenTags: ['egg'],
  dietFlags: ['vegetarian'],
  updatedAt: '2026-10-12T10:00:00.000Z',
  ingredients: [
    {
      ingredient: EGG as Recipe['ingredients'][number]['ingredient'],
      group: 'main',
      quantity: 3,
      unit: '个',
      prepNote: null,
      optional: false,
    },
  ],
  steps: [{ instruction: '炒蛋', durationMinutes: 3, tip: null }],
};

const page = (items: Recipe[]) => ({ json: { items, total: items.length, page: 1, pageSize: 20 } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RecipesPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const lastBody = (calls: Array<{ key: string; body: unknown }>, key: string) =>
  calls.findLast((c) => c.key === key)?.body as Record<string, unknown> | undefined;

describe('recipe management', () => {
  it('edits a recipe and sends ingredients by name', async () => {
    const calls = installFakeApi({
      'GET /api/admin/recipes?page=1&pageSize=20': () => page([RECIPE]),
      [`GET /api/admin/recipes/${RECIPE.id}`]: () => ({ json: RECIPE }),
      'GET /api/admin/ingredients': () => ({ json: [EGG] }),
      [`PUT /api/admin/recipes/${RECIPE.id}`]: (body) => ({
        json: { ...RECIPE, ...(body as object), ingredients: RECIPE.ingredients },
      }),
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '番茄炒蛋' }));
    fireEvent.change(await screen.findByDisplayValue('番茄炒蛋'), {
      target: { value: '西红柿炒蛋' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(lastBody(calls, `PUT /api/admin/recipes/${RECIPE.id}`)).toMatchObject({
      name: '西红柿炒蛋',
      ingredients: [{ name: '鸡蛋', quantity: 3, unit: '个' }],
    });
  });

  it('blocks saving when a step is empty', async () => {
    const calls = installFakeApi({
      'GET /api/admin/recipes?page=1&pageSize=20': () => page([]),
      'GET /api/admin/ingredients': () => ({ json: [] }),
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '新建菜谱' }));
    fireEvent.change(await screen.findByLabelText('菜名'), { target: { value: '拍黄瓜' } });
    fireEvent.click(screen.getByRole('button', { name: '创建并发布' }));
    expect((await screen.findByRole('alert')).textContent).toContain('steps');
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false);
  });

  it('reviews pending recipes: rejecting needs a reason', async () => {
    const calls = installFakeApi({
      'GET /api/admin/recipes?status=pending_review&page=1&pageSize=20': () => page([RECIPE]),
      [`GET /api/admin/recipes/${RECIPE.id}`]: () => ({ json: RECIPE }),
      'GET /api/admin/ingredients': () => ({ json: [EGG] }),
      [`POST /api/admin/recipes/${RECIPE.id}/status`]: (body) => ({
        json: { ...RECIPE, status: (body as { status: string }).status },
      }),
    });
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: '审核队列' }));
    fireEvent.click(await screen.findByRole('button', { name: '番茄炒蛋' }));
    const reject = await screen.findByRole('button', { name: '驳回' });
    expect((reject as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/驳回时必填/), { target: { value: '用量不对' } });
    fireEvent.click(reject);
    await vi.waitFor(() =>
      expect(lastBody(calls, `POST /api/admin/recipes/${RECIPE.id}/status`)).toEqual({
        status: 'rejected',
        note: '用量不对',
      }),
    );
  });

  it('corrects an ingredient and retries a failed seed import', async () => {
    const failed = {
      id: '00000000-0000-4000-8000-0000000000f1',
      batch: 'b',
      sourcePath: 'dishes/soup/紫菜蛋花汤.md',
      status: 'failed',
      recipeId: null,
      error: '无法连接模型服务',
      createdAt: '2026-10-12T10:00:00.000Z',
    };
    const calls = installFakeApi({
      'GET /api/admin/ingredients': () => ({ json: [EGG] }),
      [`PATCH /api/admin/ingredients/${EGG.id}`]: (body) => ({
        json: { ...EGG, ...(body as object) },
      }),
      'GET /api/admin/seed-imports': () => ({ json: [failed] }),
      [`POST /api/admin/seed-imports/${failed.id}/retry`]: () => ({
        json: { ...failed, status: 'imported', error: null, recipeId: RECIPE.id },
      }),
    });
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: '食材库' }));
    fireEvent.click(await screen.findByRole('button', { name: '修改' }));
    fireEvent.change(screen.getByLabelText('别名（顿号分隔）'), {
      target: { value: '蛋、土鸡蛋' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await vi.waitFor(() =>
      expect(lastBody(calls, `PATCH /api/admin/ingredients/${EGG.id}`)).toMatchObject({
        aliases: ['蛋', '土鸡蛋'],
        allergenTags: ['egg'],
      }),
    );

    fireEvent.click(screen.getByRole('tab', { name: '导入记录' }));
    expect(await screen.findByText('无法连接模型服务')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '重新导入' }));
    await vi.waitFor(() =>
      expect(calls.some((c) => c.key === `POST /api/admin/seed-imports/${failed.id}/retry`)).toBe(
        true,
      ),
    );
  });
});
