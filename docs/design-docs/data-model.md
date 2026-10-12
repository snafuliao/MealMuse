# 设计：数据模型（PostgreSQL + pgvector）

- **状态**：草稿，待评审
- **日期**：2026-10-12
- **关联**：`docs/product-specs/daily-recommendation.md`、`docs/product-specs/admin.md`、`docs/design-docs/recommendation-agent.md`

## 1. 领域划分

表定义放在各领域的 repo/schema.ts 中（目录约定见 `ARCHITECTURE.md`）。

| 领域 | 职责 | 表 |
|---|---|---|
| identity | 用户、邀请码、设备令牌 | users、invite_codes、device_tokens |
| profile | 口味档案 | taste_profiles |
| recipe | 菜谱库与食材库 | ingredients、recipes、recipe_ingredients、recipe_steps、recipe_embeddings、seed_import_items |
| plan | 每日推荐与反馈 | daily_plans、plan_meals、plan_dishes、dish_feedback |
| chat | 饮食问答 | chat_threads、chat_messages |
| model-config | 模型供应商配置与调用记录 | llm_providers、llm_calls |

各表主键统一用 `uuid`（`gen_random_uuid()`），时间统一用 `timestamptz`。枚举用 Postgres enum，并在 `packages/shared` 中定义同名的 zod enum。

## 2. 表结构

### identity

- **users**：id、display_name、role（member / admin）、invited_by → users、created_at、last_active_at。
- **invite_codes**：id、code_hash（SHA-256，明文只在生成时显示一次）、created_by → users、role（新用户获得的角色）、max_uses、used_count、expires_at、revoked_at、created_at。
- **device_tokens**：id、user_id、token_hash（SHA-256）、kind（ios / admin_web）、device_name、last_seen_at、revoked_at、created_at。

### profile

- **taste_profiles**（每个用户一行）：
  - 用餐：enabled_meals（meal_type[]）、servings（int）
  - 硬约束：allergens（text[]，取值来自固定过敏原表加自填项）、excluded_ingredient_ids（uuid[]）、diet（none / vegetarian / ovo_lacto / no_pork …）、equipment（text[]）、max_minutes_weekday、max_minutes_weekend
  - 软偏好：spice_level（0–3）、liked_cuisines（text[]）、flavor_tags（text[]）、skill_level（1–3）、goals（text，自由文本）
  - 派生：preference_embedding（vector，由软偏好文本生成，档案变更时重算）、updated_at

### recipe

- **ingredients**：id、name（标准名，唯一）、aliases（text[]）、category（蔬菜 / 肉禽 / 水产 / 蛋奶 / 豆制品 / 主食 / 干货 / 调味 / 其他）、allergen_tags（text[]）、is_pantry_staple（bool）、search_keyword（采购搜索词）、status（active / pending_review）。
- **recipes**：
  - 基本：id、slug（唯一）、name、description、cuisine、meal_types（meal_type[]）、course（meat / veg / soup / staple / snack / drink）、difficulty（1–5）、prep_minutes、cook_minutes、base_servings、flavor_tags（text[]）、spice_level（0–3）、equipment（text[]）、tips
  - 派生：diet_flags（text[]，由食材推导，如 vegetarian），allergen_tags（text[]，由食材汇总）。这两列由服务端在保存时计算，不手填，用于硬约束过滤
  - 治理：status（draft / pending_review / published / rejected / archived）、source（seed / llm / admin）、source_ref（种子菜谱的原文件路径或链接）、generated_for_user_id（模型生成时触发的用户）、generated_model、review_note、reviewed_by、reviewed_at、created_at、updated_at
