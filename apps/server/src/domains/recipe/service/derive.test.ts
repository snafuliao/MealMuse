import { describe, expect, it } from 'vitest';
import { deriveRecipeTags, type DerivationInput } from './derive.js';

const item = (overrides: Partial<DerivationInput>): DerivationInput => ({
  category: 'vegetable',
  allergenTags: [],
  dietTags: [],
  optional: false,
  ...overrides,
});

describe('deriveRecipeTags', () => {
  it('marks a tomato-egg dish vegetarian but not vegan', () => {
    const tags = deriveRecipeTags([
      item({}),
      item({ category: 'egg_dairy', allergenTags: ['egg'] }),
    ]);
    expect(tags.allergenTags).toEqual(['egg']);
    expect(tags.dietFlags).toEqual(['vegetarian', 'no_pork', 'no_beef', 'no_alcohol']);
  });

  it('removes vegetarian and no_pork for braised pork', () => {
    const tags = deriveRecipeTags([item({ category: 'meat', dietTags: ['pork'] })]);
    expect(tags.dietFlags).toEqual(['no_beef', 'no_alcohol']);
  });

  it('counts optional ingredients as allergens to stay on the safe side', () => {
    const tags = deriveRecipeTags([
      item({ category: 'dry_goods', allergenTags: ['peanut'], optional: true }),
    ]);
    expect(tags.allergenTags).toEqual(['peanut']);
  });

  it('treats seafood as non-vegetarian and keeps allergens sorted and unique', () => {
    const tags = deriveRecipeTags([
      item({ category: 'seafood', allergenTags: ['shellfish'] }),
      item({ category: 'seasoning', allergenTags: ['soy', 'wheat'] }),
      item({ category: 'seasoning', allergenTags: ['soy'], dietTags: ['alcohol'] }),
    ]);
    expect(tags.allergenTags).toEqual(['shellfish', 'soy', 'wheat']);
    expect(tags.dietFlags).toEqual(['no_pork', 'no_beef']);
  });
});
