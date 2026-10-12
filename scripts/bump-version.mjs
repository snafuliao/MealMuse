#!/usr/bin/env node
// 一次更新全部版本声明点（规则 §7.1）。用法：pnpm version:bump 0.2.0
// 声明点清单与 tools/harness/src/rules/versions.ts 保持一致，harness 会校验结果。
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  process.stderr.write('用法：pnpm version:bump <semver>，例如 pnpm version:bump 0.2.0\n');
  process.exit(1);
}

const packageJsonFiles = [
  'package.json',
  'apps/server/package.json',
  'apps/admin-web/package.json',
  'packages/shared/package.json',
  'tools/harness/package.json',
];

for (const file of packageJsonFiles) {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  json.version = version;
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}

const projectYml = 'apps/ios/project.yml';
writeFileSync(
  projectYml,
  readFileSync(projectYml, 'utf8').replace(/(MARKETING_VERSION:\s*)\S+/, `$1${version}`),
);

// OpenAPI 文档的 info.version 来自服务端 package.json，需要重新生成。
execSync('pnpm openapi', { stdio: 'inherit' });
execSync('pnpm lint:harness', { stdio: 'inherit' });
process.stdout.write(`版本已更新为 ${version}\n`);
