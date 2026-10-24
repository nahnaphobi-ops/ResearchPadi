import api from './api';

/** Chapter 4 data analysis. The numbers are computed on the server in code; only `reading` uses AI. */
export type Cell = string | number | null;
export interface Dataset { columns: string[]; rows: Cell[][] }
export interface ColumnInfo { name: string; numeric: boolean; distinct: number; answered: number }

export type AnalysisKind = 'frequencies' | 'summary' | 'crosstab' | 'correlation' | 'group-means';

export interface Frequencies { kind: 'frequencies'; column: string; n: number; missing: number; rows: { value: string; count: number; percent: number }[] }
export interface Summary { kind: 'summary'; column: string; n: number; missing: number; mean: number; sd: number; median: number; min: number; max: number }
export interface CrossTab {
  kind: 'crosstab'; row: string; column: string; rowValues: string[]; columnValues: string[]; counts: number[][];
  n: number; chiSquare: number; df: number; p: number; cramersV: number; lowExpected: number;
}
export interface Correlation { kind: 'correlation'; a: string; b: string; n: number; r: number; p: number }
export interface GroupMeans {
  kind: 'group-means'; value: string; group: string; groups: { group: string; n: number; mean: number; sd: number }[];
  f: number; df1: number; df2: number; p: number;
}
export type Analysis = Frequencies | Summary | CrossTab | Correlation | GroupMeans;

export interface AnalysisRequest { data: Dataset; kind: AnalysisKind; a: string; b?: string }

export const dataService = {
  parse: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ data: Dataset; columns: ColumnInfo[] }>('/workspace/data/parse', form);
  },
  analyse: (body: AnalysisRequest) => api.post<{ result: Analysis }>('/workspace/data/analyse', body),
  reading: (body: AnalysisRequest & { tableLabel: string }) =>
    api.post<{ reading: string | null; message?: string }>('/workspace/data/reading', body),
};

/** "p = .032" or "p < .001", as APA writes it. */
export function formatP(p: number): string {
  if (p < 0.001) return 'p < .001';
  return `p = ${p.toFixed(3).replace(/^0/, '')}`;
}
