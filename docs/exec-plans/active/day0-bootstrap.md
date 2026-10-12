# 执行计划：Day 0 项目奠基

- **状态**：active
- **创建日期**：2026-10-12
- **负责人/驱动**：用户掌舵 / 智能体执行

## 目标
按 `docs/HARNESS-RULES.md` §1.2 交付 Day 0 的 10 项，并通过 §13 阶段 A 验收：仓库结构、包管理、应用骨架、`AGENTS.md`、`ARCHITECTURE.md`、`docs/` 结构、第一批 linter 与结构测试、lint / test / build 门禁全部可跑通。

## 技术栈
见 `docs/design-docs/core-beliefs.md`「技术栈结论」。摘要：

- iOS：Swift + SwiftUI，XcodeGen + SPM，xcodebuild 构建；
- 服务端：TypeScript + Hono + Drizzle ORM，PostgreSQL + pgvector；
- Web 管理端：TypeScript + React + Vite；
- TS 包管理：pnpm workspace。

## 拆解
- [x] 第 0 项：需求澄清结论（`docs/requirements.md`）
- [x] 第 0 项：技术栈结论（`docs/design-docs/core-beliefs.md`）
- [x] 第 9 项：框架判定与 CI 决策（`docs/CI.md`，判定为其他类型）
- [x] 初始化 Git 仓库；`.gitignore`、格式化规则、提交规范
- [x] pnpm workspace 与锁文件策略
- [x] 应用骨架：服务端、Web 管理端、共享包、iOS 工程
- [x] `AGENTS.md`（≤100 行）
- [x] `ARCHITECTURE.md`
- [x] `docs/` 其余目录与规范文件
- [x] 第一批自定义 linter / 结构测试（至少 3 条）
- [x] CI 门禁骨架：lint / test / build

## 待办调研（首版范围内，不阻塞 Day 0）
- [x] 一键购买调研：把所需食材加入盒马等生鲜超市购物车的可行路径（开放接口、深链接 / Universal Links、iOS 快捷指令等）。结论见 `docs/design-docs/one-click-purchase-research.md`：首版做「采购清单＋跳转」，不做逆向接口与界面自动化。

## 决策日志
| 日期 | 决策 | 理由 |
|---|---|---|
| 2026-10-12 | iOS 采用 SwiftUI 原生，不用 Tauri | 用户选择；iOS 体验与系统能力最佳 |
| 2026-10-12 | 服务端 Hono + Drizzle，数据库 PostgreSQL + pgvector | 用户选择；类型安全、可生成 OpenAPI，pgvector 支持菜谱语义检索 |
| 2026-10-12 | Web 管理端 React + Vite，包管理 pnpm workspace | 用户选择；管理后台不需要 SSR |
| 2026-10-12 | iOS 工程用 XcodeGen + SPM，`.xcodeproj` 不入库 | 用户选择；文本化配置对智能体友好 |
| 2026-10-12 | iOS 业务逻辑放进 MealMuseKit Swift Package | 不依赖 Xcode 也能用 `swift test` 验证；本机只有 Command Line Tools |
| 2026-10-12 | 本地数据库映射到宿主机 5433 端口 | 5432 已被本机其他容器占用 |
| 2026-10-12 | TypeScript 固定 6.0.3 | typescript-eslint 8.71 仅支持 TS < 6.1 |
| 2026-10-12 | 管理端测试用 happy-dom 而不是 jsdom | jsdom 30 要求 Node ≥ 24.15，本机为 24.2 |
| 2026-10-12 | 接口契约：shared zod schema → OpenAPI → swift-openapi-generator | 两种语言共用一份契约，harness 与 CI 校验一致性 |
| 2026-10-12 | 一键购买首版形态定为「采购清单＋跳转」，不做逆向接口与界面自动化 | 四家平台都没有买家侧加购接口；逆向有合规与封号风险（见调研文档） |

## 进度日志
| 日期 | 进展 | 阻塞 |
|---|---|---|
| 2026-10-12 | 需求确认、技术栈确认、框架判定完成并落盘 | 无 |
| 2026-10-12 | Day 0 骨架完成：TS 门禁本地全绿，MealMuseKit 测试通过，服务端已连上本地 Postgres 端到端验证 | iOS App 外壳本地无法构建（无 Xcode），CI 尚未运行（无远程仓库） |
| 2026-10-12 | 一键购买调研完成，结论文档已登记到设计文档索引 | 页面级跳转落点需要真机验证 |
| 2026-10-12 | 装好 Xcode 27：App 外壳本地 xcodebuild 构建通过，无项目代码警告；修复 ios-test.sh 在完整 Xcode 下的空数组展开错误 | 还没有 iOS 模拟器运行时 |

## 关联
- 需求：`docs/requirements.md`
- 设计文档：`docs/design-docs/core-beliefs.md`
- 技术债：`docs/exec-plans/tech-debt-tracker.md`
- CI 决策：`docs/CI.md`
