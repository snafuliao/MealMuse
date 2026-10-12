import type { RecipeInput } from '@mealmuse/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { composeServices } from '../../composition.js';
import { createLlmGateway } from '../../providers/llm/gateway.js';
import { createTestInfrastructure, resetDatabase } from '../../testing/database.js';
import { chatReply, fakeOpenAi } from '../../testing/fake-llm.js';
import * as repo from './repo/recipe-repo.js';
import { createRecipeService, saveRecipe } from './service/recipe-service.js';
import { importSeed } from './service/seed/import-seed.js';
import type { StructuredSeed } from './service/seed/structure.js';

const infrastructure = createTestInfrastructure();
const { identity } = composeServices(infrastructure);
const service = createRecipeService(infrastructure);
const { db } = infrastructure.database;

const tomatoEgg: RecipeInput = {
  name: '番茄炒蛋',
  description: '家常菜',
  cuisine: '家常',
  mealTypes: ['lunch', 'dinner'],
  course: 'veg',
  difficulty: 2,
  prepMinutes: 5,
  cookMinutes: 10,
  baseServings: 2,
  flavorTags: ['酸甜'],
  spiceLevel: 0,
  equipment: [],
  tips: null,
  ingredients: [
    { name: '西红柿', group: 'main', quantity: 360, unit: 'g', prepNote: '切块', optional: false },
    { name: '鸡蛋', group: 'main', quantity: 3, unit: '个', prepNote: null, optional: false },
    {
      name: '盐',
      group: 'seasoning',
      quantity: null,
      unit: '适量',
      prepNote: null,
      optional: false,
    },
  ],
  steps: [{ instruction: '炒蛋', durationMinutes: 3, tip: null }],
};

beforeEach(() => resetDatabase(infrastructure));
afterAll(() => infrastructure.database.close());

describe('saving recipes', () => {
  it('reuses ingredients by name or alias instead of duplicating them', async () => {
    await repo.insertIngredient(db, {
      name: '番茄',
      aliases: ['西红柿'],
      category: 'vegetable',
      allergenTags: [],
      dietTags: [],
      isPantryStaple: false,
      searchKeyword: '番茄',
    });
    const recipe = await service.create(tomatoEgg);
    expect(recipe.ingredients.map((i) => i.ingredient.name)).toEqual(['番茄', '鸡蛋', '盐']);
    expect((await service.listIngredients()).map((i) => i.name).sort()).toEqual([
      '番茄',
      '盐',
      '鸡蛋',
    ]);
  });

  it('re-derives allergens on every recipe when an ingredient is corrected', async () => {
    const recipe = await service.create(tomatoEgg);
    expect(recipe.allergenTags).toEqual([]);
    const egg = recipe.ingredients.find((i) => i.ingredient.name === '鸡蛋')?.ingredient;
    await service.updateIngredient(egg?.id ?? '', { category: 'egg_dairy', allergenTags: ['egg'] });
    const updated = await service.getForAdmin(recipe.id);
    expect(updated.allergenTags).toEqual(['egg']);
    expect(updated.dietFlags).not.toContain('vegan');
  });

  it('replaces ingredients and steps on update', async () => {
    const recipe = await service.create(tomatoEgg);
    const updated = await service.update(recipe.id, {
      ...tomatoEgg,
      ingredients: tomatoEgg.ingredients.slice(0, 2),
      steps: [...tomatoEgg.steps, { instruction: '出锅', durationMinutes: null, tip: null }],
    });
    expect(updated.ingredients).toHaveLength(2);
    expect(updated.steps.map((s) => s.instruction)).toEqual(['炒蛋', '出锅']);
  });
});

describe('querying', () => {
  it('searches by name and filters by meal type', async () => {
    await service.create(tomatoEgg);
    await service.create({ ...tomatoEgg, name: '豆浆', mealTypes: ['breakfast'], course: 'drink' });
    expect(
      (await service.list({ q: '番茄', page: 1, pageSize: 20 })).items.map((r) => r.name),
    ).toEqual(['番茄炒蛋']);
    const breakfast = await service.list({ mealType: 'breakfast', page: 1, pageSize: 20 });
    expect(breakfast).toMatchObject({ total: 1, items: [{ name: '豆浆' }] });
  });

  it('hides pending AI recipes from everyone but the user they were made for', async () => {
    const owner = await identity.issueAdminToken('owner');
    const recipeId = await db.transaction((tx) =>
      saveRecipe(tx, null, tomatoEgg, {
        status: 'pending_review',
        source: 'llm',
        generatedForUserId: owner.user.id,
      }),
    );
    const other = {
      id: '00000000-0000-4000-8000-0000000000aa',
      role: 'member' as const,
      deviceTokenId: 'x',
    };
    const self = { id: owner.user.id, role: 'member' as const, deviceTokenId: 'y' };
    await expect(service.getForUser(recipeId, other)).rejects.toMatchObject({ status: 404 });
    expect((await service.getForUser(recipeId, self)).status).toBe('pending_review');
  });
});

describe('seed import', () => {
  const structured: StructuredSeed = {
    ...tomatoEgg,
    name: '西红柿炒鸡蛋',
    equipment: [],
    ingredients: tomatoEgg.ingredients.map((item) => ({
      ...item,
      category: item.name === '鸡蛋' ? ('egg_dairy' as const) : ('vegetable' as const),
      allergenTags: item.name === '鸡蛋' ? ['egg' as const] : [],
      dietTags: [],
      isPantryStaple: item.name === '盐',
      searchKeyword: null,
    })),
  };
  const seedDir = new URL('../../../seed/howtocook', import.meta.url).pathname;
  const only = ['dishes/vegetable_dish/西红柿炒鸡蛋.md'];

  function providersWith(replies: Parameters<typeof fakeOpenAi>[0]) {
    const fake = fakeOpenAi(replies);
    const llm = createLlmGateway({
      logger: infrastructure.logger,
      resolveConfig: async () => ({
        providerId: '00000000-0000-4000-8000-000000000009',
        baseUrl: 'https://relay.example/v1',
        apiKey: 'sk-test',
        chatModel: 'm',
        embeddingModel: null,
        timeoutMs: 1000,
        capabilities: null,
      }),
      recordCall: () => {},
      fetchImpl: fake.fetch,
    });
    return { providers: { ...infrastructure, llm }, calls: fake.calls };
  }

  it('imports a dish with derived allergens and skips it on the next run', async () => {
    const { providers } = providersWith([chatReply(JSON.stringify(structured))]);
    expect(await importSeed(providers, { seedDir, only })).toMatchObject({
      imported: 1,
      failed: 0,
    });
    const page = await service.list({ q: '西红柿', page: 1, pageSize: 5 });
    expect(page.items[0]).toMatchObject({
      source: 'seed',
      status: 'published',
      allergenTags: ['egg'],
    });

    const second = providersWith([]);
    expect(await importSeed(second.providers, { seedDir, only })).toMatchObject({
      imported: 0,
      unchanged: 1,
    });
    expect(second.calls).toHaveLength(0);
  });

  it('reuses the cached model output when retrying a failed item', async () => {
    const first = providersWith([chatReply(JSON.stringify(structured))]);
    await importSeed(first.providers, { seedDir, only });
    await db.execute(sql`update seed_import_items set status = 'failed'`);
    const retry = providersWith([]);
    expect(await importSeed(retry.providers, { seedDir, only })).toMatchObject({ imported: 1 });
    expect(retry.calls).toHaveLength(0);
  });
});
