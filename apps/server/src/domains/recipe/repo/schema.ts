import {
  CourseSchema,
  IngredientCategorySchema,
  IngredientGroupSchema,
  MealTypeSchema,
  RecipeSourceSchema,
  RecipeStatusSchema,
  type Allergen,
  type Course,
  type DietFlag,
  type DietTag,
  type Equipment,
  type IngredientCategory,
  type IngredientGroup,
  type MealType,
  type RecipeSource,
  type RecipeStatus,
} from '@mealmuse/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '../../identity/repo/schema.js';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const tuple = <T extends string>(values: readonly T[]) => [...values] as [T, ...T[]];

export const mealTypeEnum = pgEnum('meal_type', tuple<MealType>(MealTypeSchema.options));
export const courseEnum = pgEnum('course', tuple<Course>(CourseSchema.options));
export const recipeStatusEnum = pgEnum(
  'recipe_status',
  tuple<RecipeStatus>(RecipeStatusSchema.options),
);
export const recipeSourceEnum = pgEnum(
  'recipe_source',
  tuple<RecipeSource>(RecipeSourceSchema.options),
);
export const ingredientCategoryEnum = pgEnum(
  'ingredient_category',
  tuple<IngredientCategory>(IngredientCategorySchema.options),
);
export const ingredientGroupEnum = pgEnum(
  'ingredient_group',
  tuple<IngredientGroup>(IngredientGroupSchema.options),
);
export const seedItemStatusEnum = pgEnum('seed_item_status', ['imported', 'failed', 'skipped']);

// 数组列用 text[] 存放枚举值，写入前已由 zod 校验；用 $type 让读取端得到精确类型。
const allergenArray = (name: string) =>
  text(name)
    .array()
    .$type<Allergen[]>()
    .notNull()
    .default(sql`'{}'`);

export const ingredients = pgTable(
  'ingredients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    aliases: text('aliases')
      .array()
      .notNull()
      .default(sql`'{}'`),
    category: ingredientCategoryEnum('category').notNull(),
    allergenTags: allergenArray('allergen_tags'),
    dietTags: text('diet_tags')
      .array()
      .$type<DietTag[]>()
      .notNull()
      .default(sql`'{}'`),
    isPantryStaple: boolean('is_pantry_staple').notNull().default(false),
    searchKeyword: text('search_keyword'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [index('ingredients_aliases_idx').using('gin', table.aliases)],
);

export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    cuisine: text('cuisine'),
    mealTypes: mealTypeEnum('meal_types').array().notNull(),
    course: courseEnum('course').notNull(),
    difficulty: integer('difficulty').notNull(),
    prepMinutes: integer('prep_minutes').notNull(),
    cookMinutes: integer('cook_minutes').notNull(),
    baseServings: integer('base_servings').notNull(),
    flavorTags: text('flavor_tags')
      .array()
      .notNull()
      .default(sql`'{}'`),
    spiceLevel: integer('spice_level').notNull().default(0),
    equipment: text('equipment')
      .array()
      .$type<Equipment[]>()
      .notNull()
      .default(sql`'{}'`),
    tips: text('tips'),
    /** 由食材派生，保存时由服务端计算，不手填。 */
    allergenTags: allergenArray('allergen_tags'),
    dietFlags: text('diet_flags')
      .array()
      .$type<DietFlag[]>()
      .notNull()
      .default(sql`'{}'`),
    status: recipeStatusEnum('status').notNull(),
    source: recipeSourceEnum('source').notNull(),
    sourceRef: text('source_ref'),
    generatedForUserId: uuid('generated_for_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    generatedModel: text('generated_model'),
    reviewNote: text('review_note'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamptz('reviewed_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('recipes_status_idx').on(table.status),
    index('recipes_allergen_tags_idx').using('gin', table.allergenTags),
    index('recipes_meal_types_idx').using('gin', table.mealTypes),
    index('recipes_name_trgm_idx').using('gin', sql`${table.name} gin_trgm_ops`),
  ],
);

export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'restrict' }),
    group: ingredientGroupEnum('group').notNull(),
    /** null 表示「适量」。 */
    quantity: numeric('quantity', { mode: 'number' }),
    unit: text('unit').notNull(),
    prepNote: text('prep_note'),
    optional: boolean('optional').notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.recipeId, table.position] }),
    index('recipe_ingredients_ingredient_idx').on(table.ingredientId),
  ],
);

export const recipeSteps = pgTable(
  'recipe_steps',
  {
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    instruction: text('instruction').notNull(),
    durationMinutes: integer('duration_minutes'),
    tip: text('tip'),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.position] })],
);

export const seedImportItems = pgTable('seed_import_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  batch: text('batch').notNull(),
  sourcePath: text('source_path').notNull().unique(),
  status: seedItemStatusEnum('status').notNull(),
  recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
  error: text('error'),
  /** 模型结构化结果与所用提示词版本：入库失败后重试时直接复用，不再调用模型。 */
  structured: jsonb('structured'),
  promptVersion: text('prompt_version'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});
