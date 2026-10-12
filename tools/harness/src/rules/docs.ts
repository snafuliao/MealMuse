import { existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { lineOf, listFiles, readText } from '../files.js';
import type { Rule, Violation } from '../types.js';

export const AGENTS_MAX_LINES = 100;

export const REQUIRED_DOCS = [
  'AGENTS.md',
  'ARCHITECTURE.md',
  'docs/CI.md',
  'docs/requirements.md',
  'docs/DESIGN.md',
  'docs/FRONTEND.md',
  'docs/PLANS.md',
  'docs/PRODUCT_SENSE.md',
  'docs/QUALITY_SCORE.md',
  'docs/RELIABILITY.md',
  'docs/SECURITY.md',
  'docs/design-docs/index.md',
  'docs/design-docs/core-beliefs.md',
  'docs/product-specs/index.md',
  'docs/exec-plans/tech-debt-tracker.md',
  'docs/exec-plans/active',
  'docs/exec-plans/completed',
];

/** 施工图本身大量出现模板路径（<slug>.md 之类），不做链接校验。 */
const LINK_CHECK_EXEMPT = new Set(['docs/HARNESS-RULES.md']);

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;
/** 反引号中形如仓库路径的引用，例如 `docs/CI.md`、`apps/server/src/`。 */
const CODE_PATH = /`((?:[\w.-]+\/)+[\w.-]*)`/g;
const PATH_LIKE = /^(AGENTS\.md|ARCHITECTURE\.md|docs\/|apps\/|packages\/|tools\/|scripts\/)/;

function referencedPaths(
  text: string,
): Array<{ target: string; index: number; fromRoot: boolean }> {
  const refs: Array<{ target: string; index: number; fromRoot: boolean }> = [];
  for (const match of text.matchAll(MARKDOWN_LINK)) {
    const target = (match[1] ?? '').split('#')[0] ?? '';
    if (!target || /^[a-z]+:/i.test(target)) continue;
    refs.push({ target, index: match.index, fromRoot: false });
  }
  for (const match of text.matchAll(CODE_PATH)) {
    const target = match[1] ?? '';
    if (PATH_LIKE.test(target) && !target.includes('*')) {
      refs.push({ target, index: match.index, fromRoot: true });
    }
  }
  return refs;
}

export const docsRule: Rule = {
  id: 'T9 docs',
  description: '必备文档齐全、AGENTS.md 不超过 100 行、文档中的仓库路径都真实存在',
  run(root) {
    const violations: Violation[] = [];
    for (const required of REQUIRED_DOCS) {
      if (!existsSync(join(root, required))) {
        violations.push({
          rule: this.id,
          file: required,
          message: '缺少必备文档或目录。',
          fix: '按 ARCHITECTURE.md 的「文档地图」创建它；目录用 .gitkeep 占位。',
        });
      }
    }

    if (existsSync(join(root, 'AGENTS.md'))) {
      const lines = readText(root, 'AGENTS.md').trimEnd().split('\n').length;
      if (lines > AGENTS_MAX_LINES) {
        violations.push({
          rule: this.id,
          file: 'AGENTS.md',
          message: `AGENTS.md 有 ${lines} 行，超过 ${AGENTS_MAX_LINES} 行上限。`,
          fix: 'AGENTS.md 只做目录：把细节移到 docs/ 下对应文档，这里只留一行指向它。',
        });
      }
    }

    for (const file of listFiles(root)) {
      if (!file.endsWith('.md') || LINK_CHECK_EXEMPT.has(file)) continue;
      const text = readText(root, file);
      for (const { target, index, fromRoot } of referencedPaths(text)) {
        const resolved = fromRoot ? target : normalize(join(dirname(file), target));
        if (!existsSync(join(root, resolved))) {
          violations.push({
            rule: this.id,
            file,
            line: lineOf(text, index),
            message: `引用的路径不存在：${target}`,
            fix: '更新为正确路径；若文件已删除，同步删掉这条引用。尚未创建的内容不要写成路径，改用文字描述。',
          });
        }
      }
    }
    return violations;
  },
};
