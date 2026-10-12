import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { readText } from '../files.js';
import type { Rule, Violation } from '../types.js';

/** 所有版本声明点（规则 §7.1）。新增 package 或平台时在这里登记，bump 脚本读同一份清单。 */
export const PACKAGE_JSON_FILES = [
  'package.json',
  'apps/server/package.json',
  'apps/admin-web/package.json',
  'packages/shared/package.json',
  'tools/harness/package.json',
];
export const IOS_PROJECT_FILE = 'apps/ios/project.yml';
export const OPENAPI_FILES = [
  'apps/server/openapi.json',
  'apps/ios/MealMuseKit/Sources/MealMuseAPI/openapi.json',
];

const VersionedSchema = z.object({ version: z.string() });
const OpenApiSchema = z.object({ info: z.object({ version: z.string() }) });
const MARKETING_VERSION = /^\s*MARKETING_VERSION:\s*["']?([^"'\s]+)["']?\s*$/m;

export function declaredVersions(root: string): Array<{ file: string; version: string | null }> {
  const result: Array<{ file: string; version: string | null }> = [];
  for (const file of PACKAGE_JSON_FILES) {
    const parsed = VersionedSchema.safeParse(JSON.parse(readText(root, file)));
    result.push({ file, version: parsed.success ? parsed.data.version : null });
  }
  if (existsSync(join(root, IOS_PROJECT_FILE))) {
    const match = MARKETING_VERSION.exec(readText(root, IOS_PROJECT_FILE));
    result.push({ file: IOS_PROJECT_FILE, version: match?.[1] ?? null });
  }
  for (const file of OPENAPI_FILES) {
    if (!existsSync(join(root, file))) continue;
    const parsed = OpenApiSchema.safeParse(JSON.parse(readText(root, file)));
    result.push({ file, version: parsed.success ? parsed.data.info.version : null });
  }
  return result;
}

export const versionsRule: Rule = {
  id: '7.1 versions',
  description: '所有版本声明点一致',
  run(root) {
    const [rootDecl, ...others] = declaredVersions(root);
    const expected = rootDecl?.version;
    const violations: Violation[] = [];
    for (const { file, version } of others) {
      if (version !== expected) {
        violations.push({
          rule: this.id,
          file,
          message: `版本为 ${version ?? '（缺失）'}，与根 package.json 的 ${expected ?? '（缺失）'} 不一致。`,
          fix: '不要手改单个文件：运行 `pnpm version:bump <新版本>` 一次更新全部声明点。',
        });
      }
    }
    return violations;
  },
};
