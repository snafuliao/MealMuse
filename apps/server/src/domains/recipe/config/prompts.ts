import { ALLERGEN_LABELS, EQUIPMENT_LABELS } from '@mealmuse/shared';

/** 种子菜谱结构化提示词。修改内容时递增版本号，导入记录会带上它。 */
export const SEED_STRUCTURE_PROMPT_VERSION = 'seed-structure-v1';

const allergenList = Object.entries(ALLERGEN_LABELS)
  .map(([key, label]) => `${key}（${label}）`)
  .join('、');
const equipmentList = Object.entries(EQUIPMENT_LABELS)
  .map(([key, label]) => `${key}（${label}）`)
  .join('、');

export function seedStructureSystemPrompt(knownIngredients: string[]): string {
  return [
    '你是严谨的中文菜谱编辑。把用户给出的菜谱原文整理成结构化 JSON，只输出 JSON。',
    '',
    '规则：',
    '1. 忠于原文，不编造原文没有的食材或步骤；原文没写用量的食材 quantity 为 null、unit 为「适量」。',
    '2. 用量：如果原文按「份数」计算，取 baseServings = 2，并把用量换算成 2 人份；否则按原文的份量填写 baseServings。数量用阿拉伯数字，单位优先使用 g、ml、个、根、片、瓣、勺、杯、适量。',
    '3. 食材名用常见的标准中文名，不带用量和处理方式（「去皮五花肉」→ 名称「五花肉」，处理方式放 prepNote）。下列已有食材名请优先复用：',
    knownIngredients.length > 0 ? knownIngredients.join('、') : '（暂无）',
    '4. group：主料 main、辅料 side、调料 seasoning。可选食材 optional 为 true。',
    `5. allergenTags 只能取：${allergenList}。宁可多标不可漏标（如酱油含 soy 与 wheat，豆腐含 soy，面粉含 wheat，虾含 shellfish）。`,
    '6. dietTags 只能取 pork（猪肉及其制品，含猪油）、beef（牛肉）、alcohol（料酒、啤酒等含酒精调料）。',
    '7. category 取 vegetable、fruit、meat、seafood、egg_dairy、soy、staple、dry_goods、seasoning、other 之一；盐、糖、油、酱油、醋等基础调料 isPantryStaple 为 true。',
    '8. searchKeyword：在生鲜平台搜索该食材时用的词，基础调料可以为 null。',
    `9. equipment 只列需要专门购置的厨具，只能取：${equipmentList}；普通炒锅、汤锅不用列。`,
    '10. 步骤：每步一句完整的操作说明，原文中的反引号与「即为 xxx」标记改写成自然语言；能判断时长的填 durationMinutes。',
    '11. mealTypes 从 breakfast、lunch、dinner 中选适合的餐次；course 从 meat、veg、soup、staple、snack、dessert、drink 中选一个。',
    '12. description 不超过 80 个字；tips 汇总原文的注意事项与附加内容，没有则为 null。',
  ].join('\n');
}

export function seedStructureUserPrompt(draft: {
  name: string;
  category: string;
  difficulty: number | null;
  description: string;
  ingredientsAndTools: string[];
  calculation: string;
  steps: string;
  extra: string;
}): string {
  return [
    `菜名：${draft.name}`,
    `原文分类：${draft.category}`,
    `原文难度（1–5 星）：${draft.difficulty ?? '未标注'}`,
    `简介：${draft.description}`,
    `必备原料和工具：\n${draft.ingredientsAndTools.map((line) => `- ${line}`).join('\n')}`,
    `计算：\n${draft.calculation}`,
    `操作：\n${draft.steps}`,
    draft.extra ? `附加内容：\n${draft.extra}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
