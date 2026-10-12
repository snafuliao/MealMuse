import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { lineOf, listFiles, readText } from '../files.js';
import type { Rule, Violation } from '../types.js';
import { OPENAPI_FILES } from './versions.js';

/** iOS 生成插件读取的 openapi.json 必须与服务端产出的一致。 */
export const openapiSyncRule: Rule = {
  id: 'T4 openapi-sync',
  description: 'iOS 端的 OpenAPI 副本与服务端一致',
  run(root) {
    const [source, ...copies] = OPENAPI_FILES;
    if (!source || !existsSync(join(root, source))) {
      return [
        {
          rule: this.id,
          file: source ?? 'apps/server/openapi.json',
          message: '缺少服务端 OpenAPI 文档。',
          fix: '运行 `pnpm openapi` 生成。',
        },
      ];
    }
    const expected = readText(root, source);
    return copies
      .filter((copy) => !existsSync(join(root, copy)) || readText(root, copy) !== expected)
      .map((copy) => ({
        rule: this.id,
        file: copy,
        message: `与 ${source} 不一致，iOS 客户端会按过期的接口生成代码。`,
        fix: '修改服务端路由或 schema 后运行 `pnpm openapi`，不要手改任何一份 openapi.json。',
      }));
  },
};

const SHARED_SRC = 'packages/shared/src';
const EXPORTED_ZOD = /export\s+const\s+(\w+)\s*=\s*z\b/g;
const EXPORTED_INFER = /export\s+type\s+(\w+)\s*=\s*z\.(?:infer|input|output)</g;

/** 共享包里 zod schema 以 Schema 结尾，推导出的类型不带 Schema 后缀。 */
export const schemaNamingRule: Rule = {
  id: 'T3 schema-naming',
  description: '共享 schema 与类型的命名约定',
  run(root) {
    const violations: Violation[] = [];
    for (const file of listFiles(root, SHARED_SRC)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const text = readText(root, file);
      for (const match of text.matchAll(EXPORTED_ZOD)) {
        const name = match[1] ?? '';
        if (!/^[A-Z]\w*Schema$/.test(name)) {
          violations.push({
            rule: this.id,
            file,
            line: lineOf(text, match.index),
            message: `zod schema「${name}」命名不符合约定。`,
            fix: '导出的 zod schema 用 PascalCase 并以 Schema 结尾，例如 RecipeSchema。',
          });
        }
      }
      for (const match of text.matchAll(EXPORTED_INFER)) {
        const name = match[1] ?? '';
        if (!/^[A-Z]\w*$/.test(name) || name.endsWith('Schema')) {
          violations.push({
            rule: this.id,
            file,
            line: lineOf(text, match.index),
            message: `推导类型「${name}」命名不符合约定。`,
            fix: '由 schema 推导的类型用 PascalCase 且去掉 Schema 后缀，例如 type Recipe = z.infer<typeof RecipeSchema>。',
          });
        }
      }
    }
    return violations;
  },
};
