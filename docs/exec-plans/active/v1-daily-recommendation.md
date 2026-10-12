# 执行计划：首版——每日推荐与饮食问答

- **状态**：active（M1 完成；M2 进行中，见文末「交接：下一步」）
- **创建日期**：2026-10-12
- **负责人/驱动**：用户掌舵 / 智能体执行

## 目标

交付 `docs/product-specs/daily-recommendation.md` 与 `docs/product-specs/admin.md` 描述的首版，并满足产品规格第 6 节的验收标准。

## 设计文档

- 数据模型：`docs/design-docs/data-model.md`
- 推荐 Agent、问答 Agent 与模型接入：`docs/design-docs/recommendation-agent.md`
- 一键购买调研：`docs/design-docs/one-click-purchase-research.md`

## 拆解（按里程碑，每个里程碑结束都要门禁全绿，并在模拟器里验证）

### M1 账号与模型接入
- [x] identity 领域：邀请码、设备令牌、鉴权中间件（中间件在 providers/http.ts，鉴权函数由组合根注入）
- [x] 管理员登录令牌的命令行生成脚本；管理端登录页
- [x] model-config 领域：供应商增删改查、API Key 加密存储、测试连接与能力探测
- [x] LLM Gateway（OpenAI 兼容）：completeText / completeJson / embed、重试、超时、llm_calls 记录（流式输出随 M4 实现）
- [x] 管理端：模型配置页、邀请码与用户页
- [x] iOS：邀请码注册页，令牌存入 Keychain，接口请求带上令牌

### M2 菜谱库
- [x] recipe 领域表结构与迁移；食材库；派生过敏原与饮食标记（service/derive.ts）
- [x] HowToCook 种子导入脚本：规则解析（373 个文件全部可解析）+ 模型结构化 + 校验 + 导入记录；结构化结果缓存在 seed_import_items，重试不重复调用模型
- [ ] 结构化模型选型：用 gpt-5.4-mini 试 3 道，与 gpt-6.1-sol 的结果对比（用户 2026-10-12 选择「换个便宜模型导入」）
- [ ] 全量导入（约 360 道；gpt-6.1-sol 实测每道约 60 秒、约 6k 输入 + 2k 输出 token）
- [x] ~~Embedding 生成与 HNSW 索引~~：中转站没有 Embedding 模型（2026-10-12 实测），改用 pg_trgm 名称检索 + 标签/食材重合度排序
- [ ] recipe runtime 路由：管理端菜谱列表 / 详情 / 新建 / 编辑 / 审核（改状态）、食材库列表与修改、导入记录；用户端 GET /recipes/{id}（可见性规则已在 service 实现）
- [ ] 管理端：菜谱列表、编辑、审核队列、食材库、导入记录（「菜谱管理」标签页目前是禁用状态）

### M3 口味档案与每日推荐
- [ ] profile 领域与接口；iOS 引导填写与档案编辑
- [ ] plan 领域：推荐流水线 ①–⑥、规则降级、SSE 进度
- [ ] 换一道、整餐重排、反馈
- [ ] iOS：今日推荐、菜谱详情（用量换算）、换菜、反馈
- [ ] 约束评测（1000 份档案）接入 CI

### M4 饮食问答
- [ ] chat 领域：工具调用循环、SSE 流式输出、历史压缩
- [ ] iOS：对话界面，档案修改提案的确认交互

### M5 采购清单 + 跳转（待用户确认是否纳入首版）
- [ ] 按调研文档第 4 节的「首版最小可用形态」实现

## 待决问题

| 编号 | 问题 | 影响 | 状态 |
|---|---|---|---|
| Q1 | 中转站的 Base URL、接口格式，是否支持结构化输出、工具调用、Embedding | M1 Gateway 的实现细节、M2 是否做 Embedding | Base URL 为 https://jojocode.com/v1（New API 网关，OpenAI 兼容）；其余待用户填 Key 后由「测试连接」探测（TD-6） |
| Q2 | M5 采购清单是否纳入首版 | 首版范围 | 待用户确认 |
| Q3 | 服务端部署在哪里（云服务器 / 家用机器 + 内网穿透），让身边的人能访问 | iOS 的 Release 服务端地址、HTTPS 证书 | 待用户确认，不阻塞 M1–M3 |
| Q4 | iOS 怎么分发给身边的人：TestFlight 需要付费开发者账号；免费账号只能真机安装且 7 天过期 | 给他人使用的时间点 | 待用户确认，不阻塞开发 |

## 决策日志

