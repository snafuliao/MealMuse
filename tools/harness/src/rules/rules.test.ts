import { describe, expect, it } from 'vitest';
import { fixture } from '../fixture.test-util.js';
import { openapiSyncRule, schemaNamingRule } from './contracts.js';
import { AGENTS_MAX_LINES, docsRule, REQUIRED_DOCS } from './docs.js';
import { fileSizeRule, MAX_LINES } from './file-size.js';
import { PACKAGE_JSON_FILES, versionsRule } from './versions.js';

describe('fileSizeRule', () => {
  it('flags source files over the limit and ignores other files', () => {
    const long = 'x\n'.repeat(MAX_LINES + 1);
    const root = fixture({ 'apps/server/src/big.ts': long, 'docs/big.md': long });
    const violations = fileSizeRule.run(root);
    expect(violations.map((v) => v.file)).toEqual(['apps/server/src/big.ts']);
  });
});

describe('schemaNamingRule', () => {
  it('requires the Schema suffix on exported zod schemas', () => {
    const root = fixture({
      'packages/shared/src/recipe.ts':
        'export const Recipe = z.object({});\nexport type RecipeSchema = z.infer<typeof Recipe>;\n',
    });
    expect(schemaNamingRule.run(root).map((v) => v.line)).toEqual([1, 2]);
  });
});

describe('openapiSyncRule', () => {
  it('flags a stale iOS copy', () => {
    const root = fixture({
      'apps/server/openapi.json': '{"a":1}',
      'apps/ios/MealMuseKit/Sources/MealMuseAPI/openapi.json': '{"a":0}',
    });
    expect(openapiSyncRule.run(root)).toHaveLength(1);
  });
});

describe('docsRule', () => {
  const complete = Object.fromEntries(
    REQUIRED_DOCS.map((p) => [p.endsWith('.md') ? p : `${p}/.gitkeep`, '# ok\n']),
  );

  it('passes a complete documentation set', () => {
    expect(docsRule.run(fixture(complete))).toEqual([]);
  });

  it('flags an oversized AGENTS.md and broken path references', () => {
    const root = fixture({
      ...complete,
      'AGENTS.md': 'line\n'.repeat(AGENTS_MAX_LINES + 1),
      'docs/DESIGN.md': 'see [spec](product-specs/missing.md) and `docs/gone.md`\n',
    });
    const messages = docsRule.run(root).map((v) => v.message);
    expect(messages).toHaveLength(3);
  });

  it('flags references to build output even when it exists locally', () => {
    const root = fixture({
      ...complete,
      'apps/ios/build/MealMuse.app/Info.plist': '',
      'docs/DESIGN.md': 'artifacts live in `apps/ios/build/`\n',
    });
    const [violation] = docsRule.run(root);
    expect(violation?.message).toContain('构建产物');
  });
});

describe('versionsRule', () => {
  it('flags any declaration that drifts from the root version', () => {
    const files = Object.fromEntries(
      PACKAGE_JSON_FILES.map((f) => [f, JSON.stringify({ version: '1.0.0' })]),
    );
    const root = fixture({
      ...files,
      'apps/ios/project.yml': 'settings:\n  base:\n    MARKETING_VERSION: 0.9.0\n',
    });
    expect(versionsRule.run(root).map((v) => v.file)).toEqual(['apps/ios/project.yml']);
  });
});