- **recipe_ingredients**：recipe_id、ingredient_id、group（main / side / seasoning）、quantity（numeric，可空，表示「适量」）、unit（g / ml / 个 / 勺 / 适量 …）、prep_note（如「切丝」）、optional（bool）、position。
- **recipe_steps**：recipe_id、position、instruction、duration_minutes（可空）、tip（可空）。
- **recipe_embeddings**：recipe_id、model、embedding（vector(N)）、content_hash（用于判断菜谱改动后是否要重算）、created_at。主键为 (recipe_id, model)。维度 N 在确定 Embedding 模型后固定，并建 HNSW 索引；换模型时用新列或新表迁移。
- **seed_import_items**：id、batch、source_path、status（imported / failed / skipped）、recipe_id、error、created_at。

### plan

- **daily_plans**：id、user_id、plan_date、status（generating / ready / failed）、strategy（llm / fallback_rules）、model、prompt_version、created_at。唯一约束 (user_id, plan_date)。
- **plan_meals**：id、plan_id、meal_type、servings、summary（这一餐的搭配说明）。
- **plan_dishes**：id、meal_id、recipe_id、role（meat / veg / soup / staple / snack / drink）、reason、position、status（active / replaced）、replaced_by_dish_id、swap_request（换菜时附带的要求）、created_at。
- **dish_feedback**：id、user_id、recipe_id、plan_dish_id（可空：在问答里反馈时可能没有对应推荐）、cooked（bool）、rating（-1 / 0 / 1）、comment、created_at。

### chat

- **chat_threads**：id、user_id、title、created_at、updated_at。
- **chat_messages**：id、thread_id、role（user / assistant / tool）、content、tool_calls（jsonb，按 zod schema 写入）、created_at。

### model-config

- **llm_providers**：id、name、base_url、api_key_ciphertext（AES-256-GCM，密钥来自环境变量 `MODEL_SECRETS_KEY`）、api_key_last4、chat_model、embedding_model（可空）、timeout_ms、capabilities（jsonb：测试连接得到的结构化输出、工具调用、Embedding 支持情况）、is_active（部分唯一索引保证最多一个启用）、created_at、updated_at。
- **llm_calls**：id、provider_id、purpose（recommend / swap / generate_recipe / chat / embedding / structure_seed）、model、status（ok / error / timeout / invalid_output）、latency_ms、input_tokens、output_tokens、error_code、user_id（可空）、created_at。**不存提示词和回复正文**，保护隐私。

## 3. 关键约束与索引

- 硬约束过滤直接在 SQL 中完成：`recipes.allergen_tags && profile.allergens` 为假；`recipes.equipment <@ profile.equipment`；排除含 excluded_ingredient_ids 的菜谱（经 recipe_ingredients 判断）；`prep_minutes + cook_minutes` 不超过时间上限。为数组列建 GIN 索引。
- 近期去重：查询 plan_dishes 与 dish_feedback 的近 N 天记录，在 (user_id, plan_date) 与 (user_id, created_at) 上建索引。
- 可见性：status = published 的菜谱对所有人可见；pending_review 的菜谱只对 generated_for_user_id 对应的用户可见。

## 4. 用量换算

用量按 base_servings 存储，读取时按这一餐的人数线性换算，再按单位取整（g 取整到 5，个 / 勺取整到 0.5）。「适量」不换算。换算逻辑放在 `packages/shared` 中，iOS 端和服务端结果一致。

## 5. 种子数据

- 来源：开源中文菜谱仓库 Anduin2017/HowToCook，许可证 Unlicense（公有领域，2026-10-12 经 GitHub API 查证）。
- 一次性导入脚本：解析每道菜的 Markdown，分出原料、用量、操作三部分；用模型结构化成上面的 schema，并做 zod 校验；食材名按别名表归一，未识别的食材以 pending_review 状态新建。
- 校验通过的菜谱以 published、source = seed 入库，并记录 source_ref；不通过的写入 seed_import_items，在管理端处理。导入后人工抽查 20 道。

## 6. 待确认

- Embedding 模型与维度：取决于中转站是否提供 Embedding 接口。没有的话，排序退回到「标签 + 食材重合度」打分，profile 与 recipe 的 embedding 列先留空（见 `docs/design-docs/recommendation-agent.md`）。
