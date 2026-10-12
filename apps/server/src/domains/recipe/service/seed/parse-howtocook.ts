/**
 * HowToCook 菜谱 Markdown 的规则解析（不调用模型）。
 * 上游格式：「# X的做法」标题、简介、「预估烹饪难度：★★」，以及四个固定章节。
 */
export type SeedDraft = {
  sourcePath: string;
  /** dishes/ 下的一级目录，如 meat_dish、soup。 */
  category: string;
  name: string;
  description: string;
  difficulty: number | null;
  ingredientsAndTools: string[];
  calculation: string;
  steps: string;
  extra: string;
};

export class SeedParseError extends Error {}

const SECTION_TITLES = {
  ingredientsAndTools: '必备原料和工具',
  calculation: '计算',
  steps: '操作',
  extra: '附加内容',
} as const;

/** 调料、半成品酱汁这类目录不是一道菜，不导入。 */
export const SKIPPED_CATEGORIES: ReadonlySet<string> = new Set(['condiment', 'template']);

function splitSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  const parts = markdown.split(/^## /m);
  sections.set('', parts[0] ?? '');
  for (const part of parts.slice(1)) {
    const newline = part.indexOf('\n');
    const title = (newline === -1 ? part : part.slice(0, newline)).trim();
    sections.set(title, newline === -1 ? '' : part.slice(newline + 1).trim());
  }
  return sections;
}

/** 去掉图片引用（种子仓库没有下载图片）。 */
const stripImages = (text: string) => text.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();

export function parseHowToCook(sourcePath: string, markdown: string): SeedDraft {
  const category = sourcePath.split('/')[1] ?? '';
  const sections = splitSections(markdown.replace(/\r\n/g, '\n'));
  const head = sections.get('') ?? '';

  const title = /^# (.+)$/m.exec(head)?.[1]?.trim();
  if (!title) throw new SeedParseError('缺少「# 菜名」标题');
  const name = title.replace(/的做法$/, '').trim();

  const stars = /预估烹饪难度[：:]\s*(★+)/.exec(head)?.[1]?.length ?? null;
  const description = stripImages(
    head
      .replace(/^# .+$/m, '')
      .replace(/^预估.*$/gm, '')
      .trim(),
  );

  const section = (key: keyof typeof SECTION_TITLES) =>
    stripImages(sections.get(SECTION_TITLES[key]) ?? '');
  const steps = section('steps');
  if (!steps) throw new SeedParseError('「操作」章节为空');

  return {
    sourcePath,
    category,
    name,
    description,
    difficulty: stars !== null ? Math.min(Math.max(stars, 1), 5) : null,
    ingredientsAndTools: section('ingredientsAndTools')
      .split('\n')
      .map((line) => line.replace(/^\s*[*-]\s*/, '').trim())
      .filter(Boolean),
    calculation: section('calculation'),
    steps,
    extra: section('extra'),
  };
}
