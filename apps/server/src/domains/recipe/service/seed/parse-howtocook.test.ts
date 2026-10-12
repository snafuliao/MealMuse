import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHowToCook, SeedParseError, SKIPPED_CATEGORIES } from './parse-howtocook.js';

const SEED_DIR = new URL('../../../../../seed/howtocook', import.meta.url).pathname;

function listMarkdown(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? listMarkdown(full) : entry.endsWith('.md') ? [full] : [];
  });
}

describe('parseHowToCook', () => {
  it('extracts the tomato-egg recipe', () => {
    const path = 'dishes/vegetable_dish/西红柿炒鸡蛋.md';
    const draft = parseHowToCook(path, readFileSync(join(SEED_DIR, path), 'utf8'));
    expect(draft).toMatchObject({
      name: '西红柿炒鸡蛋',
      category: 'vegetable_dish',
      difficulty: 2,
    });
    expect(draft.ingredientsAndTools).toContain('鸡蛋');
    expect(draft.calculation).toContain('份数');
    expect(draft.steps).toContain('西红柿洗净');
    expect(draft.description).not.toContain('预估');
  });

  it('parses every seed file without errors', () => {
    const files = listMarkdown(join(SEED_DIR, 'dishes'));
    expect(files.length).toBeGreaterThan(300);
    for (const file of files) {
      const path = relative(SEED_DIR, file);
      const draft = parseHowToCook(path, readFileSync(file, 'utf8'));
      expect(draft.name, path).not.toBe('');
      if (!SKIPPED_CATEGORIES.has(draft.category))
        expect(draft.ingredientsAndTools.length, path).toBeGreaterThan(0);
    }
  });

  it('rejects a file without a title', () => {
    expect(() => parseHowToCook('dishes/soup/x.md', '## 操作\n1. 煮')).toThrow(SeedParseError);
  });
});
