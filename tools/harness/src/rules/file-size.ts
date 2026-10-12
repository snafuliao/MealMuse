import { listFiles, readText } from '../files.js';
import type { Rule, Violation } from '../types.js';

export const MAX_LINES = 300;
const SOURCE = /\.(ts|tsx|swift)$/;
const SCOPES = ['apps/', 'packages/', 'tools/', 'scripts/'];

export const fileSizeRule: Rule = {
  id: 'T1 file-size',
  description: `源码文件不超过 ${MAX_LINES} 行`,
  run(root) {
    const violations: Violation[] = [];
    for (const file of listFiles(root)) {
      if (!SOURCE.test(file) || !SCOPES.some((scope) => file.startsWith(scope))) continue;
      const lines = readText(root, file).split('\n').length;
      if (lines > MAX_LINES) {
        violations.push({
          rule: this.id,
          file,
          message: `文件有 ${lines} 行，超过上限 ${MAX_LINES}。`,
          fix: '按职责拆分为多个文件（例如把辅助函数、子组件或测试用例分组移到同目录新文件），不要靠删换行压缩行数。',
        });
      }
    }
    return violations;
  },
};
