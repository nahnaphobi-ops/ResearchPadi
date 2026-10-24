/**
 * Bar charts for Chapter 4, drawn as SVG from the computed numbers and turned
 * into a PNG for the document (Word can't show SVG). Plain and readable when
 * printed in black and white: labelled values, light gridlines, no 3D.
 */
export interface BarChart {
  categories: string[];
  series: { name: string; values: number[] }[];
  yLabel: string;
  /** Values are percentages: the axis runs to 100 at most and labels end in %. */
  percent?: boolean;
}

export const CHART_WIDTH = 640;
export const CHART_HEIGHT = 380;
const COLORS = ['#2b579a', '#d97706', '#15803d', '#7c3aed', '#b91c1c', '#0e7490', '#4b5563', '#be185d'];
const FONT = 'Arial, Helvetica, sans-serif';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function niceMax(max: number, percent: boolean): number {
  if (percent) return Math.min(100, Math.ceil(max / 10) * 10 || 10);
  if (max <= 0) return 1;
  // Five gridlines at a round step (1, 2, 2.5, 5 or 10 × a power of ten): 13 → 25, 47 → 50.
  const pow = 10 ** Math.floor(Math.log10(max / 5));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow * 5 >= max) ?? 10;
  return step * pow * 5;
}

export function barChartSvg(chart: BarChart): string {
  const { categories, series, percent = false } = chart;
  const legend = series.length > 1;
  const left = 56;
  const right = legend ? 150 : 16;
  const top = 20;
  const rotate = categories.length > 5 || categories.some((c) => c.length > 12);
  const bottom = rotate ? 96 : 52;
  const w = CHART_WIDTH - left - right;
  const h = CHART_HEIGHT - top - bottom;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)), percent);
  const y = (v: number) => top + h - (v / max) * h;
  const groupWidth = w / Math.max(1, categories.length);
  const barWidth = Math.min(48, (groupWidth * 0.75) / series.length);
  const fmt = (v: number) => (percent ? `${v}%` : Number.isInteger(v) ? String(v) : v.toFixed(2));

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" font-family="${FONT}">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
  ];
  for (let i = 0; i <= 5; i++) {
    const v = (max / 5) * i;
    parts.push(`<line x1="${left}" x2="${left + w}" y1="${y(v)}" y2="${y(v)}" stroke="${i ? '#e5e7eb' : '#374151'}" stroke-width="1"/>`);
    parts.push(`<text x="${left - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#374151">${esc(fmt(Math.round(v * 100) / 100))}</text>`);
  }
  parts.push(`<text transform="translate(14 ${top + h / 2}) rotate(-90)" font-size="12" text-anchor="middle" fill="#111827">${esc(chart.yLabel)}</text>`);

  categories.forEach((cat, ci) => {
    const gx = left + ci * groupWidth + (groupWidth - barWidth * series.length) / 2;
    series.forEach((s, si) => {
      const v = s.values[ci] ?? 0;
      const x = gx + si * barWidth;
      parts.push(`<rect x="${x + 1}" y="${y(v)}" width="${barWidth - 2}" height="${top + h - y(v)}" fill="${COLORS[si % COLORS.length]}"/>`);
      if (barWidth >= 18) parts.push(`<text x="${x + barWidth / 2}" y="${y(v) - 4}" font-size="10" text-anchor="middle" fill="#111827">${esc(fmt(v))}</text>`);
    });
    const cx = left + ci * groupWidth + groupWidth / 2;
    const label = esc(short(cat, rotate ? 22 : 16));
    parts.push(rotate
      ? `<text transform="translate(${cx} ${top + h + 12}) rotate(-35)" font-size="11" text-anchor="end" fill="#111827">${label}</text>`
      : `<text x="${cx}" y="${top + h + 18}" font-size="11" text-anchor="middle" fill="#111827">${label}</text>`);
  });

  if (legend) {
    series.forEach((s, i) => {
      const ly = top + 8 + i * 20;
      parts.push(`<rect x="${CHART_WIDTH - right + 14}" y="${ly}" width="12" height="12" fill="${COLORS[i % COLORS.length]}"/>`);
      parts.push(`<text x="${CHART_WIDTH - right + 32}" y="${ly + 10}" font-size="11" fill="#111827">${esc(short(s.name, 18))}</text>`);
    });
  }
  parts.push('</svg>');
  return parts.join('');
}

/** The SVG as a PNG data URL (at twice the size, so it prints sharply). */
export function svgToPng(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = CHART_WIDTH * 2;
      canvas.height = CHART_HEIGHT * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas is not available'));
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Could not draw the chart'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
