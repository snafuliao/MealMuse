import type {
  DietFlag,
  DietTag,
  IngredientCategory,
  IngredientGroup,
  RecipeSource,
  RecipeStatus,
  SeedImportItem,
} from '@mealmuse/shared';

export {
  ALLERGEN_LABELS,
  COURSE_LABELS,
  EQUIPMENT_LABELS,
  MEAL_TYPE_LABELS,
} from '@mealmuse/shared';

export const STATUS_LABELS: Record<RecipeStatus, string> = {
  draft: '草稿',
  pending_review: '待审核',
  published: '已发布',
  rejected: '已驳回',
  archived: '已下架',
};

export const SOURCE_LABELS: Record<RecipeSource, string> = {
  seed: '种子导入',
  llm: '模型生成',
  admin: '手工录入',
};

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  vegetable: '蔬菜',
  fruit: '水果',
  meat: '肉类',
  seafood: '水产',
  egg_dairy: '蛋奶',
  soy: '豆制品',
  staple: '主食',
  dry_goods: '干货',
  seasoning: '调料',
  other: '其他',
};

export const GROUP_LABELS: Record<IngredientGroup, string> = {
  main: '主料',
  side: '辅料',
  seasoning: '调料',
};

export const DIET_TAG_LABELS: Record<DietTag, string> = {
  pork: '猪肉',
  beef: '牛肉',
  alcohol: '酒精',
};

export const DIET_FLAG_LABELS: Record<DietFlag, string> = {
  vegetarian: '蛋奶素',
  vegan: '纯素',
  no_pork: '不含猪肉',
  no_beef: '不含牛肉',
  no_alcohol: '不含酒精',
};

export const SEED_STATUS_LABELS: Record<SeedImportItem['status'], string> = {
  imported: '已导入',
  failed: '失败',
  skipped: '跳过',
};

/** Record 转成 [值, 中文] 列表，用于下拉框与复选框。 */
export const options = <K extends string>(labels: Record<K, string>) =>
  Object.entries(labels) as Array<[K, string]>;

export const formatTime = (iso: string) => new Date(iso).toLocaleString('zh-CN');
