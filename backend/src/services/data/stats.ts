/**
 * Statistics for Chapter 4, computed in code so no number is ever invented:
 * frequencies and percentages, summaries, cross-tabulations with chi-square,
 * Pearson correlation and one-way ANOVA. The p-values use the standard
 * special functions (log-gamma, incomplete gamma and beta).
 */

export type Cell = string | number | null;

export interface Dataset {
  columns: string[];
  rows: Cell[][];
}

// ── Special functions ──────────────────────────────────────────────────────

const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

export function lnGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i++) x += LANCZOS[i] / (z + i + 1);
  const t = z + LANCZOS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Regularised upper incomplete gamma Q(a, x). */
export function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) {
    // Series for P, then Q = 1 - P.
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  // Continued fraction for Q.
  let b = x + 1 - a;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

function betaCf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-300) d = 1e-300;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
export function betaI(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (front * betaCf(a, b, x)) / a : 1 - (front * betaCf(b, a, 1 - x)) / b;
}

export const chiSquareP = (chi: number, df: number) => gammaQ(df / 2, chi / 2);
/** Two-tailed p for Student's t. */
export const tTestP = (t: number, df: number) => betaI(df / (df + t * t), df / 2, 0.5);
export const fTestP = (f: number, df1: number, df2: number) => betaI(df2 / (df2 + df1 * f), df2 / 2, df1 / 2);

// ── Columns ────────────────────────────────────────────────────────────────

