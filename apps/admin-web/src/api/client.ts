import {
  CreatedInviteSchema,
  HealthStatusSchema,
  InviteSchema,
  LlmUsageRowSchema,
  MeSchema,
  ModelProviderSchema,
  UserSummarySchema,
  type CreateInviteRequest,
  type ModelProviderCreate,
  type ModelProviderUpdate,
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
