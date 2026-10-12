import {
  CreatedInviteSchema,
  HealthStatusSchema,
  IngredientSchema,
  InviteSchema,
  LlmUsageRowSchema,
  MeSchema,
  ModelProviderSchema,
  RecipePageSchema,
  RecipeSchema,
  SeedImportItemSchema,
  UserSummarySchema,
  type CreateInviteRequest,
  type IngredientUpdate,
  type ModelProviderCreate,
  type ModelProviderUpdate,
  type RecipeInput,
  type RecipeListQuery,
  type RecipeStatusChange,
  type SeedImportItem,
} from '@mealmuse/shared';
import { z } from 'zod';
import { request } from './http';

export { ApiError, isUnauthenticated } from './http';

export const fetchHealth = () => request('GET', '/api/health', HealthStatusSchema);

export const auth = {
  me: () => request('GET', '/api/me', MeSchema),
  login: (token: string) => request('POST', '/api/admin/session', MeSchema, { token }),
  logout: () => request('DELETE', '/api/auth/session', null),
};

export const modelProviders = {
  list: () => request('GET', '/api/admin/model-providers', z.array(ModelProviderSchema)),
  create: (input: ModelProviderCreate) =>
    request('POST', '/api/admin/model-providers', ModelProviderSchema, input),
  update: (id: string, input: ModelProviderUpdate) =>
    request('PATCH', `/api/admin/model-providers/${id}`, ModelProviderSchema, input),
  remove: (id: string) => request('DELETE', `/api/admin/model-providers/${id}`, null),
  activate: (id: string) =>
    request('POST', `/api/admin/model-providers/${id}/activate`, ModelProviderSchema),
  test: (id: string) =>
    request('POST', `/api/admin/model-providers/${id}/test`, ModelProviderSchema),
  usage: (days = 7) =>
    request('GET', `/api/admin/llm-usage?days=${days}`, z.array(LlmUsageRowSchema)),
};

export const invites = {
  list: () => request('GET', '/api/admin/invites', z.array(InviteSchema)),
  create: (input: CreateInviteRequest) =>
    request('POST', '/api/admin/invites', CreatedInviteSchema, input),
  revoke: (id: string) => request('POST', `/api/admin/invites/${id}/revoke`, InviteSchema),
};

export const users = {
  list: () => request('GET', '/api/admin/users', z.array(UserSummarySchema)),
  revokeDevice: (id: string) => request('POST', `/api/admin/devices/${id}/revoke`, null),
};

/** 去掉空值后拼成查询串。 */
function query(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
}

export const recipes = {
  list: (q: Partial<RecipeListQuery>) =>
    request('GET', `/api/admin/recipes${query(q)}`, RecipePageSchema),
  get: (id: string) => request('GET', `/api/admin/recipes/${id}`, RecipeSchema),
  create: (input: RecipeInput) => request('POST', '/api/admin/recipes', RecipeSchema, input),
  update: (id: string, input: RecipeInput) =>
    request('PUT', `/api/admin/recipes/${id}`, RecipeSchema, input),
  changeStatus: (id: string, change: RecipeStatusChange) =>
    request('POST', `/api/admin/recipes/${id}/status`, RecipeSchema, change),
};

export const ingredients = {
  list: (q?: string) =>
    request('GET', `/api/admin/ingredients${query({ q })}`, z.array(IngredientSchema)),
  update: (id: string, patch: IngredientUpdate) =>
    request('PATCH', `/api/admin/ingredients/${id}`, IngredientSchema, patch),
};

export const seedImports = {
  list: (status?: SeedImportItem['status']) =>
    request('GET', `/api/admin/seed-imports${query({ status })}`, z.array(SeedImportItemSchema)),
  retry: (id: string) =>
    request('POST', `/api/admin/seed-imports/${id}/retry`, SeedImportItemSchema),
};
