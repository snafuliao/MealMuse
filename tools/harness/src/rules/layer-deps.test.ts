import { describe, expect, it } from 'vitest';
import { fixture } from '../fixture.test-util.js';
import { checkEdge, layerDepsRule, locate } from './layer-deps.js';

const d = (domain: string, layer: string) =>
  locate(`apps/server/src/domains/${domain}/${layer}/x.ts`);

describe('checkEdge', () => {
  it('allows forward edges inside a domain', () => {
    expect(checkEdge(d('recipe', 'service'), d('recipe', 'repo'))).toBeNull();
    expect(checkEdge(d('recipe', 'repo'), d('recipe', 'types'))).toBeNull();
  });

  it('rejects backward edges inside a domain', () => {
    expect(checkEdge(d('recipe', 'repo'), d('recipe', 'service'))).toContain('依赖方向反了');
  });

  it('rejects runtime reaching into repo', () => {
    expect(checkEdge(d('recipe', 'runtime'), d('recipe', 'repo'))).toContain('service');
  });

  it('lets table definitions reference other domains for foreign keys, and nothing more', () => {
    const schema = (domain: string) => locate(`apps/server/src/domains/${domain}/repo/schema.ts`);
    expect(checkEdge(schema('recipe'), schema('identity'))).toBeNull();
    expect(checkEdge(d('recipe', 'repo'), schema('identity'))).toContain('跨领域');
    expect(checkEdge(schema('recipe'), d('identity', 'repo'))).toContain('跨领域');
  });

  it('limits cross-domain edges to types and service', () => {
    expect(checkEdge(d('plan', 'service'), d('recipe', 'service'))).toBeNull();
    expect(checkEdge(d('plan', 'repo'), d('recipe', 'types'))).toBeNull();
    expect(checkEdge(d('plan', 'service'), d('recipe', 'repo'))).toContain('跨领域');
  });

  it('only lets repo/service/runtime use Providers', () => {
    const providers = locate('apps/server/src/providers/index.ts');
    expect(checkEdge(d('recipe', 'service'), providers)).toBeNull();
    expect(checkEdge(d('recipe', 'types'), providers)).toContain('Providers');
  });

  it('keeps Providers independent of domains', () => {
    expect(
      checkEdge(locate('apps/server/src/providers/index.ts'), d('recipe', 'types')),
    ).not.toBeNull();
  });
});

describe('layerDepsRule', () => {
  it('reports the offending import line', () => {
    const root = fixture({
      'apps/server/src/domains/recipe/repo/store.ts':
        "import { x } from 'zod';\nimport { plan } from '../service/plan.js';\n",
      'apps/server/src/domains/recipe/service/plan.ts': 'export const plan = 1;\n',
    });
    const [violation] = layerDepsRule.run(root);
    expect(violation?.line).toBe(2);
    expect(violation?.fix).toContain('依赖方向反了');
  });

  it('exempts test files, which may import the composition root', () => {
    const root = fixture({
      'apps/server/src/domains/recipe/recipe.test.ts':
        "import { createApp } from '../../app.js';\n",
    });
    expect(layerDepsRule.run(root)).toEqual([]);
  });

  it('reports domain files outside a layer directory', () => {
    const root = fixture({ 'apps/server/src/domains/recipe/helpers.ts': 'export {};\n' });
    expect(layerDepsRule.run(root)).toHaveLength(1);
  });
});
