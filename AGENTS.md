# AGENTS.md

> 本文件是**内容目录**，不是百科全书。需要细节时，按下方指引跳转。

## 这是什么项目

MealMuse：基于 Agent 的「每天吃什么」助手——按个人口味与饮食记录推荐每日菜谱（含食材准备与做法），并回答饮食问题。初期供作者本人及身边的人使用。

## 如何开始

- 需求：`docs/requirements.md`
- 架构总览与目录地图：`ARCHITECTURE.md`
- 设计理念与技术栈结论：`docs/design-docs/core-beliefs.md`
- 产品规格：`docs/product-specs/index.md`
- 当前执行计划：`docs/exec-plans/active/`
- CI 与发布决策：`docs/CI.md`
- 施工期规则（施工完成后按其 §16 归档）：`docs/HARNESS-RULES.md`——**每次新会话先读**

## 常用命令

| 目的 | 命令 |
|---|---|
| 安装依赖 | `pnpm install` |
| 启动本地数据库（端口 5433） | `pnpm dev:db`，然后在 `apps/server` 下运行 `pnpm db:migrate` |
| 启动服务端 / 管理端 | `pnpm dev:server` / `pnpm dev:admin` |
| **完整本地门禁（替代 CI）** | `pnpm verify`（TS 全部检查 + OpenAPI 一致性 + iOS 格式、测试、构建；pre-push 自动运行） |
| 只跑 TS 门禁 | `pnpm check` |
| iOS 逻辑测试与格式 | `pnpm ios:test` / `pnpm ios:format:check` |
| iOS 生成工程并构建 | `pnpm ios:build`（产物在 apps/ios/build，已 gitignore；模拟器内的 localhost:8787 即本机服务端） |
| 改了接口后 | `pnpm openapi`（同时更新 iOS 端副本） |
| 管理端登录令牌 / 导入 .env 中的模型配置 | `pnpm --filter @mealmuse/server admin:token --name 名字` / `pnpm --filter @mealmuse/server llm:import-env` |
| 升级版本 | `pnpm version:bump <semver>` |

## 硬性约束（不可违反）

- 服务端分层：`types → config → repo → service → runtime`，只能向前依赖；runtime 不直连 repo。
- 横切关注点（日志、数据库、配置、模型客户端）只经 `Providers` 进入领域代码。
- 边界处必须解析数据形状：环境变量、HTTP 请求与响应、模型输出都要过 schema。
- 结构化日志：禁止 `console`，禁止拼接日志字符串。
- 源码单文件不超过 300 行；`AGENTS.md` 不超过 100 行。
- 大模型密钥只存在于服务端；iOS 与管理端不直接调用模型。
- 不要手改 `openapi.json`、`.xcodeproj` 或任何版本号；分别用 `pnpm openapi`、XcodeGen 和 `pnpm version:bump` 生成。
- 以上约束由 ESLint 与 `tools/harness/` 机械检查，报错信息里写明了修复方法。

## 规范索引

- 设计：`docs/DESIGN.md`
- 前端（管理端与 iOS）：`docs/FRONTEND.md`
- 计划：`docs/PLANS.md`
- 产品判断：`docs/PRODUCT_SENSE.md`
- 可靠性：`docs/RELIABILITY.md`
- 安全：`docs/SECURITY.md`
- 质量评分：`docs/QUALITY_SCORE.md`
- 技术债：`docs/exec-plans/tech-debt-tracker.md`

## 工作方式（会话纪律）

- 变更前先读相关 `docs/`，变更后同步更新文档；交互式决策确认后必须写进仓库文档。
- 复杂工作先在 `docs/exec-plans/active/` 写计划，完成后移入 `docs/exec-plans/completed/`。
- 提交按单一职责拆分，使用 Conventional Commits 前缀（`feat:` `fix:` `docs:` …），由 `.githooks/commit-msg` 校验；body 写清动机、方案与影响面。
- 项目不使用 GitHub CI（`docs/CI.md`）：会话的最后一次提交必须通过 `pnpm verify`，并在 message 末尾注明 `[已测试]` 或 `[未测试]`。
- 版本声明点（各 `package.json`、`apps/ios/project.yml`）必须一致，只能用 bump 脚本修改。
- 用户提示词记录：每轮把用户提示词结构化后追加到仓库根的 prompt-history.txt（已 gitignore，只追加、不读取；少于 10 个字的不记录）。
