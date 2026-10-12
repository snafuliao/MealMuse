import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  LlmUsageRowSchema,
  ModelProviderCreateSchema,
  ModelProviderSchema,
  ModelProviderUpdateSchema,
} from '@mealmuse/shared';
import { z } from 'zod';
import type { AppEnv } from '../../../providers/http.js';
import { BEARER_SECURITY, errors, json, jsonBody, noContent } from '../../../providers/openapi.js';
import type { ModelConfigService } from '../service/model-config-service.js';

const IdParams = z.object({ id: z.uuid() });
const base = { tags: ['admin', 'model-config'], security: BEARER_SECURITY };
const one = (description: string) => json(ModelProviderSchema, description);

const list = createRoute({
  ...base,
  method: 'get',
  path: '/admin/model-providers',
  operationId: 'listModelProviders',
  summary: '模型供应商列表（不含 API Key）',
  responses: { 200: json(z.array(ModelProviderSchema), '供应商列表'), ...errors(401, 403) },
});
const create = createRoute({
  ...base,
  method: 'post',
  path: '/admin/model-providers',
  operationId: 'createModelProvider',
  summary: '新增供应商',
  request: jsonBody(ModelProviderCreateSchema),
  responses: { 200: one('已创建'), ...errors(400, 401, 403, 503) },
});
const update = createRoute({
  ...base,
  method: 'patch',
  path: '/admin/model-providers/{id}',
  operationId: 'updateModelProvider',
  summary: '修改供应商（省略 apiKey 表示保留原值）',
  request: { params: IdParams, ...jsonBody(ModelProviderUpdateSchema) },
  responses: { 200: one('已更新'), ...errors(400, 401, 403, 404, 503) },
});
const remove = createRoute({
  ...base,
  method: 'delete',
  path: '/admin/model-providers/{id}',
  operationId: 'deleteModelProvider',
  summary: '删除供应商',
  request: { params: IdParams },
  responses: { ...noContent, ...errors(401, 403, 404) },
});
const activate = createRoute({
  ...base,
  method: 'post',
  path: '/admin/model-providers/{id}/activate',
  operationId: 'activateModelProvider',
  summary: '设为启用（同一时刻只有一个）',
  request: { params: IdParams },
  responses: { 200: one('已启用'), ...errors(401, 403, 404) },
});
const test = createRoute({
  ...base,
  method: 'post',
  path: '/admin/model-providers/{id}/test',
  operationId: 'testModelProvider',
  summary: '测试连接并探测能力（对话、结构化输出、工具调用、Embedding）',
  request: { params: IdParams },
  responses: { 200: one('探测完成，结果见 capabilities'), ...errors(401, 403, 404, 503) },
});
const usage = createRoute({
  ...base,
  method: 'get',
  path: '/admin/llm-usage',
  operationId: 'getLlmUsage',
  summary: '近 N 天按用途统计的模型调用',
  request: { query: z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }) },
  responses: { 200: json(z.array(LlmUsageRowSchema), '用量统计'), ...errors(401, 403) },
});

export function modelConfigRoutes(service: ModelConfigService) {
  return new OpenAPIHono<AppEnv>()
    .openapi(list, async (c) => c.json(await service.list(), 200))
    .openapi(create, async (c) => c.json(await service.create(c.req.valid('json')), 200))
    .openapi(update, async (c) =>
      c.json(await service.update(c.req.valid('param').id, c.req.valid('json')), 200),
    )
    .openapi(remove, async (c) => {
      await service.remove(c.req.valid('param').id);
      return c.body(null, 204);
    })
    .openapi(activate, async (c) => c.json(await service.activate(c.req.valid('param').id), 200))
    .openapi(test, async (c) => c.json(await service.testConnection(c.req.valid('param').id), 200))
    .openapi(usage, async (c) => c.json(await service.usage(c.req.valid('query').days), 200));
}
