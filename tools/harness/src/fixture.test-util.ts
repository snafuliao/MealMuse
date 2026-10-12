import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** 在临时目录里搭一个最小仓库，供规则测试使用。 */
export function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'harness-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}
