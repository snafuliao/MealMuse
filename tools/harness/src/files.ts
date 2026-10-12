import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.build',
  '.swiftpm',
  'DerivedData',
  'build',
]);

/** 列出 root 下（或其子目录 dir 下）的文件，返回相对 root 的路径（统一用 /），跳过依赖、构建产物与生成的 Xcode 工程。 */
export function listFiles(root: string, dir = ''): string[] {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(absolute)) {
    if (IGNORED_DIRS.has(entry) || entry.endsWith('.xcodeproj')) continue;
    const child = join(dir, entry);
    if (statSync(join(root, child)).isDirectory()) {
      result.push(...listFiles(root, child));
    } else {
      result.push(child.split(sep).join('/'));
    }
  }
  return result;
}

export function readText(root: string, file: string): string {
  return readFileSync(join(root, file), 'utf8');
}

export function toRepoPath(root: string, absolute: string): string {
  return relative(root, absolute).split(sep).join('/');
}

export function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}
