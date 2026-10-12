import {
  IngredientSchema,
  RecipePageSchema,
  RecipeSchema,
  SeedImportItemSchema,
} from '@mealmuse/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../../app.js';
import { composeServices } from '../../composition.js';
import { createTestInfrastructure, resetDatabase } from '../../testing/database.js';
import { tomatoEgg } from '../../testing/recipes.js';
import * as seedRepo from './repo/seed-repo.js';

const infrastructure = createTestInfrastructure();
const services = composeServices(infrastructure);
const app = createApp(services);

const send = (method: string, path: string, token: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

async function tokens() {
  const admin = await services.identity.issueAdminToken('站长');
  const { code } = await services.identity.createInvite(admin.user.id, {
    role: 'member',
    maxUses: 1,
    expiresInDays: 1,
  });
  const member = await services.identity.redeemInvite({
    code,
    displayName: '小明',
    deviceName: 'iPhone',
  });
  return { admin: admin.token, member: member.token };
}

beforeEach(() => resetDatabase(infrastructure));
afterAll(() => infrastructure.database.close());

describe('recipe routes', () => {
  it('lets admins create, list, edit and review recipes', async () => {
    const { admin } = await tokens();
    const created = RecipeSchema.parse(
      await (await send('POST', '/api/admin/recipes', admin, tomatoEgg)).json(),
    );
    expect(created).toMatchObject({ status: 'published', source: 'admin', allergenTags: [] });

    const page = RecipePageSchema.parse(
      await (await send('GET', '/api/admin/recipes?q=番茄&status=published', admin)).json(),
    );
    expect(page.items.map((r) => r.id)).toEqual([created.id]);

    const edited = await send('PUT', `/api/admin/recipes/${created.id}`, admin, {
      ...tomatoEgg,
      name: '番茄炒鸡蛋',
    });
    expect(RecipeSchema.parse(await edited.json()).name).toBe('番茄炒鸡蛋');

    const rejected = await send('POST', `/api/admin/recipes/${created.id}/status`, admin, {
      status: 'rejected',
      note: '步骤太简略',
    });
    expect(RecipeSchema.parse(await rejected.json())).toMatchObject({
      status: 'rejected',
      reviewNote: '步骤太简略',
    });
  });

  it('re-derives allergen tags when an ingredient is corrected', async () => {
    const { admin } = await tokens();
    const recipe = RecipeSchema.parse(
      await (await send('POST', '/api/admin/recipes', admin, tomatoEgg)).json(),
    );
    const list = z
      .array(IngredientSchema)
      .parse(await (await send('GET', '/api/admin/ingredients?q=鸡蛋', admin)).json());
    const egg = list.find((i) => i.name === '鸡蛋');
    expect(egg).toBeDefined();

    const patched = await send('PATCH', `/api/admin/ingredients/${egg?.id}`, admin, {
      category: 'egg_dairy',
      allergenTags: ['egg'],
    });
    expect(IngredientSchema.parse(await patched.json()).allergenTags).toEqual(['egg']);
    const after = await send('GET', `/api/admin/recipes/${recipe.id}`, admin);
    expect(RecipeSchema.parse(await after.json()).allergenTags).toEqual(['egg']);
  });

  it('shows members published recipes only and keeps them out of admin routes', async () => {
    const { admin, member } = await tokens();
    const recipe = RecipeSchema.parse(
      await (await send('POST', '/api/admin/recipes', admin, tomatoEgg)).json(),
    );
    expect((await send('GET', `/api/recipes/${recipe.id}`, member)).status).toBe(200);
    expect((await send('GET', '/api/admin/recipes', member)).status).toBe(403);

    await send('POST', `/api/admin/recipes/${recipe.id}/status`, admin, { status: 'archived' });
    expect((await send('GET', `/api/recipes/${recipe.id}`, member)).status).toBe(404);
  });

  it('lists seed import records and retries a failed one', async () => {
    const { admin } = await tokens();
    const { db } = infrastructure.database;
    const failed = { batch: 'b', recipeId: null, status: 'failed' as const, error: '网络错误' };
    await seedRepo.recordSeedItem(db, { ...failed, sourcePath: 'dishes/soup/紫菜蛋花汤.md' });
    const items = z
      .array(SeedImportItemSchema)
      .parse(await (await send('GET', '/api/admin/seed-imports?status=failed', admin)).json());
    expect(items.map((i) => i.sourcePath)).toEqual(['dishes/soup/紫菜蛋花汤.md']);

    // 测试库没有启用的模型供应商：重试会再次失败，并把原因记下来。
    const retried = await send('POST', `/api/admin/seed-imports/${items[0]?.id}/retry`, admin);
    expect(SeedImportItemSchema.parse(await retried.json())).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('模型供应商'),
    });
  });
});
