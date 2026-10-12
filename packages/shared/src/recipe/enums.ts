import { z } from 'zod';

export const MealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner']).meta({ id: 'MealType' });
export type MealType = z.infer<typeof MealTypeSchema>;

/** 一道菜在一餐中的角色。 */
export const CourseSchema = z
  .enum(['meat', 'veg', 'soup', 'staple', 'snack', 'dessert', 'drink'])
  .meta({ id: 'Course' });
export type Course = z.infer<typeof CourseSchema>;

export const RecipeStatusSchema = z
  .enum(['draft', 'pending_review', 'published', 'rejected', 'archived'])
  .meta({ id: 'RecipeStatus' });
export type RecipeStatus = z.infer<typeof RecipeStatusSchema>;

export const RecipeSourceSchema = z.enum(['seed', 'llm', 'admin']).meta({ id: 'RecipeSource' });
export type RecipeSource = z.infer<typeof RecipeSourceSchema>;

export const IngredientCategorySchema = z
  .enum([
    'vegetable',
    'fruit',
    'meat',
    'seafood',
    'egg_dairy',
    'soy',
    'staple',
    'dry_goods',
    'seasoning',
    'other',
  ])
  .meta({ id: 'IngredientCategory' });
export type IngredientCategory = z.infer<typeof IngredientCategorySchema>;

export const IngredientGroupSchema = z
  .enum(['main', 'side', 'seasoning'])
  .meta({ id: 'IngredientGroup' });
export type IngredientGroup = z.infer<typeof IngredientGroupSchema>;

/**
 * 固定的过敏原表。推荐时作为硬约束在 SQL 中过滤，所以只能用这里的取值。
 * 依据：常见的 9 类食物过敏原。
 */
export const AllergenSchema = z
  .enum(['peanut', 'tree_nut', 'shellfish', 'fish', 'egg', 'milk', 'wheat', 'soy', 'sesame'])
  .meta({ id: 'Allergen' });
export type Allergen = z.infer<typeof AllergenSchema>;

/**
 * 需要专门购置的厨具（炉灶、炒锅、汤锅、刀具默认人人都有，不列入）。
 * 推荐时作为硬约束：菜谱要求的厨具必须是用户档案里有的。
 */
export const EquipmentSchema = z
  .enum(['oven', 'air_fryer', 'steamer', 'rice_cooker', 'pressure_cooker', 'microwave', 'blender'])
  .meta({ id: 'Equipment' });
export type Equipment = z.infer<typeof EquipmentSchema>;

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  oven: '烤箱',
  air_fryer: '空气炸锅',
  steamer: '蒸锅',
  rice_cooker: '电饭煲',
  pressure_cooker: '高压锅',
  microwave: '微波炉',
  blender: '料理机',
};

/** 影响饮食方式判断的食材标记（过敏原之外）。 */
export const DietTagSchema = z.enum(['pork', 'beef', 'alcohol']).meta({ id: 'DietTag' });
export type DietTag = z.infer<typeof DietTagSchema>;

/** 菜谱由食材推导出的饮食标记，用于饮食方式硬约束。 */
export const DietFlagSchema = z
  .enum(['vegetarian', 'vegan', 'no_pork', 'no_beef', 'no_alcohol'])
  .meta({ id: 'DietFlag' });
export type DietFlag = z.infer<typeof DietFlagSchema>;

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  peanut: '花生',
  tree_nut: '坚果',
  shellfish: '虾蟹贝类',
  fish: '鱼',
  egg: '蛋',
  milk: '奶',
  wheat: '小麦（麸质）',
  soy: '大豆',
  sesame: '芝麻',
};

export const COURSE_LABELS: Record<Course, string> = {
  meat: '荤菜',
  veg: '素菜',
  soup: '汤',
  staple: '主食',
  snack: '小吃',
  dessert: '甜点',
  drink: '饮品',
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};
