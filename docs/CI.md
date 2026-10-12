# CI 配置决定

## 1. 框架判定
- 判定结果：其他（非 Tauri）
- 判定证据：`docs/design-docs/core-beliefs.md`「技术栈结论」——iOS 为 SwiftUI，服务端为 Hono（TypeScript），Web 管理端为 React + Vite；用户于 2026-10-12 交互确认。新建项目不做文件扫描判定（规则 §3.3）。
- 判定日期：2026-10-12

## 2. 交互确认记录（仅 Tauri 填写）
不适用。框架判定 = 其他类型，按规则 §3.5 不询问 Tauri 三问，本项不适用多平台打包与 Release 流水线。

## 3. 落地说明

- **用户于 2026-10-12 明确放弃 GitHub CI**（账号没有余额，Actions 被账单锁定）。`.github/workflows/` 已删除，后续任何阶段都不得静默补建；如果要恢复，需要用户重新决定并记入本文件。
- 门禁全部在本地执行：
  - `pnpm verify`（`scripts/verify.sh`）：TS 的格式、ESLint、harness、类型、测试、构建 → OpenAPI 文档与服务端代码一致 → iOS 格式检查 → MealMuseKit 测试 → XcodeGen 生成工程并构建 App。
  - `.githooks/pre-push` 在每次推送前自动运行 `pnpm verify`；紧急情况可以用 `git push --no-verify` 跳过，但跳过时必须在提交信息里注明。
  - 每次会话的最后一次提交前也要运行 `pnpm verify`（`AGENTS.md` 会话纪律）。
- 远程仓库 https://github.com/snafuliao/MealMuse 只用于托管代码，不运行 workflow。
- 不生成 Tauri 打包发布流水线（框架判定为其他类型）。

## 4. 变更历史
| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-10-12 | 建立本文件，判定为「其他」，跳过 Tauri 三问 | 用户确认技术栈为 SwiftUI + TS，未选 Tauri |
| 2026-10-12 | 新增 `.github/workflows/ci.yml` 基础门禁 | Day 0 第 8 项 |
| 2026-10-12 | 首次推送；CI 因账号账单锁定未运行 | 等待用户处理 GitHub 账单 |
| 2026-10-12 | 删除 GitHub CI，改为本地 `pnpm verify` + pre-push 钩子 | 用户决定不使用 GitHub CI |
