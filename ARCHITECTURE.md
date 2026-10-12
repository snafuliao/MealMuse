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
- 组合根 `src/app.ts` 挂载各领域路由，`src/main.ts` 启动进程并处理优雅退出。
- UI 层在服务端之外：Web 管理端与 iOS 只通过 HTTP 接口访问数据。
- 规则由 `tools/harness/src/rules/layer-deps.ts` 机械检查。

## 接口契约流转

1. 在 `packages/shared` 定义 zod schema（命名以 `Schema` 结尾）。
2. 服务端路由用 `@hono/zod-openapi` 引用这些 schema。
3. `pnpm openapi` 生成 `apps/server/openapi.json`，并复制到 `apps/ios/MealMuseKit/Sources/MealMuseAPI/`。
4. iOS 的 `MealMuseAPI` 模块由 swift-openapi-generator 在构建时生成类型化客户端。
5. 管理端用同一份 zod schema 解析响应。

harness 校验两份 openapi.json 一致，CI 校验它与服务端代码一致。

## 数据

- PostgreSQL 17 + pgvector（本地用 `docker-compose.yml`，宿主机端口 5433）。
- 迁移在 `apps/server/drizzle/`；第一条迁移启用 `vector` 扩展。
- 菜谱数据模型尚未设计。添加第一张表时新建 `apps/server/src/domains/<domain>/repo/schema.ts`，在此之前 `drizzle-kit generate` 会因找不到 schema 文件而报错。
