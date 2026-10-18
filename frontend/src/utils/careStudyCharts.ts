import type { ChartSpec, SectionEntries } from '../types/careStudy';

/** Mirrors backend/src/services/care-study/chart.service.ts so the page shows what the export will contain. */
export interface ChartPoint { t: number; v: number }
export interface ChartSeries { field: string; label: string; min: number; max: number; step: number; points: ChartPoint[] }
export interface ChartData { mode: 'time' | 'date'; series: ChartSeries[]; skipped: number }

export function parseNaiveTime(value: string | undefined): number | null {
  const m = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  return Number.isFinite(t) ? t : null;
}

const toNumber = (v: string | undefined) => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
};

export function chartData(spec: ChartSpec, entries: SectionEntries | undefined): ChartData {
  const items = entries?.items ?? [];
  let skipped = 0;
  const series: ChartSeries[] = spec.series.map((s) => ({ ...s, points: [] }));
  const times: number[] = [];
  for (const item of items) {
    const t = parseNaiveTime(item[spec.time_field]);
    let hasNumber = false;
    for (const s of series) {
      const v = toNumber(item[s.field]);
      if (v === null) continue;
      hasNumber = true;
      if (t !== null) s.points.push({ t, v });
    }
    if (t === null && hasNumber) skipped++;
    if (t !== null) times.push(t);
  }
  for (const s of series) {
    s.points.sort((a, b) => a.t - b.t);
    const values = s.points.map((p) => p.v);
    if (values.length) {
      s.min = Math.min(s.min, Math.floor(Math.min(...values) / s.step) * s.step);
      s.max = Math.max(s.max, Math.ceil(Math.max(...values) / s.step) * s.step);
    }
  }
  const span = times.length ? Math.max(...times) - Math.min(...times) : 0;
  return {
    mode: span < 2 * 86_400_000 && items.some((it) => (it[spec.time_field] ?? '').includes('T')) ? 'time' : 'date',
    series: series.filter((s) => s.points.length > 0),
    skipped,
  };
}

export function niceTicks(t0: number, t1: number, mode: 'time' | 'date'): number[] {
  const MIN = 60_000, DAY = 86_400_000;
  const steps = mode === 'time'
    ? [15 * MIN, 30 * MIN, 60 * MIN, 120 * MIN, 180 * MIN, 360 * MIN, 720 * MIN, DAY]
    : [DAY, 2 * DAY, 5 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 60 * DAY, 90 * DAY];
  const step = steps.find((st) => (t1 - t0) / st <= 6) ?? steps[steps.length - 1];
  const ticks: number[] = [];
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) ticks.push(t);
  return ticks;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
export function tickLabel(t: number, mode: 'time' | 'date'): string {
  const d = new Date(t);
  return mode === 'time' ? `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}` : `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}`;
}

export function timeRange(data: ChartData): [number, number] {
  const all = data.series.flatMap((s) => s.points.map((p) => p.t));
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = hi === lo ? (data.mode === 'time' ? 3_600_000 : 86_400_000) : (hi - lo) * 0.05;
  return [lo - pad, hi + pad];
}
