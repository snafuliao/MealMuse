/** 按份数换算用量（docs/design-docs/data-model.md 第 4 节）。null 表示「适量」，不换算。 */

const STEP_BY_UNIT: Record<string, number> = { g: 5, ml: 5 };
const DEFAULT_STEP = 0.5;

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function scaleQuantity(
  quantity: number | null,
  unit: string,
  fromServings: number,
  toServings: number,
): number | null {
  if (quantity === null) return null;
  const scaled = (quantity * toServings) / fromServings;
  if (scaled === 0) return 0;
  const step = STEP_BY_UNIT[unit] ?? DEFAULT_STEP;
  // 少量调料（如 2g 盐）按 5 取整会变成 0，此时保留一位小数。
  if (scaled < step) return Math.max(Math.round(scaled * 10) / 10, 0.1);
  return roundTo(scaled, step);
}
