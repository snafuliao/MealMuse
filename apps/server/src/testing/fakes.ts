import { pino } from 'pino';
import type { AppServices } from '../composition.js';
import type { AppConfig } from '../config/env.js';
import type { Providers } from '../providers/index.js';
import type { LlmGateway } from '../providers/llm/gateway.js';
import { createSecrets } from '../providers/secrets.js';

export const TEST_SECRETS_KEY = Buffer.alloc(32, 7).toString('base64');

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    databaseUrl: 'postgres://unused',
    port: 0,
    logLevel: 'silent',
    environment: 'test',
    modelSecretsKey: TEST_SECRETS_KEY,
    version: '9.9.9',
    ...overrides,
  };
}

const unusedLlm: LlmGateway = {
  isConfigured: async () => false,
  completeText: () => Promise.reject(new Error('fake llm: not used in this test')),
  completeJson: () => Promise.reject(new Error('fake llm: not used in this test')),
  embed: () => Promise.reject(new Error('fake llm: not used in this test')),
};

/** 不连数据库的 Providers 替身，供只测路由组装的用例使用。 */
export function fakeProviders(options: { databaseUp?: boolean } = {}): Providers {
  return {
    config: testConfig(),
    logger: pino({ level: 'silent' }),
    database: {
      db: undefined as never,
      ping: async () => options.databaseUp ?? true,
      close: async () => {},
    },
    secrets: createSecrets(TEST_SECRETS_KEY),
    llm: unusedLlm,
  };
}

/** 领域服务未被调用时的占位：一旦被调用就让测试失败。 */
function unused<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get: (_, prop) => () =>
      Promise.reject(new Error(`${name}.${String(prop)} should not be called`)),
  });
}

export function fakeServices(providers: Providers = fakeProviders()): AppServices {
  return {
    providers,
    identity: unused('identity'),
    modelConfig: unused('modelConfig'),
    recipe: unused('recipe'),
  };
}
