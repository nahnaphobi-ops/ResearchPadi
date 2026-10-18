import { deflateSync } from 'zlib';
import type { ChartSpec, SectionEntries } from './template.service.js';

/**
 * Charts for care studies. The AI never draws or describes a chart: the app
 * plots the numbers the student entered. Images are drawn here with no image
 * library and no fonts (the production image has neither): lines, dots and a
 * tiny built-in digit font. Titles and units are printed by the document.
 */
export interface ChartPoint { t: number; v: number }
export interface ChartSeries {
  field: string;
  label: string;
  min: number;
  max: number;
  step: number;
  points: ChartPoint[];
}
export interface ChartData {
  key: string;
  title: string;
  note?: string;
  /** 'time' when the readings are within two days of each other, otherwise 'date'. */
  mode: 'time' | 'date';
  series: ChartSeries[];
  /** Entries that had a number but no usable date or time, so they could not be plotted. */
  skipped: number;
}

/** "2021-11-09" or "2021-11-09T06:30" → ms, read as written (no time zone shifts). */
export function parseNaiveTime(value: string | undefined): number | null {
  const m = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  return Number.isFinite(t) ? t : null;
}

const toNumber = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
};

/** The points to plot, in time order. Axes always cover the data, so nothing is hidden or clipped. */
export function chartData(spec: ChartSpec, entries: SectionEntries | null | undefined): ChartData {
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
      if (t === null) continue;
      s.points.push({ t, v });
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
    key: spec.key,
    title: spec.title,
    note: spec.note,
    mode: span < 2 * 86_400_000 && items.some((it) => (it[spec.time_field] ?? '').includes('T')) ? 'time' : 'date',
    series: series.filter((s) => s.points.length > 0),
    skipped,
  };
}

/** A chart is worth drawing once a series has at least two readings. */
export const hasChart = (data: ChartData) => data.series.some((s) => s.points.length >= 2);

// ── PNG drawing ───────────────────────────────────────────────────────────

type Color = [number, number, number];
const WHITE: Color = [255, 255, 255];
const GRID: Color = [226, 230, 240];
const AXIS: Color = [60, 70, 100];
const LINE: Color = [31, 75, 216];
const TEXT: Color = [40, 50, 80];

// 5x7 digit font, enough for axis numbers and times.
const GLYPHS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
};

class Canvas {
  readonly data: Buffer;
  constructor(readonly width: number, readonly height: number) {
    this.data = Buffer.alloc(width * height * 4, 255);
  }
  px(x: number, y: number, c: Color) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, c: Color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: Color, thickness = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    const half = Math.floor(thickness / 2);
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps;
      const y = y0 + ((y1 - y0) * s) / steps;
      this.rect(Math.round(x) - half, Math.round(y) - half, thickness, thickness, c);
    }
  }
  dot(cx: number, cy: number, r: number, c: Color) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + 1) this.px(cx + x, cy + y, c);
  }
  text(str: string, x: number, y: number, scale: number, c: Color, align: 'left' | 'center' | 'right' = 'left') {
    const width = str.length * 6 * scale - scale;
    let cx = align === 'left' ? x : align === 'center' ? x - width / 2 : x - width;
    for (const ch of str) {
      const glyph = GLYPHS[ch];
      if (glyph) {
        glyph.forEach((row, ry) => [...row].forEach((bit, rx) => { if (bit === '1') this.rect(cx + rx * scale, y + ry * scale, scale, scale, c); }));
      }
      cx += 6 * scale;
    }
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

export function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const pad2 = (n: number) => String(n).padStart(2, '0');
function tickLabel(t: number, mode: 'time' | 'date'): string {
  const d = new Date(t);
  return mode === 'time' ? `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}` : `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}`;
}

/** Round tick times (on the hour, on the day...) so the axis reads naturally. */
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

export const CHART_WIDTH = 720;
export const CHART_HEIGHT = 260;

/** One series as a line chart: value on the left axis, date or time along the bottom. */
export function renderSeriesPng(series: ChartSeries, mode: 'time' | 'date', xRange: [number, number]): Buffer {
  const W = CHART_WIDTH, H = CHART_HEIGHT;
  const left = 62, right = 34, top = 16, bottom = 40;
  const c = new Canvas(W, H);
  c.rect(0, 0, W, H, WHITE);

  const plotW = W - left - right, plotH = H - top - bottom;
  const [t0, t1] = xRange;
  const X = (t: number) => left + ((t - t0) / (t1 - t0)) * plotW;
  const Y = (v: number) => top + plotH - ((v - series.min) / (series.max - series.min)) * plotH;

  const decimals = series.step < 1 ? 1 : 0;
  for (let v = series.min; v <= series.max + 1e-9; v += series.step) {
    c.line(left, Y(v), left + plotW, Y(v), GRID, 1);
    c.text(v.toFixed(decimals), left - 8, Y(v) - 7, 2, TEXT, 'right');
  }
  for (const t of niceTicks(t0, t1, mode)) {
    c.line(X(t), top, X(t), top + plotH, GRID, 1);
    c.text(tickLabel(t, mode), X(t), top + plotH + 12, 2, TEXT, 'center');
  }
  c.line(left, top, left, top + plotH, AXIS, 2);
  c.line(left, top + plotH, left + plotW, top + plotH, AXIS, 2);

  const pts = series.points;
  for (let i = 1; i < pts.length; i++) c.line(X(pts[i - 1].t), Y(pts[i - 1].v), X(pts[i].t), Y(pts[i].v), LINE, 3);
  for (const p of pts) c.dot(Math.round(X(p.t)), Math.round(Y(p.v)), 5, LINE);

  return encodePng(W, H, c.data);
}

/** The shared time axis for all series in one chart, padded so end points are not on the frame. */
export function timeRange(data: ChartData): [number, number] {
  const all = data.series.flatMap((s) => s.points.map((p) => p.t));
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = hi === lo ? (data.mode === 'time' ? 3_600_000 : 86_400_000) : (hi - lo) * 0.05;
  return [lo - pad, hi + pad];
}

export interface ChartImage { label: string; png: Buffer }

/** Every plottable series of a chart as a PNG, with its label for the caption. */
export function chartImages(data: ChartData): ChartImage[] {
  if (!hasChart(data)) return [];
  const range = timeRange(data);
  return data.series.filter((s) => s.points.length >= 2).map((s) => ({ label: s.label, png: renderSeriesPng(s, data.mode, range) }));
}
