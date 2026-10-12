import { z } from 'zod';
import {
  AllergenSchema,
  CourseSchema,
  DietFlagSchema,
  DietTagSchema,
  EquipmentSchema,
  IngredientCategorySchema,
  IngredientGroupSchema,
  MealTypeSchema,
  RecipeSourceSchema,
  RecipeStatusSchema,
} from './enums.js';

export const IngredientSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    aliases: z.array(z.string()),
    category: IngredientCategorySchema,
    allergenTags: z.array(AllergenSchema),
    dietTags: z.array(DietTagSchema),
    isPantryStaple: z.boolean(),
    searchKeyword: z.string().nullable(),
  })
  .meta({ id: 'Ingredient' });
export type Ingredient = z.infer<typeof IngredientSchema>;

export const IngredientUpdateSchema = IngredientSchema.omit({ id: true })
  .partial()
  .meta({ id: 'IngredientUpdate' });
export type IngredientUpdate = z.infer<typeof IngredientUpdateSchema>;

/** quantity 为 null 表示「适量」。 */
export const RecipeIngredientSchema = z
  .object({
    ingredient: IngredientSchema,
    group: IngredientGroupSchema,
    quantity: z.number().nonnegative().nullable(),
    unit: z.string(),
    prepNote: z.string().nullable(),
    optional: z.boolean(),
  })
  .meta({ id: 'RecipeIngredient' });
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

export const RecipeStepSchema = z
  .object({
    instruction: z.string().min(1),
    durationMinutes: z.number().int().positive().nullable(),
    tip: z.string().nullable(),
  })
  .meta({ id: 'RecipeStep' });
export type RecipeStep = z.infer<typeof RecipeStepSchema>;

const RecipeFieldsSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().max(500),
  cuisine: z.string().max(20).nullable(),
  mealTypes: z.array(MealTypeSchema).min(1),
  course: CourseSchema,
  difficulty: z.int().min(1).max(5),
  prepMinutes: z
    .int()
    .min(0)
    .max(24 * 60),
  cookMinutes: z
    .int()
    .min(0)
    .max(24 * 60),
  baseServings: z.int().min(1).max(20),
  flavorTags: z.array(z.string().max(10)).max(10),
  spiceLevel: z.int().min(0).max(3),
  equipment: z.array(EquipmentSchema).max(7),
  tips: z.string().max(1000).nullable(),
});

export const RecipeSummarySchema = RecipeFieldsSchema.pick({
  name: true,
  cuisine: true,
  mealTypes: true,
  course: true,
  difficulty: true,
  prepMinutes: true,
  cookMinutes: true,
  spiceLevel: true,
})
  .extend({
    id: z.uuid(),
    status: RecipeStatusSchema,
    source: RecipeSourceSchema,
    allergenTags: z.array(AllergenSchema),
    dietFlags: z.array(DietFlagSchema),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'RecipeSummary' });
export type RecipeSummary = z.infer<typeof RecipeSummarySchema>;

export const RecipeSchema = RecipeFieldsSchema.extend({
  id: z.uuid(),
  status: RecipeStatusSchema,
  source: RecipeSourceSchema,
  sourceRef: z.string().nullable(),
  allergenTags: z.array(AllergenSchema),
  dietFlags: z.array(DietFlagSchema),
  ingredients: z.array(RecipeIngredientSchema),
  steps: z.array(RecipeStepSchema),
  reviewNote: z.string().nullable(),
  updatedAt: z.iso.datetime(),
}).meta({ id: 'Recipe' });
export type Recipe = z.infer<typeof RecipeSchema>;

/** 管理端新建 / 编辑菜谱：食材按名称引用，服务端归一到食材库（不存在则新建）。 */
export const RecipeInputSchema = RecipeFieldsSchema.extend({
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(30),
        group: IngredientGroupSchema,
        quantity: z.number().nonnegative().nullable(),
        unit: z.string().trim().min(1).max(10),
        prepNote: z.string().max(50).nullable(),
        optional: z.boolean(),
      }),
    )
    .min(1),
  steps: z.array(RecipeStepSchema).min(1),
}).meta({ id: 'RecipeInput' });
export type RecipeInput = z.infer<typeof RecipeInputSchema>;

export const RecipeStatusChangeSchema = z
  .object({
    status: z.enum(['published', 'rejected', 'archived']),
    note: z.string().max(500).nullable().default(null),
  })
  .meta({ id: 'RecipeStatusChange' });
export type RecipeStatusChange = z.infer<typeof RecipeStatusChangeSchema>;

export const RecipeListQuerySchema = z.object({
  q: z.string().trim().max(30).optional(),
  status: RecipeStatusSchema.optional(),
  source: RecipeSourceSchema.optional(),
  course: CourseSchema.optional(),
  mealType: MealTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type RecipeListQuery = z.infer<typeof RecipeListQuerySchema>;

export const RecipePageSchema = z
  .object({
    items: z.array(RecipeSummarySchema),
    total: z.int(),
    page: z.int(),
    pageSize: z.int(),
  })
  .meta({ id: 'RecipePage' });
export type RecipePage = z.infer<typeof RecipePageSchema>;

export const SeedImportItemSchema = z
  .object({
    id: z.uuid(),
    batch: z.string(),
    sourcePath: z.string(),
    status: z.enum(['imported', 'failed', 'skipped']),
    recipeId: z.uuid().nullable(),
    error: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'SeedImportItem' });
export type SeedImportItem = z.infer<typeof SeedImportItemSchema>;