| 日期 | 决策 | 理由 |
|---|---|---|
| 2026-10-12 | 菜谱库为主、模型补充；模型生成的新菜审核后才进公共库 | 用户选择；保证用量与做法可控 |
| 2026-10-12 | 模型通过用户提供的中转站接入，暂定 `gpt-6.1-sol`；只实现 OpenAI 兼容接口 | 用户选择 |
| 2026-10-12 | 一天三餐、可勾选；每餐一套搭配 | 用户选择 |
| 2026-10-12 | 邀请码 + 设备令牌；令牌与邀请码只存哈希 | 用户选择；实现简单，不依赖第三方 |
| 2026-10-12 | 硬约束在 SQL 与代码中保证，模型只做挑选与搭配 | 过敏原等安全相关约束不能依赖模型 |
| 2026-10-12 | 种子菜谱来自 HowToCook（Unlicense） | 中文、社区维护、许可证允许商用与修改 |
| 2026-10-12 | LLM Gateway 用 fetch 自行实现 OpenAI 兼容子集，不引入 SDK | 规则 §8.3：行为可在仓库内推理；中转站兼容性差异可直接控制 |
| 2026-10-12 | 管理端与 iOS 共用设备令牌模型，管理端放在 HttpOnly Cookie | 一套鉴权逻辑；Cookie 防止脚本读取令牌 |
| 2026-10-12 | 模拟器构建使用 ad-hoc 签名，不再关闭签名 | Keychain 依赖签名，关闭签名时保存令牌失败（实测） |
| 2026-10-12 | 邀请码输入框使用一次性码类型并关闭自动更正，提交时再规整大小写 | 实测自动更正会把 st8v 改成 stove；输入中改写绑定值会吞字符 |
| 2026-10-12 | 中转站探测结果：对话、结构化输出、工具调用可用；没有 Embedding 模型 | llm:import-env 探测 + 直接调用 /embeddings 返回 model_not_found |
| 2026-10-12 | 不做 Embedding：名称检索用 pg_trgm，推荐排序用标签与食材重合度 | 设计文档预留的降级路径；pgvector 扩展保留，有 Embedding 后再启用 |
| 2026-10-12 | 种子文件（HowToCook commit 3dfa950，373 道）入库到 apps/server/seed/howtocook | 用户同意下载并入库；导入可复现 |
| 2026-10-12 | 厨具改为固定枚举（烤箱、空气炸锅、蒸锅、电饭煲、高压锅、微波炉、料理机） | 厨具是硬约束，需要与档案逐项比对，自由文本无法可靠匹配 |
| 2026-10-12 | Gateway 支持单次调用覆盖超时；种子结构化用 180 秒 | 实测整道菜谱结构化超过 30 秒默认超时 |
| 2026-10-12 | 分层检查允许 repo/schema.ts 之间互相引用 | 外键需要引用对方的表定义；其余跨领域 repo 依赖仍禁止 |

## 进度日志

| 日期 | 进展 | 阻塞 |
|---|---|---|
| 2026-10-12 | 完成首版产品规格、数据模型与 Agent 设计 | 等待用户评审；Q1–Q4 未决 |
| 2026-10-12 | M1 完成：账号、模型配置、LLM Gateway、管理端三个页面、iOS 注册与登录恢复；服务端 26 个测试、管理端 5 个、iOS 10 个；浏览器与模拟器中实测通过 | 中转站 Key 未配置，真实模型能力未探测（TD-6） |
| 2026-10-12 | M2 进行中：菜谱领域（表结构、派生标记、服务）、种子下载与导入流水线完成；试导入 3 道，成功 2 道（西红柿炒鸡蛋、紫菜蛋花汤），宫保鸡丁因中转站网络错误失败，重跑会自动重试 | 等待选定结构化模型后全量导入 |

## 交接：下一步（给接手的会话）

1. 先读 `AGENTS.md`，再读本计划与 `docs/design-docs/data-model.md`。本地环境：`pnpm dev:db`（Postgres 在 5433）；`.env` 已配好中转站与 MODEL_SECRETS_KEY，数据库里已启用供应商「中转站」（gpt-6.1-sol）。
2. **结构化模型对比**：在管理端或用 `llm:import-env` 改 LLM_CHAT_MODEL 新建一个 gpt-5.4-mini 供应商并启用，然后用 `pnpm --filter @mealmuse/server seed:import --force --only dishes/vegetable_dish/西红柿炒鸡蛋.md --only dishes/soup/紫菜蛋花汤.md --only dishes/meat_dish/宫保鸡丁/宫保鸡丁.md` 重新结构化，对比数据库中的食材、用量、过敏原与 gpt-6.1-sol 的结果（gpt-6.1-sol 的结果见上面进度日志）。把对比结论和用户的选择记入决策日志。
3. **全量导入**前向用户确认用量（选定模型后估算 token），然后后台运行 `pnpm --filter @mealmuse/server seed:import --concurrency 4`；失败条目重跑即可。
4. 完成 M2 剩余两项：recipe runtime 路由（先 `pnpm openapi` 更新契约），管理端「菜谱管理」页面；按 M1 的方式在浏览器中实测。
5. 每个里程碑结束：`pnpm verify` 全绿、更新本计划与 QUALITY_SCORE、按单一职责提交、在用户终端中推送（沙箱 shell 无 GitHub 凭据，推送用终端面板）。

## 关联

- 需求：`docs/requirements.md`
- 技术债：`docs/exec-plans/tech-debt-tracker.md`
