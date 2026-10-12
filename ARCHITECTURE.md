# 架构总览

MealMuse 由三部分组成：服务端负责 Agent、数据与对外接口；iOS 客户端供日常使用；Web 管理端负责模型配置与菜谱管理。技术栈结论与出处见 `docs/design-docs/core-beliefs.md`。

```text
 iOS App (SwiftUI) ──┐                       ┌── PostgreSQL + pgvector
                     ├── HTTP /api ── Server ┤
 Admin Web (React) ──┘   (OpenAPI)   (Hono)  └── 大模型 API（密钥只在服务端）
```

## 目录地图

| 路径 | 内容 |
|---|---|
| `apps/server/` | 服务端：Hono + Drizzle，按领域分层（见下文） |
| `apps/server/openapi.json` | 由路由定义生成的接口契约，是 iOS 客户端代码的唯一来源 |
| `apps/server/drizzle/` | 数据库迁移（drizzle-kit 生成） |
| `apps/admin-web/` | Web 管理端：React + Vite + TanStack Query |
| `packages/shared/` | 跨端共享的 zod schema 与类型（全局的 Types 层） |
| `apps/ios/project.yml` | XcodeGen 工程描述；`.xcodeproj` 由它生成，不入库 |
| `apps/ios/MealMuse/` | iOS App 外壳：只放 SwiftUI 视图与启动代码 |
| `apps/ios/MealMuseKit/` | iOS 业务逻辑 Swift Package，可用 `swift test` 在命令行验证 |
| `tools/harness/` | 自定义 linter 与结构测试 |
| `scripts/` | 版本 bump、iOS 测试等脚本 |
| `docs/` | 记录系统：需求、设计、计划、规范 |

## 服务端分层

每个业务域放在 `apps/server/src/domains/<domain>/` 下，内部固定分层，依赖只能向前：

```text
types → config → repo → service → runtime
```

| 层 | 职责 | 可以依赖 |
|---|---|---|
| `types/` | 领域内部类型；对外数据形状放 `@mealmuse/shared` | shared |
| `config/` | 领域常量与开关 | types |
| `repo/` | 数据访问；Drizzle 表定义放 `repo/schema.ts` | types、config、Providers |
| `service/` | 业务逻辑、Agent 编排 | types、config、repo、Providers、其他领域的 service |
| `runtime/` | HTTP 路由（OpenAPI 定义） | types、config、service、Providers；**不能直连 repo** |

- 跨领域只允许依赖对方的 `types`，或在 service / runtime 中调用对方的 `service`。
- 横切关注点统一从 `apps/server/src/providers/` 的 `Providers` 进入；领域代码不直接导入 `src/config/`。
- 组合根：`src/composition.ts` 创建各领域 service 并补齐 `Providers.llm`（模型配置由 model-config 领域注入，Providers 本身不依赖领域）；`src/app.ts` 挂载鉴权、错误处理与各领域路由；`src/main.ts` 启动进程并处理优雅退出。
- 集成测试（`*.test.ts`）属于组合层，可以导入组合根，不受分层检查约束。
- UI 层在服务端之外：Web 管理端与 iOS 只通过 HTTP 接口访问数据。
- 规则由 `tools/harness/src/rules/layer-deps.ts` 机械检查。

当前领域：

| 领域 | 内容 |
|---|---|
| system | 健康检查 |
| identity | 邀请码、设备令牌、管理端登录 |
| model-config | 模型供应商配置（Key 加密存储）、能力探测、调用统计 |

`Providers` 提供：config、logger（pino）、database（Drizzle + postgres.js）、secrets（AES-256-GCM）、llm（OpenAI 兼容的 LLM Gateway，见 `docs/design-docs/recommendation-agent.md`）。

## 鉴权

- `/api` 下除健康检查、OpenAPI 文档、邀请码注册、管理端登录外，全部要求设备令牌：iOS 用 `Authorization: Bearer`，管理端用同一令牌的 HttpOnly Cookie（`mm_session`）。
- `/api/admin/*` 还要求管理员角色。邀请码与令牌只存 SHA-256 哈希。

## 接口契约流转

1. 在 `packages/shared` 定义 zod schema（命名以 `Schema` 结尾）。
2. 服务端路由用 `@hono/zod-openapi` 引用这些 schema。
3. `pnpm openapi` 生成 `apps/server/openapi.json`，并复制到 `apps/ios/MealMuseKit/Sources/MealMuseAPI/`。
4. iOS 的 `MealMuseAPI` 模块由 swift-openapi-generator 在构建时生成类型化客户端。
5. 管理端用同一份 zod schema 解析响应。

harness 校验两份 openapi.json 一致，`pnpm verify` 校验它与服务端代码一致（项目不使用 GitHub CI，见 `docs/CI.md`）。

## 数据

- PostgreSQL 17 + pgvector（本地用 `docker-compose.yml`，宿主机端口 5433）。
- 迁移在 `apps/server/drizzle/`，由 `pnpm --filter @mealmuse/server db:generate` 根据各领域的 repo/schema.ts 生成，`db:migrate` 应用到开发库。
- 测试使用独立的 `mealmuse_test` 库：vitest 全局初始化时自动创建并迁移，每个用例前清表。需要本地数据库已启动（`pnpm dev:db`）。
