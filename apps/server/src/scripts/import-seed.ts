import { parseArgs } from 'node:util';
import { createServices } from '../composition.js';
import { loadConfig } from '../config/env.js';
import { SEED_DIR } from '../domains/recipe/config/seed.js';
import { importSeed } from '../domains/recipe/service/seed/import-seed.js';

/**
 * 导入种子菜谱（需要已启用的模型供应商）。可重复执行，已导入的会跳过。
 * 用法：pnpm --filter @mealmuse/server seed:import [--limit 5] [--only dishes/soup/x.md] [--concurrency 4] [--force]
 */
const { values } = parseArgs({
  options: {
    limit: { type: 'string' },
    only: { type: 'string', multiple: true },
    concurrency: { type: 'string', default: '4' },
    force: { type: 'boolean', default: false },
  },
});

const services = createServices(loadConfig());
try {
  const summary = await importSeed(services.providers, {
    seedDir: SEED_DIR,
    ...(values.only ? { only: values.only } : {}),
    ...(values.limit ? { limit: Number(values.limit) } : {}),
    concurrency: Number(values.concurrency),
    force: values.force,
  });
  process.stdout.write(
    `导入完成：新导入 ${summary.imported}，失败 ${summary.failed}，跳过 ${summary.skipped}，之前已导入 ${summary.unchanged}\n`,
  );
  if (summary.failed > 0) {
    process.stdout.write(
      '失败条目可在管理端「菜谱管理 → 导入记录」查看，修复后重新运行本命令会自动重试。\n',
    );
  }
} finally {
  await services.shutdown();
}
