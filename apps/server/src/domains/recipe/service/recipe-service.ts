import type {
  Ingredient,
  IngredientUpdate,
  Recipe,
  RecipeInput,
  RecipeListQuery,
  RecipePage,
  RecipeStatusChange,
  RecipeSummary,
  SeedImportItem,
} from '@mealmuse/shared';
import type { DbExecutor } from '../../../providers/database.js';
import { AppError, type AuthUser } from '../../../providers/http.js';
import type { Providers } from '../../../providers/index.js';
import { SEED_DIR } from '../config/seed.js';
import * as repo from '../repo/recipe-repo.js';
import * as seedRepo from '../repo/seed-repo.js';
import { deriveRecipeTags } from './derive.js';
import { importSeed } from './seed/import-seed.js';

/** 新建食材时可以带上的属性（种子结构化会给出；管理端手填时用默认值，事后在食材库修正）。 */
export type IngredientAttributes = Pick<
  repo.NewIngredient,
  'category' | 'allergenTags' | 'dietTags' | 'isPantryStaple' | 'searchKeyword'
>;
export type RecipeDraft = RecipeInput & {
  ingredientAttributes?: Record<string, IngredientAttributes>;
};
export type RecipeMeta = Pick<repo.NewRecipe, 'status' | 'source'> &
  Partial<Pick<repo.NewRecipe, 'sourceRef' | 'generatedForUserId' | 'generatedModel'>>;

const DEFAULT_ATTRIBUTES: IngredientAttributes = {
  category: 'other',
  allergenTags: [],
  dietTags: [],
  isPantryStaple: false,
  searchKeyword: null,
};

export const toIngredient = (row: repo.IngredientRow): Ingredient => ({
  id: row.id,
  name: row.name,
  aliases: row.aliases,
  category: row.category,
  allergenTags: row.allergenTags,
  dietTags: row.dietTags,
  isPantryStaple: row.isPantryStaple,
  searchKeyword: row.searchKeyword,
});

export const toSummary = (row: repo.RecipeRow): RecipeSummary => ({
  id: row.id,
  name: row.name,
  cuisine: row.cuisine,
  mealTypes: row.mealTypes,
  course: row.course,
  difficulty: row.difficulty,
  prepMinutes: row.prepMinutes,
  cookMinutes: row.cookMinutes,
  spiceLevel: row.spiceLevel,
  status: row.status,
  source: row.source,
  allergenTags: row.allergenTags,
  dietFlags: row.dietFlags,
  updatedAt: row.updatedAt.toISOString(),
});

export function toRecipe(detail: repo.RecipeDetailRows): Recipe {
  const { recipe } = detail;
  return {
    ...toSummary(recipe),
    description: recipe.description,
    baseServings: recipe.baseServings,
    flavorTags: recipe.flavorTags,
    equipment: recipe.equipment,
    tips: recipe.tips,
    sourceRef: recipe.sourceRef,
    reviewNote: recipe.reviewNote,
    ingredients: detail.ingredients.map(({ link, ingredient }) => ({
      ingredient: toIngredient(ingredient),
      group: link.group,
      quantity: link.quantity,
      unit: link.unit,
      prepNote: link.prepNote,
      optional: link.optional,
    })),
    steps: detail.steps.map((step) => ({
      instruction: step.instruction,
      durationMinutes: step.durationMinutes,
      tip: step.tip,
    })),
  };
}

/** 把食材名称归一到食材库（标准名或别名），不存在的新建。 */
async function resolveIngredients(
  db: DbExecutor,
  draft: RecipeDraft,
): Promise<Map<string, repo.IngredientRow>> {
  const names = [...new Set(draft.ingredients.map((item) => item.name))];
  const found = await repo.findIngredientsByNames(db, names);
  const byName = new Map<string, repo.IngredientRow>();
  for (const row of found) {
    for (const key of [row.name, ...row.aliases]) if (names.includes(key)) byName.set(key, row);
  }
  for (const name of names) {
    if (byName.has(name)) continue;
    const attributes = draft.ingredientAttributes?.[name] ?? DEFAULT_ATTRIBUTES;
    byName.set(name, await repo.insertIngredient(db, { name, ...attributes }));
  }
  return byName;
}

/** 写入菜谱主体、食材、步骤与派生标记。recipeId 为 null 时新建。 */
export async function saveRecipe(
  db: DbExecutor,
  recipeId: string | null,
  draft: RecipeDraft,
  meta: RecipeMeta | null,
): Promise<string> {
  const resolved = await resolveIngredients(db, draft);
  const lines = draft.ingredients.map((item) => {
    const ingredient = resolved.get(item.name);
    if (!ingredient) throw new Error(`ingredient not resolved: ${item.name}`);
    return { item, ingredient };
  });
  const derived = deriveRecipeTags(
    lines.map(({ item, ingredient }) => ({ ...ingredient, optional: item.optional })),
  );
  const values = {
    name: draft.name,
    description: draft.description,
    cuisine: draft.cuisine,
    mealTypes: draft.mealTypes,
    course: draft.course,
    difficulty: draft.difficulty,
    prepMinutes: draft.prepMinutes,
    cookMinutes: draft.cookMinutes,
    baseServings: draft.baseServings,
    flavorTags: draft.flavorTags,
    spiceLevel: draft.spiceLevel,
    equipment: draft.equipment,
    tips: draft.tips,
    ...derived,
  };

  let id = recipeId;
  if (id === null) {
    if (!meta) throw new Error('meta is required when creating a recipe');
    id = (await repo.insertRecipe(db, { ...values, ...meta })).id;
  } else if (!(await repo.updateRecipe(db, id, { ...values, ...(meta ?? {}) }))) {
    throw new AppError(404, 'recipe_not_found', '菜谱不存在');
  }
  await repo.replaceRecipeParts(db, id, {
    ingredients: lines.map(({ item, ingredient }) => ({
      ingredientId: ingredient.id,
      group: item.group,
      quantity: item.quantity,
      unit: item.unit,
      prepNote: item.prepNote,
      optional: item.optional,
    })),
    steps: draft.steps,
  });
  return id;
}

