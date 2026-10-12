# CI 配置决定

## 1. 框架判定
- 判定结果：其他（非 Tauri）
- 判定证据：`docs/design-docs/core-beliefs.md`「技术栈结论」——iOS 为 SwiftUI，服务端为 Hono（TypeScript），Web 管理端为 React + Vite；用户于 2026-10-12 交互确认。新建项目不做文件扫描判定（规则 §3.3）。
- 判定日期：2026-10-12

## 2. 交互确认记录（仅 Tauri 填写）
不适用。框架判定 = 其他类型，按规则 §3.5 不询问 Tauri 三问，本项不适用多平台打包与 Release 流水线。

## 3. 落地说明
- 不生成 Tauri 打包发布流水线（`release.yml`）。
- 基础门禁照建（规则 §13 阶段 A、B）：`.github/workflows/ci.yml`，push 到 main 和 PR 时触发。
  - `typescript` job（ubuntu）：格式检查 → ESLint 与 harness → 类型检查 → 测试 → 构建 → 校验 openapi.json 与服务端代码一致。
  - `ios` job（macOS）：swift format 检查 → MealMuseKit 测试 → XcodeGen 生成工程 → xcodebuild 构建模拟器版 App（不签名）。
- 本地等价命令：`pnpm check`、`pnpm ios:test`，以及 XcodeGen 生成工程后运行同样的 xcodebuild 命令（即 `pnpm ios:build`；2026-10-12 已在本地 Xcode 27 构建并在模拟器运行通过）。
- 远程仓库：https://github.com/snafuliao/MealMuse （2026-10-12 首次推送）。首次运行（run 38261228145）两个 job 均未启动：GitHub 账号因账单问题被锁定，与代码无关。账单解决后重跑即可。

## 4. 变更历史
| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-10-12 | 建立本文件，判定为「其他」，跳过 Tauri 三问 | 用户确认技术栈为 SwiftUI + TS，未选 Tauri |
| 2026-10-12 | 新增 `.github/workflows/ci.yml` 基础门禁 | Day 0 第 8 项 |
| 2026-10-12 | 首次推送；CI 因账号账单锁定未运行 | 等待用户处理 GitHub 账单 |
