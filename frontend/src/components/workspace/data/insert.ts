import type { Editor } from '@tiptap/react';
import { formatP, type Analysis } from '../../../services/dataService';
import type { BarChart } from './charts';

/**
 * A result as it goes into Chapter 4: an APA 7 table (bold "Table 4.1", the
 * title in italics, a note underneath), an optional figure, numbered after
 * the tables and figures already in the chapter.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fixed = (v: number, places: number) => v.toFixed(places);
/** APA drops the leading zero for values that can't exceed 1 (r, Cramér's V). */
const noLeadingZero = (v: number) => fixed(v, 2).replace(/^(-?)0\./, '$1.');
const pValue = (p: number) => formatP(p).replace(/^p = /, '').replace(/^p /, '');

export interface TableSpec {
  title: string;
  header: string[];
  rows: (string | number)[][];
  note?: string;
}

export function tableFor(result: Analysis): TableSpec {
  switch (result.kind) {
    case 'frequencies':
      return {
        title: `Distribution of responses: ${result.column}`,
        header: ['Response', 'Frequency (n)', 'Percentage (%)'],
        rows: [...result.rows.map((r) => [r.value, r.count, fixed(r.percent, 1)]), ['Total', result.n, '100.0']],
        note: result.missing ? `${result.missing} respondent${result.missing === 1 ? '' : 's'} did not answer this question.` : undefined,
      };
    case 'summary':
      return {
        title: `Descriptive statistics: ${result.column}`,
        header: ['N', 'Mean', 'SD', 'Median', 'Minimum', 'Maximum'],
        rows: [[result.n, fixed(result.mean, 2), fixed(result.sd, 2), result.median, result.min, result.max]],
      };
    case 'crosstab': {
      const rowTotals = result.counts.map((r) => r.reduce((s, x) => s + x, 0));
      const colTotals = result.columnValues.map((_, j) => result.counts.reduce((s, r) => s + r[j], 0));
      return {
        title: `${result.row} by ${result.column}`,
        header: [result.row, ...result.columnValues, 'Total'],
        rows: [
          ...result.rowValues.map((rv, i) => [rv, ...result.counts[i], rowTotals[i]]),
          ['Total', ...colTotals, result.n],
        ],
        note: [
          `χ²(${result.df}, N = ${result.n}) = ${fixed(result.chiSquare, 2)}, ${formatP(result.p)}, Cramér's V = ${noLeadingZero(result.cramersV)}.`,
          result.lowExpected > 20 ? `${fixed(result.lowExpected, 1)}% of cells had expected counts below 5, so read the chi-square result with caution.` : '',
        ].filter(Boolean).join(' '),
      };
    }
    case 'correlation':
      return {
        title: `Correlation between ${result.a} and ${result.b}`,
        header: ['Variables', 'n', 'r', 'p'],
        rows: [[`${result.a} and ${result.b}`, result.n, noLeadingZero(result.r), pValue(result.p)]],
        note: 'Pearson correlation, two-tailed.',
      };
    case 'group-means':
      return {
        title: `${result.value} by ${result.group}`,
        header: [result.group, 'n', 'Mean', 'SD'],
        rows: result.groups.map((g) => [g.group, g.n, fixed(g.mean, 2), fixed(g.sd, 2)]),
        note: `One-way ANOVA: F(${result.df1}, ${result.df2}) = ${fixed(result.f, 2)}, ${formatP(result.p)}.`,
      };
  }
}

/** A bar chart for results that have one. */
export function chartFor(result: Analysis): { title: string; chart: BarChart } | null {
  switch (result.kind) {
    case 'frequencies':
      return {
        title: `Responses: ${result.column}`,
        chart: { categories: result.rows.map((r) => r.value), series: [{ name: result.column, values: result.rows.map((r) => r.percent) }], yLabel: 'Percentage (%)', percent: true },
      };
    case 'crosstab':
      return {
        title: `${result.row} by ${result.column}`,
        chart: {
          categories: result.rowValues,
          series: result.columnValues.map((cv, j) => ({ name: cv, values: result.counts.map((r) => r[j]) })),
          yLabel: 'Number of respondents',
        },
      };
    case 'group-means':
      return {
        title: `Mean ${result.value} by ${result.group}`,
        chart: { categories: result.groups.map((g) => g.group), series: [{ name: result.value, values: result.groups.map((g) => g.mean) }], yLabel: `Mean ${result.value}` },
      };
    default:
      return null;
  }
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

/** "Table 4.3" and "Figure 4.2": the chapter the cursor is in, after the ones already there. */
export function nextLabels(editor: Editor): { table: string; figure: string } {
  const { doc, selection } = editor.state;
  let chapter: number | null = null;
  doc.nodesBetween(0, selection.from, (node) => {
    if (node.type.name !== 'heading') return true;
    const m = node.textContent.match(/chapter\s+(\d+|one|two|three|four|five|six|seven|eight)\b/i);
    if (m) chapter = /^\d+$/.test(m[1]) ? Number(m[1]) : WORD_NUMBERS[m[1].toLowerCase()];
    return false;
  });
  const text = doc.textBetween(0, doc.content.size, '\n', ' ');
  const next = (kind: 'Table' | 'Figure') => {
    const prefix = chapter ? `${kind} ${chapter}.` : `${kind} `;
    const pattern = new RegExp(`^${prefix.replace('.', '\\.')}(\\d+)\\b`, 'gm');
    const used = [...text.matchAll(pattern)].map((m) => Number(m[1]));
    return `${prefix}${used.length ? Math.max(...used) + 1 : 1}`;
  };
  return { table: next('Table'), figure: next('Figure') };
}

export function resultHtml(opts: { table: TableSpec; tableLabel: string; figure?: { label: string; title: string; png: string }; reading?: string | null }): string {
  const { table } = opts;
  const parts = [
    `<p><strong>${esc(opts.tableLabel)}</strong></p>`,
    `<p><em>${esc(table.title)}</em></p>`,
    '<table><tbody>',
    `<tr>${table.header.map((h) => `<th>${esc(String(h))}</th>`).join('')}</tr>`,
    ...table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(String(c))}</td>`).join('')}</tr>`),
    '</tbody></table>',
  ];
  if (table.note) parts.push(`<p><em>Note.</em> ${esc(table.note)}</p>`);
  if (opts.figure) {
    parts.push(`<p><strong>${esc(opts.figure.label)}</strong></p>`, `<p><em>${esc(opts.figure.title)}</em></p>`, `<img src="${opts.figure.png}" alt="${esc(opts.figure.title)}">`);
  }
  if (opts.reading) parts.push(`<p>${esc(opts.reading)}</p>`);
  return parts.join('');
}
