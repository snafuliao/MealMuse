import type { AppConfig } from './config/env.js';
import {
  createIdentityService,
  type IdentityService,
} from './domains/identity/service/identity-service.js';
import {
  createModelConfigService,
  type ModelConfigService,
} from './domains/model-config/service/model-config-service.js';
import {
  createRecipeService,
  type RecipeService,
} from './domains/recipe/service/recipe-service.js';
import { createInfrastructure, type Infrastructure, type Providers } from './providers/index.js';
import { createLlmGateway } from './providers/llm/gateway.js';

export type AppServices = {
  providers: Providers;
  identity: IdentityService;
  modelConfig: ModelConfigService;
  recipe: RecipeService;
};

/** 组合根：Providers 不依赖领域，模型配置由 model-config 领域在这里注入 LLM Gateway。 */
export function composeServices(infrastructure: Infrastructure): AppServices {
  const modelConfig = createModelConfigService(infrastructure);
  const llm = createLlmGateway({
    logger: infrastructure.logger,
    resolveConfig: () => modelConfig.resolveActive(),
    recordCall: (record) => modelConfig.recordCall(record),
  });
  const providers: Providers = { ...infrastructure, llm };
  return {
    providers,
    modelConfig,
    identity: createIdentityService(providers),
    recipe: createRecipeService(providers),
  };
}

export function createServices(config: AppConfig): AppServices & { shutdown(): Promise<void> } {
  const infrastructure = createInfrastructure(config);
  return { ...composeServices(infrastructure), shutdown: () => infrastructure.database.close() };
}
