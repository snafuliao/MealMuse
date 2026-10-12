import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  IngredientSchema,
  IngredientUpdateSchema,
  RecipeInputSchema,
  RecipeListQuerySchema,
  RecipePageSchema,
  RecipeSchema,
  RecipeStatusChangeSchema,
  SeedImportItemSchema,
} from '@mealmuse/shared';
import { z } from 'zod';
import type { AppEnv } from '../../../providers/http.js';
import { BEARER_SECURITY, errors, json, jsonBody } from '../../../providers/openapi.js';
import type { RecipeService } from '../service/recipe-service.js';

const IdParams = z.object({ id: z.uuid() });
const admin = { tags: ['admin', 'recipe'], security: BEARER_SECURITY };
const one = (description: string) => json(RecipeSchema, description);

const getRecipe = createRoute({
  tags: ['recipe'],
  security: BEARER_SECURITY,
  method: 'get',
  path: '/recipes/{id}',
  operationId: 'getRecipe',
  summary: '菜谱详情（已发布的菜，或为自己生成、待审核的菜）',
  request: { params: IdParams },
  responses: { 200: one('菜谱详情'), ...errors(401, 404) },
});

const list = createRoute({
  ...admin,
  method: 'get',
  path: '/admin/recipes',
  operationId: 'listRecipes',
  summary: '菜谱列表（按名称、状态、来源、类别、餐次筛选，分页）',
  request: { query: RecipeListQuerySchema },
  responses: { 200: json(RecipePageSchema, '一页菜谱'), ...errors(400, 401, 403) },
});
const detail = createRoute({
  ...admin,
  method: 'get',
  path: '/admin/recipes/{id}',
  operationId: 'getRecipeForAdmin',
  summary: '菜谱详情（任意状态）',
  request: { params: IdParams },
  responses: { 200: one('菜谱详情'), ...errors(401, 403, 404) },
});
const create = createRoute({
  ...admin,
  method: 'post',
  path: '/admin/recipes',
  operationId: 'createRecipe',
  summary: '新建菜谱（直接发布；食材按名称归一，不存在则新建）',
  request: jsonBody(RecipeInputSchema),
  responses: { 200: one('已创建'), ...errors(400, 401, 403) },
});
const update = createRoute({
  ...admin,
  method: 'put',
  path: '/admin/recipes/{id}',
  operationId: 'updateRecipe',
  summary: '编辑菜谱（整体替换食材与步骤，重新派生过敏原与饮食标记）',
  request: { params: IdParams, ...jsonBody(RecipeInputSchema) },
  responses: { 200: one('已更新'), ...errors(400, 401, 403, 404) },
});
const changeStatus = createRoute({
  ...admin,
  method: 'post',
  path: '/admin/recipes/{id}/status',
  operationId: 'changeRecipeStatus',
  summary: '审核或改状态（发布、驳回、下架），可附备注',
  request: { params: IdParams, ...jsonBody(RecipeStatusChangeSchema) },
  responses: { 200: one('状态已更新'), ...errors(400, 401, 403, 404) },
});
const ingredients = createRoute({
  ...admin,
  method: 'get',
  path: '/admin/ingredients',
  operationId: 'listIngredients',
  summary: '食材库（按名称或别名搜索）',
  request: { query: z.object({ q: z.string().trim().max(30).optional() }) },
  responses: { 200: json(z.array(IngredientSchema), '食材列表'), ...errors(401, 403) },
});
const updateIngredient = createRoute({
  ...admin,
  method: 'patch',
  path: '/admin/ingredients/{id}',
  operationId: 'updateIngredient',
  summary: '修改食材（过敏原、饮食标记变化会重新派生相关菜谱）',
  request: { params: IdParams, ...jsonBody(IngredientUpdateSchema) },
  responses: {
    200: json(IngredientSchema, '已更新'),
    ...errors(400, 401, 403, 404),
  },
});
const seedItems = createRoute({
  ...admin,
  method: 'get',
  path: '/admin/seed-imports',
  operationId: 'listSeedImports',
  summary: '种子导入记录',
  request: { query: z.object({ status: SeedImportItemSchema.shape.status.optional() }) },
  responses: { 200: json(z.array(SeedImportItemSchema), '导入记录'), ...errors(401, 403) },
});

const retrySeedItem = createRoute({
  ...admin,
  method: 'post',
  path: '/admin/seed-imports/{id}/retry',
  operationId: 'retrySeedImport',
  summary: '重新导入单条失败的种子菜谱（会调用模型，约 30–90 秒）',
  request: { params: IdParams },
  responses: {
    200: json(SeedImportItemSchema, '本次导入结果'),
    ...errors(400, 401, 403, 404, 502, 503),
  },
});

export function recipeRoutes(service: RecipeService) {
  return new OpenAPIHono<AppEnv>()
    .openapi(getRecipe, async (c) =>
      c.json(await service.getForUser(c.req.valid('param').id, c.get('user')), 200),
    )
    .openapi(list, async (c) => c.json(await service.list(c.req.valid('query')), 200))
    .openapi(detail, async (c) => c.json(await service.getForAdmin(c.req.valid('param').id), 200))
    .openapi(create, async (c) => c.json(await service.create(c.req.valid('json')), 200))
    .openapi(update, async (c) =>
      c.json(await service.update(c.req.valid('param').id, c.req.valid('json')), 200),
    )
    .openapi(changeStatus, async (c) =>
      c.json(
        await service.changeStatus(c.req.valid('param').id, c.req.valid('json'), c.get('user').id),
        200,
      ),
    )
    .openapi(ingredients, async (c) =>
      c.json(await service.listIngredients(c.req.valid('query').q), 200),
    )
    .openapi(updateIngredient, async (c) =>
      c.json(await service.updateIngredient(c.req.valid('param').id, c.req.valid('json')), 200),
    )
    .openapi(seedItems, async (c) =>
      c.json(await service.listSeedItems(c.req.valid('query').status), 200),
    )
    .openapi(retrySeedItem, async (c) =>
      c.json(await service.retrySeedItem(c.req.valid('param').id), 200),
    );
}
