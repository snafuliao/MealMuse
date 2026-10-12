import type { RecipeInput } from '@mealmuse/shared';

/** 测试用的菜谱草稿。 */
export const tomatoEgg: RecipeInput = {
  name: '番茄炒蛋',
  description: '家常菜',
  cuisine: '家常',
  mealTypes: ['lunch', 'dinner'],
  course: 'veg',
  difficulty: 2,
  prepMinutes: 5,
  cookMinutes: 10,
  baseServings: 2,
  flavorTags: ['酸甜'],
  spiceLevel: 0,
  equipment: [],
  tips: null,
  ingredients: [
    { name: '西红柿', group: 'main', quantity: 360, unit: 'g', prepNote: '切块', optional: false },
    { name: '鸡蛋', group: 'main', quantity: 3, unit: '个', prepNote: null, optional: false },
    {
      name: '盐',
      group: 'seasoning',
      quantity: null,
      unit: '适量',
      prepNote: null,
      optional: false,
    },
  ],
  steps: [{ instruction: '炒蛋', durationMinutes: 3, tip: null }],
};
