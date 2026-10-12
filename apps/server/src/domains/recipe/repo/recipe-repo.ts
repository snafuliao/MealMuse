import type { RecipeListQuery } from '@mealmuse/shared';
import {
  and,
  arrayContains,
  arrayOverlaps,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { DbExecutor } from '../../../providers/database.js';
import { ingredients, recipeIngredients, recipes, recipeSteps } from './schema.js';

export type RecipeRow = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type IngredientRow = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type RecipeIngredientRow = typeof recipeIngredients.$inferSelect;
export type StepRow = typeof recipeSteps.$inferSelect;

export type RecipeDetailRows = {
  recipe: RecipeRow;
  ingredients: Array<{ link: RecipeIngredientRow; ingredient: IngredientRow }>;
  steps: StepRow[];
};

/** 按标准名或别名查找食材（精确匹配）。 */
export async function findIngredientsByNames(
  db: DbExecutor,
  names: string[],
): Promise<IngredientRow[]> {
  if (names.length === 0) return [];
  return db
    .select()
    .from(ingredients)
    .where(or(inArray(ingredients.name, names), arrayOverlaps(ingredients.aliases, names)));
}

export async function insertIngredient(
  db: DbExecutor,
  values: NewIngredient,
): Promise<IngredientRow> {
  const [row] = await db
    .insert(ingredients)
    .values(values)
    .onConflictDoUpdate({ target: ingredients.name, set: { name: sql`excluded.name` } })
    .returning();
  if (!row) throw new Error('insert ingredients returned no row');
  return row;
}

export async function updateIngredient(
  db: DbExecutor,
  id: string,
  values: Partial<NewIngredient>,
): Promise<IngredientRow | null> {
  const [row] = await db.update(ingredients).set(values).where(eq(ingredients.id, id)).returning();
  return row ?? null;
}

export async function listIngredients(
  db: DbExecutor,
  q: string | undefined,
): Promise<IngredientRow[]> {
  return db
    .select()
    .from(ingredients)
    .where(
      q
        ? or(ilike(ingredients.name, `%${q}%`), arrayContains(ingredients.aliases, [q]))
        : undefined,
    )
    .orderBy(asc(ingredients.category), asc(ingredients.name))
    .limit(500);
}

/** 用到某个食材的菜谱，食材属性变化后需要重新派生它们的过敏原与饮食标记。 */
export async function recipeIdsUsingIngredient(
  db: DbExecutor,
  ingredientId: string,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: recipeIngredients.recipeId })
    .from(recipeIngredients)
    .where(eq(recipeIngredients.ingredientId, ingredientId));
  return rows.map((row) => row.id);
}

export async function insertRecipe(db: DbExecutor, values: NewRecipe): Promise<RecipeRow> {
  const [row] = await db.insert(recipes).values(values).returning();
  if (!row) throw new Error('insert recipes returned no row');
  return row;
}

export async function updateRecipe(
  db: DbExecutor,
  id: string,
  values: Partial<NewRecipe>,
): Promise<RecipeRow | null> {
  const [row] = await db
    .update(recipes)
    .set({ ...values, updatedAt: sql`now()` })
    .where(eq(recipes.id, id))
    .returning();
  return row ?? null;
}

export async function replaceRecipeParts(
  db: DbExecutor,
  recipeId: string,
  parts: {
    ingredients: Array<Omit<RecipeIngredientRow, 'recipeId' | 'position'>>;
    steps: Array<Omit<StepRow, 'recipeId' | 'position'>>;
  },
): Promise<void> {
  await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
  await db.delete(recipeSteps).where(eq(recipeSteps.recipeId, recipeId));
  if (parts.ingredients.length > 0) {
    await db
      .insert(recipeIngredients)
      .values(parts.ingredients.map((row, position) => ({ ...row, recipeId, position })));
  }
  if (parts.steps.length > 0) {
    await db
      .insert(recipeSteps)
      .values(parts.steps.map((row, position) => ({ ...row, recipeId, position })));
  }
}

export async function findRecipeDetail(
  db: DbExecutor,
  id: string,
): Promise<RecipeDetailRows | null> {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
  if (!recipe) return null;
  const ingredientRows = await db
    .select({ link: recipeIngredients, ingredient: ingredients })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
    .where(eq(recipeIngredients.recipeId, id))
    .orderBy(asc(recipeIngredients.position));
  const steps = await db
    .select()
    .from(recipeSteps)
    .where(eq(recipeSteps.recipeId, id))
    .orderBy(asc(recipeSteps.position));
  return { recipe, ingredients: ingredientRows, steps };
}

export async function listRecipes(
  db: DbExecutor,
  query: RecipeListQuery,
): Promise<{ rows: RecipeRow[]; total: number }> {
  const filters: SQL[] = [];
  if (query.status) filters.push(eq(recipes.status, query.status));
  if (query.source) filters.push(eq(recipes.source, query.source));
  if (query.course) filters.push(eq(recipes.course, query.course));
  if (query.mealType) filters.push(arrayContains(recipes.mealTypes, [query.mealType]));
  if (query.q) filters.push(ilike(recipes.name, `%${query.q}%`));
  const where = filters.length > 0 ? and(...filters) : undefined;

  // 有搜索词时按名称相似度排序，否则按最近更新。
  const order = query.q
    ? [desc(sql`similarity(${recipes.name}, ${query.q})`)]
    : [desc(recipes.updatedAt)];
  const rows = await db
    .select()
    .from(recipes)
    .where(where)
    .orderBy(...order, asc(recipes.name))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  const [totalRow] = await db.select({ total: count() }).from(recipes).where(where);
  return { rows, total: totalRow?.total ?? 0 };
}