export type RecipeService = ReturnType<typeof createRecipeService>;

const toSeedItem = (row: seedRepo.SeedItemRow): SeedImportItem => ({
  id: row.id,
  batch: row.batch,
  sourcePath: row.sourcePath,
  status: row.status,
  recipeId: row.recipeId,
  error: row.error,
  createdAt: row.createdAt.toISOString(),
});

export function createRecipeService(providers: Pick<Providers, 'database' | 'logger' | 'llm'>) {
  const { db } = providers.database;

  async function requireDetail(id: string): Promise<repo.RecipeDetailRows> {
    const detail = await repo.findRecipeDetail(db, id);
    if (!detail) throw new AppError(404, 'recipe_not_found', '菜谱不存在');
    return detail;
  }

  /** 重新派生某个食材影响到的所有菜谱的过敏原与饮食标记。 */
  async function rederiveRecipesUsing(tx: DbExecutor, ingredientId: string): Promise<number> {
    const ids = await repo.recipeIdsUsingIngredient(tx, ingredientId);
    for (const id of ids) {
      const detail = await repo.findRecipeDetail(tx, id);
      if (!detail) continue;
      const derived = deriveRecipeTags(
        detail.ingredients.map(({ link, ingredient }) => ({
          ...ingredient,
          optional: link.optional,
        })),
      );
      await repo.updateRecipe(tx, id, derived);
    }
    return ids.length;
  }

  return {
    async list(query: RecipeListQuery): Promise<RecipePage> {
      const { rows, total } = await repo.listRecipes(db, query);
      return { items: rows.map(toSummary), total, page: query.page, pageSize: query.pageSize };
    },

    getForAdmin: async (id: string): Promise<Recipe> => toRecipe(await requireDetail(id)),

    /** 普通用户只能看已发布的菜，以及为自己生成、尚未审核的菜。 */
    async getForUser(id: string, user: AuthUser): Promise<Recipe> {
      const detail = await requireDetail(id);
      const { status, generatedForUserId } = detail.recipe;
      const visible =
        user.role === 'admin' ||
        status === 'published' ||
        (status === 'pending_review' && generatedForUserId === user.id);
      if (!visible) throw new AppError(404, 'recipe_not_found', '菜谱不存在');
      return toRecipe(detail);
    },

    async create(input: RecipeInput): Promise<Recipe> {
      const id = await db.transaction((tx) =>
        saveRecipe(tx, null, input, { status: 'published', source: 'admin' }),
      );
      providers.logger.info({ recipeId: id }, 'recipe created by admin');
      return toRecipe(await requireDetail(id));
    },

    async update(id: string, input: RecipeInput): Promise<Recipe> {
      await db.transaction((tx) => saveRecipe(tx, id, input, null));
      providers.logger.info({ recipeId: id }, 'recipe updated by admin');
      return toRecipe(await requireDetail(id));
    },

    async changeStatus(
      id: string,
      change: RecipeStatusChange,
      reviewerId: string,
    ): Promise<Recipe> {
      const row = await repo.updateRecipe(db, id, {
        status: change.status,
        reviewNote: change.note,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      });
      if (!row) throw new AppError(404, 'recipe_not_found', '菜谱不存在');
      providers.logger.info({ recipeId: id, status: change.status }, 'recipe status changed');
      return toRecipe(await requireDetail(id));
    },

    listIngredients: async (q?: string): Promise<Ingredient[]> =>
      (await repo.listIngredients(db, q)).map(toIngredient),

    async updateIngredient(id: string, patch: IngredientUpdate): Promise<Ingredient> {
      const { row, affected } = await db.transaction(async (tx) => {
        const values = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
        const updated = await repo.updateIngredient(tx, id, values);
        if (!updated) throw new AppError(404, 'ingredient_not_found', '食材不存在');
        return { row: updated, affected: await rederiveRecipesUsing(tx, id) };
      });
      providers.logger.info({ ingredientId: id, affectedRecipes: affected }, 'ingredient updated');
      return toIngredient(row);
    },

    listSeedItems: async (status?: SeedImportItem['status']): Promise<SeedImportItem[]> =>
      (await seedRepo.listSeedItems(db, status)).map(toSeedItem),

    /** 重新导入单条失败或跳过的记录；已导入的不重做，以免覆盖管理端的修改。 */
    async retrySeedItem(id: string): Promise<SeedImportItem> {
      const item = await seedRepo.findSeedItemById(db, id);
      if (!item) throw new AppError(404, 'seed_item_not_found', '导入记录不存在');
      if (item.status === 'imported') {
        throw new AppError(400, 'seed_item_imported', '这条已导入成功，请直接编辑对应菜谱');
      }
      await importSeed(providers, { seedDir: SEED_DIR, only: [item.sourcePath], concurrency: 1 });
      const updated = await seedRepo.findSeedItem(db, item.sourcePath);
      if (!updated) throw new Error(`seed item vanished: ${item.sourcePath}`);
      return toSeedItem(updated);
    },
  };
}
