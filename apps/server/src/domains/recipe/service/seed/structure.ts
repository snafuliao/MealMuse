import {
  AllergenSchema,
  CourseSchema,
  DietTagSchema,
  EquipmentSchema,
  IngredientCategorySchema,
  IngredientGroupSchema,
  MealTypeSchema,
} from '@mealmuse/shared';
import { z } from 'zod';
import type { LlmGateway } from '../../../../providers/llm/gateway.js';
import { seedStructureSystemPrompt, seedStructureUserPrompt } from '../../config/prompts.js';
import type { RecipeDraft } from '../recipe-service.js';
import type { SeedDraft } from './parse-howtocook.js';

/** 模型输出的契约。所有字段都必填（可为 null），便于结构化输出的严格模式。 */
export const StructuredSeedSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(200),
  cuisine: z.string().max(20).nullable(),
  mealTypes: z.array(MealTypeSchema).min(1),
  course: CourseSchema,
  difficulty: z.int().min(1).max(5),
  prepMinutes: z.int().min(0).max(1440),
  cookMinutes: z.int().min(0).max(1440),
  baseServings: z.int().min(1).max(20),
  flavorTags: z.array(z.string().max(10)).max(10),
  spiceLevel: z.int().min(0).max(3),
  equipment: z.array(EquipmentSchema),
  tips: z.string().max(1000).nullable(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(30),
        group: IngredientGroupSchema,
        quantity: z.number().nonnegative().nullable(),
        unit: z.string().min(1).max(10),
        prepNote: z.string().max(50).nullable(),
        optional: z.boolean(),
        category: IngredientCategorySchema,
        allergenTags: z.array(AllergenSchema),
        dietTags: z.array(DietTagSchema),
        isPantryStaple: z.boolean(),
        searchKeyword: z.string().max(20).nullable(),
      }),
    )
    .min(1),
  steps: z
    .array(
      z.object({
        instruction: z.string().min(1),
        durationMinutes: z.int().positive().nullable(),
        tip: z.string().nullable(),
      }),
    )
    .min(1),
});
export type StructuredSeed = z.infer<typeof StructuredSeedSchema>;

/** 结构化结果转成 saveRecipe 需要的草稿；同名食材合并（属性以第一次出现为准）。 */
export function toRecipeDraft(structured: StructuredSeed): RecipeDraft {
  const ingredientAttributes: NonNullable<RecipeDraft['ingredientAttributes']> = {};
  for (const item of structured.ingredients) {
    ingredientAttributes[item.name] ??= {
      category: item.category,
      allergenTags: item.allergenTags,
      dietTags: item.dietTags,
      isPantryStaple: item.isPantryStaple,
      searchKeyword: item.searchKeyword,
    };
  }
  return {
    ...structured,
    equipment: [...new Set(structured.equipment)],
    ingredients: structured.ingredients.map((item) => ({
      name: item.name,
      group: item.group,
      quantity: item.quantity,
      unit: item.unit,
      prepNote: item.prepNote,
      optional: item.optional,
    })),
    ingredientAttributes,
  };
}

export async function structureSeed(
  llm: LlmGateway,
  draft: SeedDraft,
  knownIngredients: string[],
): Promise<StructuredSeed> {
  return llm.completeJson({
    purpose: 'structure_seed',
    messages: [
      { role: 'system', content: seedStructureSystemPrompt(knownIngredients) },
      { role: 'user', content: seedStructureUserPrompt(draft) },
    ],
    schema: { name: 'structured_recipe', zod: StructuredSeedSchema },
    // 整道菜谱的结构化输出较长，实测 gpt-6.1-sol 经中转站超过 30 秒。
    timeoutMs: 180_000,
  });
}
