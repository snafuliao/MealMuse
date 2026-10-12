import { openapiSyncRule, schemaNamingRule } from './rules/contracts.js';
import { docsRule } from './rules/docs.js';
import { fileSizeRule } from './rules/file-size.js';
import { layerDepsRule } from './rules/layer-deps.js';
import { versionsRule } from './rules/versions.js';
import type { Rule, Violation } from './types.js';

export const RULES: Rule[] = [
  fileSizeRule,
  layerDepsRule,
  schemaNamingRule,
  openapiSyncRule,
  docsRule,
  versionsRule,
];

export function runAll(root: string): Violation[] {
  return RULES.flatMap((rule) => rule.run(root));
}

export function format(violation: Violation): string {
  const where = violation.line ? `${violation.file}:${violation.line}` : violation.file;
  return `✖ [${violation.rule}] ${where}\n  问题：${violation.message}\n  修复：${violation.fix}`;
}
