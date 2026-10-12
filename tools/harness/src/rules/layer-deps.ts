import { dirname, join, normalize } from 'node:path';
import { lineOf, listFiles, readText } from '../files.js';
import type { Rule, Violation } from '../types.js';

/** 服务端领域内的分层，依赖只能向前：types → config → repo → service → runtime。 */
export const LAYERS = ['types', 'config', 'repo', 'service', 'runtime'] as const;
export type Layer = (typeof LAYERS)[number];

const SERVER_SRC = 'apps/server/src';
const DOMAINS = `${SERVER_SRC}/domains`;
const PROVIDERS = `${SERVER_SRC}/providers`;
const CONFIG = `${SERVER_SRC}/config`;

/** 显式禁止的同领域边：runtime 必须经 service 访问数据，不能直连 repo。 */
const FORBIDDEN_SAME_DOMAIN: ReadonlyArray<[Layer, Layer]> = [['runtime', 'repo']];
/** 可以使用 Providers 的层。 */
const PROVIDER_CONSUMERS: ReadonlySet<Layer> = new Set(['repo', 'service', 'runtime']);

type Location =
  | { kind: 'domain'; domain: string; layer: Layer | null }
  | { kind: 'providers' }
  | { kind: 'config' }
  | { kind: 'other' };

export function locate(file: string): Location {
  if (file.startsWith(`${DOMAINS}/`)) {
    const [domain = '', layer] = file.slice(DOMAINS.length + 1).split('/');
    const isLayer = (LAYERS as readonly string[]).includes(layer ?? '');
    return { kind: 'domain', domain, layer: isLayer ? (layer as Layer) : null };
  }
  if (file.startsWith(`${PROVIDERS}/`)) return { kind: 'providers' };
  if (file.startsWith(`${CONFIG}/`)) return { kind: 'config' };
  return { kind: 'other' };
}

const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

export function relativeImports(source: string): Array<{ specifier: string; line: number }> {
  const result: Array<{ specifier: string; line: number }> = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier?.startsWith('.')) {
      result.push({ specifier, line: lineOf(source, match.index) });
    }
  }
  return result;
}

/** 判定一条依赖边是否允许；允许返回 null，否则返回修复指令。 */
export function checkEdge(from: Location, to: Location): string | null {
  if (from.kind === 'providers' && to.kind === 'domain') {
    return 'Providers 只承载横切能力，不能依赖领域代码。把需要的逻辑移到领域 service，或把共享形状移到 @mealmuse/shared。';
  }
  if (from.kind === 'config' && (to.kind === 'domain' || to.kind === 'providers')) {
    return 'config 只负责解析环境配置，不能依赖 Providers 或领域代码。';
  }
  if (from.kind !== 'domain' || from.layer === null) return null;

  if (to.kind === 'providers') {
    return PROVIDER_CONSUMERS.has(from.layer)
      ? null
      : `${from.layer} 层不能使用 Providers；只有 repo / service / runtime 可以。把依赖横切能力的代码移到这些层。`;
  }
  if (to.kind === 'config') {
    return '领域代码不要直接导入 src/config，改为通过 Providers 的 config 字段读取配置。';
  }
  if (to.kind === 'other') {
    return '领域代码不能依赖组合根（app.ts / main.ts / scripts）。依赖方向应是组合根 → 领域。';
  }
  if (to.layer === null) {
    return `目标文件不在分层目录内。把它移到 ${to.domain}/<${LAYERS.join('|')}>/ 之一。`;
  }

  const fromIndex = LAYERS.indexOf(from.layer);
  const toIndex = LAYERS.indexOf(to.layer);
  if (to.domain === from.domain) {
    if (toIndex > fromIndex) {
      return `依赖方向反了：${from.layer} 不能依赖更靠后的 ${to.layer}（顺序 ${LAYERS.join(' → ')}）。把共享部分下沉到更靠前的层。`;
    }
    if (FORBIDDEN_SAME_DOMAIN.some(([a, b]) => a === from.layer && b === to.layer)) {
      return `${from.layer} 不能直接依赖 ${to.layer}，请经由 service 层访问。`;
    }
    return null;
  }

  if (to.layer === 'types') return null;
  if (to.layer === 'service' && (from.layer === 'service' || from.layer === 'runtime')) return null;
  return `跨领域只允许依赖对方的 types，或在 service / runtime 中调用对方的 service；不能依赖 ${to.domain}/${to.layer}。`;
}

export const layerDepsRule: Rule = {
  id: 'T7 layer-deps',
  description: '服务端分层依赖只能向前，横切关注点只经 Providers 进入',
  run(root) {
    const violations: Violation[] = [];
    const files = listFiles(root, SERVER_SRC);
    for (const file of files) {
      if (!/\.tsx?$/.test(file)) continue;
      const from = locate(file);
      if (from.kind === 'domain' && from.layer === null) {
        violations.push({
          rule: this.id,
          file,
          message: '领域文件不在分层目录内。',
          fix: `移到 ${DOMAINS}/${from.domain}/<${LAYERS.join('|')}>/ 之一。`,
        });
        continue;
      }
      for (const { specifier, line } of relativeImports(readText(root, file))) {
        const target = normalize(join(dirname(file), specifier))
          .split('\\')
          .join('/');
        const fix = checkEdge(from, locate(target));
        if (fix) {
          violations.push({
            rule: this.id,
            file,
            line,
            message: `不允许的依赖：${specifier}`,
            fix,
          });
        }
      }
    }
    return violations;
  },
};
