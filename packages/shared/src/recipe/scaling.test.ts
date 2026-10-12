import { describe, expect, it } from 'vitest';
import { scaleQuantity } from './scaling.js';

describe('scaleQuantity', () => {
  it('scales grams and rounds to 5', () => {
    expect(scaleQuantity(180, 'g', 1, 3)).toBe(540);
    expect(scaleQuantity(130, 'g', 2, 3)).toBe(195);
  });

  it('rounds countable units to halves', () => {
    expect(scaleQuantity(1.5, '个', 1, 3)).toBe(4.5);
    expect(scaleQuantity(1, '个', 3, 2)).toBe(0.5);
  });

  it('keeps small seasoning amounts instead of rounding them away', () => {
    expect(scaleQuantity(2, 'g', 1, 1)).toBe(2);
    expect(scaleQuantity(1, 'g', 2, 1)).toBe(0.5);
  });

  it('leaves 适量 untouched', () => {
    expect(scaleQuantity(null, '适量', 1, 4)).toBeNull();
  });
});
