import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { mapWithConcurrency } from '../../../../providers/concurrency.js';
import type { Providers } from '../../../../providers/index.js';
import { SEED_STRUCTURE_PROMPT_VERSION } from '../../config/prompts.js';
import * as repo from '../../repo/recipe-repo.js';
import * as seedRepo from '../../repo/seed-repo.js';
import { saveRecipe } from '../recipe-service.js';
import { parseHowToCook, SKIPPED_CATEGORIES } from './parse-howtocook.js';
import {
  StructuredSeedSchema,
  structureSeed,
  toRecipeDraft,
  type StructuredSeed,
} from './structure.js';

export type SeedImportOptions = {
  seedDir: string;
  /** 只处理这些相对路径（如 dishes/soup/紫菜蛋花汤.md）；为空则处理全部。 */
  only?: string[];
  limit?: number;
  concurrency?: number;
  /** 已成功导入的也重新导入（覆盖原菜谱）。 */
  force?: boolean;
};

export type SeedImportSummary = {
  imported: number;
  skipped: number;
  failed: number;
  unchanged: number;
};

/** 同一提示词版本下已有的结构化结果可以复用（force 时重新结构化）。 */
function reusableStructure(
  item: seedRepo.SeedItemRow | null,
  force: boolean,
): StructuredSeed | null {
  if (force || !item?.structured || item.promptVersion !== SEED_STRUCTURE_PROMPT_VERSION)
    return null;
  const parsed = StructuredSeedSchema.safeParse(item.structured);
  return parsed.success ? parsed.data : null;
}

function listDishFiles(seedDir: string): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : entry.endsWith('.md') ? [full] : [];
    });
  return walk(join(seedDir, 'dishes'))
    .map((file) => relative(seedDir, file).split('\\').join('/'))
    .sort();
}

/**
 * 导入 HowToCook 种子：规则解析 → 模型结构化 → 校验 → 入库（published, source = seed）。
 * 可重复执行：已导入的默认跳过，失败的会重试；每个文件的结果记入 seed_import_items。
 */
export async function importSeed(
  providers: Pick<Providers, 'database' | 'logger' | 'llm'>,
  options: SeedImportOptions,
): Promise<SeedImportSummary> {
  const { db } = providers.database;
  const batch = `${new Date().toISOString().slice(0, 10)}-${SEED_STRUCTURE_PROMPT_VERSION}`;
  let paths = listDishFiles(options.seedDir);
  if (options.only?.length) paths = paths.filter((path) => options.only?.includes(path));

  const pending: string[] = [];
  let unchanged = 0;
  for (const path of paths) {
    const existing = await seedRepo.findSeedItem(db, path);
    if (existing?.status === 'imported' && !options.force) unchanged++;
    else pending.push(path);
  }
  const queue = options.limit ? pending.slice(0, options.limit) : pending;
  providers.logger.info(
    { total: paths.length, queued: queue.length, unchanged, batch },
    'seed import started',
  );

  const outcomes = await mapWithConcurrency(queue, options.concurrency ?? 4, async (sourcePath) => {
    let structured: StructuredSeed | null = null;
    const record = (
      status: 'imported' | 'failed' | 'skipped',
      recipeId: string | null,
      error: string | null,
    ) =>
      seedRepo.recordSeedItem(db, {
        batch,
        sourcePath,
        status,
        recipeId,
        error,
        structured,
        promptVersion: structured ? SEED_STRUCTURE_PROMPT_VERSION : null,
      });
    try {
      const draft = parseHowToCook(
        sourcePath,
        readFileSync(join(options.seedDir, sourcePath), 'utf8'),
      );
      if (SKIPPED_CATEGORIES.has(draft.category)) {
        await record('skipped', null, `分类 ${draft.category} 不是菜品`);
        return 'skipped' as const;
      }
      const existing = await seedRepo.findSeedItem(db, sourcePath);
      structured = reusableStructure(existing, options.force ?? false);
      if (!structured) {
        const known = (await repo.listIngredients(db, undefined)).map((row) => row.name);
        structured = await structureSeed(providers.llm, draft, known.slice(0, 600));
      }
      const toSave = structured;
      const recipeId = await db.transaction((tx) =>
        saveRecipe(tx, existing?.recipeId ?? null, toRecipeDraft(toSave), {
          status: 'published',
          source: 'seed',
          sourceRef: sourcePath,
        }),
      );
      await record('imported', recipeId, null);
      providers.logger.info({ sourcePath, recipeId }, 'seed recipe imported');
      return 'imported' as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await record('failed', null, message.slice(0, 1000));
      providers.logger.warn({ sourcePath, error: message.slice(0, 300) }, 'seed recipe failed');
      return 'failed' as const;
    }
  });

  const summary = {
    imported: outcomes.filter((o) => o === 'imported').length,
    skipped: outcomes.filter((o) => o === 'skipped').length,
    failed: outcomes.filter((o) => o === 'failed').length,
    unchanged,
  };
  providers.logger.info({ ...summary, batch }, 'seed import finished');
  return summary;
}
