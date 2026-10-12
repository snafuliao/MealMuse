#!/usr/bin/env bash
# 完整本地门禁（项目不使用 GitHub CI，见 docs/CI.md）。pre-push 钩子会自动运行。
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n▶ %s\n' "$1"; }

step 'TypeScript：格式、lint、harness、类型、测试、构建'
pnpm check

step 'OpenAPI 文档与服务端代码一致'
pnpm openapi >/dev/null
if ! git diff --quiet -- apps/server/openapi.json apps/ios/MealMuseKit/Sources/MealMuseAPI/openapi.json; then
  echo '✖ openapi.json 已过期。修复：已自动重新生成，检查 git diff 后提交。' >&2
  exit 1
fi

step 'iOS：格式检查'
pnpm ios:format:check

step 'iOS：MealMuseKit 测试'
pnpm ios:test

step 'iOS：生成工程并构建 App'
pnpm ios:build

printf '\n✔ 全部本地门禁通过\n'
