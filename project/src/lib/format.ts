// Money and number formatting. All amounts in the demo are illustrative USD.

const USD2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Round half away from zero to cents. */
export function round2(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-9) / 100;
}

/** Sum money values in integer cents to avoid floating-point drift. */
export function sumMoney(values: number[]): number {
  return values.reduce((s, v) => s + Math.round(v * 100), 0) / 100;
}

export function lineAmount(quantity: number, rate: number): number {
  return round2(quantity * rate);
}

export function usd(n: number | undefined | null, cents = true): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return (cents ? USD2 : USD0).format(n);
}

/** "+USD 1,234.50" / "−USD 45.00" */
export function usdDelta(n: number): string {
  if (Math.abs(n) < 0.005) return USD2.format(0);
  return `${n > 0 ? '+' : '−'}${USD2.format(Math.abs(n))}`;
}

export function usdCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return USD0.format(n);
}

export function num(n: number): string {
  return NUM.format(n);
}

/** Percent change of `diff` relative to `base`; null when base is 0. */
export function pctOf(diff: number, base: number): number | null {
  if (base === 0) return null;
  return round2((diff / base) * 100);
}

export function fmtPct(p: number | null): string {
  if (p === null) return 'n/a';
  if (Math.abs(p) < 0.05) return '0.0%';
  return `${p > 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`;
}
