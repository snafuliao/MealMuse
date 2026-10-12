# 前端规范

## Web 管理端（`apps/admin-web/`）

- React + Vite，服务端状态统一用 TanStack Query，不另建全局状态库。
- 所有请求集中在 `src/api/`，响应用 `@mealmuse/shared` 的 schema 解析后再交给组件。
- 按功能分目录：`src/features/<feature>/`。
- 测试：Vitest + Testing Library（happy-dom 环境）；测试面向用户可见行为，不测实现细节。

## iOS（`apps/ios/`）

- SwiftUI，最低 iOS 17。
- 视图放 `MealMuse/`；可测试的逻辑一律放 `MealMuseKit/`，用 `swift test` 覆盖。
- 网络访问只通过 `MealMuseAPI` 生成的客户端；生成类型在 `MealMuseKit` 内转换为 App 自己的模型，不让视图直接依赖生成代码。
- 格式：`swift format`，配置在 `apps/ios/.swift-format`。
