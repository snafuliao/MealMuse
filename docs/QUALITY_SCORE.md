# 质量评分

按领域与层打分（A 优秀 / B 合格 / C 有明显差距 / — 未开始），由定期的垃圾回收任务更新。

| 领域 / 模块 | 测试 | 文档 | 边界解析 | 可观测性 | 备注 |
|---|---|---|---|---|---|
| server: system（健康检查） | B | B | A | B | 只有单元测试 |
| server: identity | A | B | A | B | 真实数据库集成测试覆盖注册、撤销、越权 |
| server: model-config + LLM Gateway | A | B | A | B | Gateway 用假接口测重试与纠错；真实中转站未探测（TD-6） |
| admin-web | B | B | A | — | 登录、模型配置、邀请与用户；浏览器中实测通过 |
| ios: MealMuseKit | B | B | A | — | 注册、恢复、撤销在模拟器中实测通过；尚无 UI 自动化测试 |
| tools/harness | A | B | — | — | 6 条规则，16 个测试 |

最近更新：2026-10-12（M1）。
