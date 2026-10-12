import type { Allergen, DietFlag, DietTag, IngredientCategory } from '@mealmuse/shared';

export type DerivationInput = {
  category: IngredientCategory;
  allergenTags: Allergen[];
  dietTags: DietTag[];
  optional: boolean;
};

const ANIMAL_FLESH: ReadonlySet<IngredientCategory> = new Set(['meat', 'seafood']);

/**
 * 由食材派生菜谱的过敏原与饮食标记（推荐硬约束的依据）。
 * 可选食材也计入过敏原：宁可少推荐，也不冒险。
 */
export function deriveRecipeTags(items: DerivationInput[]): {
  allergenTags: Allergen[];
  dietFlags: DietFlag[];
} {
  const allergens = new Set<Allergen>();
  const dietTags = new Set<DietTag>();
  let hasFlesh = false;
  for (const item of items) {
    item.allergenTags.forEach((tag) => allergens.add(tag));
    item.dietTags.forEach((tag) => dietTags.add(tag));
    if (ANIMAL_FLESH.has(item.category)) hasFlesh = true;
  }

  const dietFlags: DietFlag[] = [];
  const vegetarian = !hasFlesh;
  if (vegetarian) dietFlags.push('vegetarian');
  if (vegetarian && !allergens.has('egg') && !allergens.has('milk')) dietFlags.push('vegan');
  if (!dietTags.has('pork')) dietFlags.push('no_pork');
  if (!dietTags.has('beef')) dietFlags.push('no_beef');
  if (!dietTags.has('alcohol')) dietFlags.push('no_alcohol');

  return { allergenTags: [...allergens].sort(), dietFlags };
}