const asNumber = (v: Cell): number | null => {
  if (v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = v.trim().replace(/,(?=\d{3}\b)/g, '');
  return s && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};
const asText = (v: Cell): string | null => (v === null ? null : String(v).trim() || null);

export interface ColumnInfo {
  name: string;
  /** Every answer is a number. */
  numeric: boolean;
  distinct: number;
  answered: number;
}

export function describeColumns(data: Dataset): ColumnInfo[] {
  return data.columns.map((name, c) => {
    const values = data.rows.map((r) => asText(r[c] ?? null)).filter((v): v is string => v !== null);
    return {
      name,
      numeric: values.length > 0 && values.every((v) => asNumber(v) !== null),
      distinct: new Set(values.map((v) => v.toLowerCase())).size,
      answered: values.length,
    };
  });
}

// Common answer scales, in the order they are read.
const SCALES = [
  ['strongly disagree', 'disagree', 'neutral', 'undecided', 'not sure', 'agree', 'strongly agree'],
  ['very dissatisfied', 'dissatisfied', 'neutral', 'satisfied', 'very satisfied'],
  ['never', 'rarely', 'sometimes', 'often', 'always'],
  ['very low', 'low', 'moderate', 'high', 'very high'],
  ['very poor', 'poor', 'fair', 'good', 'very good', 'excellent'],
  ['no', 'yes'],
];

/** Categories in reading order: numbers ascending, a known scale in its order, otherwise most frequent first. */
function orderCategories(counts: Map<string, number>, numeric: boolean): string[] {
  const values = [...counts.keys()];
  if (numeric) return values.sort((a, b) => Number(a) - Number(b));
  const scale = SCALES.find((s) => values.every((v) => s.includes(v.toLowerCase())));
  if (scale) return values.sort((a, b) => scale.indexOf(a.toLowerCase()) - scale.indexOf(b.toLowerCase()));
  return values.sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
}

/** Percentages to one decimal place that add up to exactly 100.0 (largest remainder). */
export function percentages(counts: number[]): number[] {
  const total = counts.reduce((s, c) => s + c, 0);
  if (!total) return counts.map(() => 0);
  const tenths = counts.map((c) => (c * 1000) / total);
  const floors = tenths.map(Math.floor);
  let left = 1000 - floors.reduce((s, f) => s + f, 0);
  const order = tenths.map((t, i) => ({ i, r: t - Math.floor(t) })).sort((a, b) => b.r - a.r);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return floors.map((f) => f / 10);
}

const round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places;

function columnIndex(data: Dataset, name: string): number {
  const i = data.columns.indexOf(name);
  if (i < 0) throw new StatsError(`There is no column called "${name}".`);
  return i;
}

export class StatsError extends Error {
  status = 400;
}

// ── Analyses ───────────────────────────────────────────────────────────────

export interface Frequencies {
  kind: 'frequencies';
  column: string;
  n: number;
  missing: number;
  rows: { value: string; count: number; percent: number }[];
}

export function frequencies(data: Dataset, column: string): Frequencies {
  const c = columnIndex(data, column);
  const counts = new Map<string, number>();
  const spelling = new Map<string, string>();
  let missing = 0;
  for (const row of data.rows) {
    const v = asText(row[c] ?? null);
    if (v === null) { missing++; continue; }
    const key = v.toLowerCase();
    if (!spelling.has(key)) spelling.set(key, v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size > 40) throw new StatsError(`"${column}" has ${counts.size} different answers, too many for a frequency table. Try a summary instead.`);
  const numeric = [...counts.keys()].every((k) => asNumber(k) !== null);
  const order = orderCategories(new Map([...counts].map(([k, n]) => [spelling.get(k)!, n])), numeric);
  const list = order.map((v) => counts.get(v.toLowerCase())!);
  const pct = percentages(list);
  return { kind: 'frequencies', column, n: list.reduce((s, x) => s + x, 0), missing, rows: order.map((value, i) => ({ value, count: list[i], percent: pct[i] })) };
}

export interface Summary {
  kind: 'summary';
  column: string;
  n: number;
  missing: number;
  mean: number;
  sd: number;
  median: number;
  min: number;
  max: number;
}

function numbersOf(data: Dataset, c: number): number[] {
  return data.rows.map((r) => asNumber(r[c] ?? null)).filter((v): v is number => v !== null);
}

const meanOf = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sdOf = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = meanOf(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

export function summary(data: Dataset, column: string): Summary {
  const c = columnIndex(data, column);
  const xs = numbersOf(data, c);
  if (!xs.length) throw new StatsError(`"${column}" has no numbers to summarise.`);
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    kind: 'summary',
    column,
    n: xs.length,
    missing: data.rows.length - xs.length,
    mean: round(meanOf(xs), 2),
    sd: round(sdOf(xs), 2),
    median: sorted.length % 2 ? sorted[mid] : round((sorted[mid - 1] + sorted[mid]) / 2, 2),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

export interface CrossTab {
  kind: 'crosstab';
  row: string;
  column: string;
  rowValues: string[];
  columnValues: string[];
  counts: number[][];
  n: number;
  chiSquare: number;
  df: number;
  p: number;
  cramersV: number;
  /** Share of cells (percent) with an expected count below 5, which makes chi-square unreliable. */
  lowExpected: number;
}

export function crossTab(data: Dataset, rowColumn: string, colColumn: string): CrossTab {
  const r = columnIndex(data, rowColumn);
  const c = columnIndex(data, colColumn);
  const pairs = data.rows
    .map((row) => [asText(row[r] ?? null), asText(row[c] ?? null)] as const)
    .filter((p): p is readonly [string, string] => p[0] !== null && p[1] !== null);
  const rowCounts = new Map<string, number>();
  const colCounts = new Map<string, number>();
  for (const [a, b] of pairs) {
    rowCounts.set(a, (rowCounts.get(a) ?? 0) + 1);
    colCounts.set(b, (colCounts.get(b) ?? 0) + 1);
  }
  if (rowCounts.size > 15 || colCounts.size > 15) throw new StatsError('Each column can have at most 15 different answers for a cross-tabulation.');
  if (rowCounts.size < 2 || colCounts.size < 2) throw new StatsError('Each column needs at least two different answers to compare.');
  const rowValues = orderCategories(rowCounts, [...rowCounts.keys()].every((k) => asNumber(k) !== null));
  const columnValues = orderCategories(colCounts, [...colCounts.keys()].every((k) => asNumber(k) !== null));
  const counts = rowValues.map(() => columnValues.map(() => 0));
  for (const [a, b] of pairs) counts[rowValues.indexOf(a)][columnValues.indexOf(b)]++;

  const n = pairs.length;
  const rowTotals = counts.map((row) => row.reduce((s, x) => s + x, 0));
  const colTotals = columnValues.map((_, j) => counts.reduce((s, row) => s + row[j], 0));
  let chi = 0;
  let low = 0;
  counts.forEach((row, i) => row.forEach((observed, j) => {
    const expected = (rowTotals[i] * colTotals[j]) / n;
    if (expected < 5) low++;
    chi += (observed - expected) ** 2 / expected;
  }));
  const df = (rowValues.length - 1) * (columnValues.length - 1);
  return {
    kind: 'crosstab',
    row: rowColumn,
    column: colColumn,
    rowValues,
    columnValues,
    counts,
    n,
    chiSquare: round(chi, 2),
    df,
    p: chiSquareP(chi, df),
    cramersV: round(Math.sqrt(chi / (n * (Math.min(rowValues.length, columnValues.length) - 1))), 2),
    lowExpected: round((low * 100) / (rowValues.length * columnValues.length), 1),
  };
}

export interface Correlation {
  kind: 'correlation';
  a: string;
  b: string;
  n: number;
  r: number;
  p: number;
}

export function correlation(data: Dataset, a: string, b: string): Correlation {
  const ia = columnIndex(data, a);
  const ib = columnIndex(data, b);
  const pairs = data.rows
    .map((row) => [asNumber(row[ia] ?? null), asNumber(row[ib] ?? null)] as const)
    .filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null);
  if (pairs.length < 3) throw new StatsError('A correlation needs at least three people who answered both questions with numbers.');
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = meanOf(xs);
  const my = meanOf(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (!sxx || !syy) throw new StatsError('One of these columns has the same answer for everyone, so there is nothing to correlate.');
  const r = sxy / Math.sqrt(sxx * syy);
  const df = pairs.length - 2;
  const t = Math.abs(r) >= 1 ? Infinity : r * Math.sqrt(df / (1 - r * r));
  return { kind: 'correlation', a, b, n: pairs.length, r: round(r, 2), p: Number.isFinite(t) ? tTestP(t, df) : 0 };
}

export interface GroupMeans {
  kind: 'group-means';
  value: string;
  group: string;
  groups: { group: string; n: number; mean: number; sd: number }[];
  f: number;
  df1: number;
  df2: number;
  p: number;
}

/** Mean of a numeric column in each group, with a one-way ANOVA. */
export function groupMeans(data: Dataset, value: string, group: string): GroupMeans {
  const iv = columnIndex(data, value);
  const ig = columnIndex(data, group);
  const byGroup = new Map<string, number[]>();
  for (const row of data.rows) {
    const g = asText(row[ig] ?? null);
    const x = asNumber(row[iv] ?? null);
    if (g === null || x === null) continue;
    byGroup.set(g, [...(byGroup.get(g) ?? []), x]);
  }
  if (byGroup.size < 2) throw new StatsError(`"${group}" needs at least two groups with numeric answers for "${value}".`);
  if (byGroup.size > 15) throw new StatsError(`"${group}" has more than 15 groups.`);
  const counts = new Map([...byGroup].map(([g, xs]) => [g, xs.length]));
  const order = orderCategories(counts, [...counts.keys()].every((k) => asNumber(k) !== null));
  const all = [...byGroup.values()].flat();
  const grand = meanOf(all);
  let between = 0;
  let within = 0;
  for (const xs of byGroup.values()) {
    const m = meanOf(xs);
    between += xs.length * (m - grand) ** 2;
    within += xs.reduce((s, x) => s + (x - m) ** 2, 0);
  }
  const df1 = byGroup.size - 1;
  const df2 = all.length - byGroup.size;
  const f = df2 > 0 && within > 0 ? between / df1 / (within / df2) : 0;
  return {
    kind: 'group-means',
    value,
    group,
    groups: order.map((g) => ({ group: g, n: byGroup.get(g)!.length, mean: round(meanOf(byGroup.get(g)!), 2), sd: round(sdOf(byGroup.get(g)!), 2) })),
    f: round(f, 2),
    df1,
    df2,
    p: df2 > 0 && within > 0 ? fTestP(f, df1, df2) : 1,
  };
}

export type Analysis = Frequencies | Summary | CrossTab | Correlation | GroupMeans;

/** "p = .032" or "p < .001", as APA writes it. */
export function formatP(p: number): string {
  if (p < 0.001) return 'p < .001';
  return `p = ${p.toFixed(3).replace(/^0/, '')}`;
}
