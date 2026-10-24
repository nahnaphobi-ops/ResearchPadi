import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { childLogger } from '../lib/logger.js';
import { MAX_COLUMNS, MAX_ROWS, readDataset } from '../services/data/parse.js';
import {
  StatsError, correlation, crossTab, describeColumns, frequencies, groupMeans, summary, type Analysis, type Cell, type Dataset,
} from '../services/data/stats.js';
import { interpret } from '../services/data/interpret.service.js';

/**
 * Chapter 4 data analysis: read a questionnaire spreadsheet, compute the
 * tables and tests in code, and (on request) a short reading of a result that
 * may only use its numbers. The browser keeps the data and sends it with each
 * analysis, so nothing about the respondents is stored.
 */
const log = childLogger('data');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');

export function dataUpload(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    const tooBig = (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
    res.status(400).json({ error: tooBig ? 'Spreadsheets can be up to 5 MB.' : 'Could not read the upload.' });
  });
}

function fail(res: Response, err: unknown, fallback: string) {
  if (err instanceof StatsError) return res.status(400).json({ error: err.message });
  log.warn({ err: (err as Error)?.message }, fallback);
  return res.status(500).json({ error: fallback });
}

export const parse = async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an Excel or CSV file.' });
  try {
    const data = await readDataset(req.file);
    res.json({ data, columns: describeColumns(data) });
  } catch (err) {
    fail(res, err, 'Could not read that spreadsheet.');
  }
};

/** The dataset as sent back by the browser, checked and trimmed to the limits. */
function datasetOf(raw: any): Dataset {
  if (!raw || !Array.isArray(raw.columns) || !Array.isArray(raw.rows)) throw new StatsError('Upload your data first.');
  const columns = raw.columns.slice(0, MAX_COLUMNS).map((c: unknown) => String(c ?? '').slice(0, 200));
  const cell = (v: unknown): Cell => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' ? v.slice(0, 300) : null);
  const rows = raw.rows.slice(0, MAX_ROWS).map((r: unknown) => (Array.isArray(r) ? r.slice(0, columns.length).map(cell) : []));
  return { columns, rows };
}

const KINDS = ['frequencies', 'summary', 'crosstab', 'correlation', 'group-means'] as const;

function run(body: any): Analysis {
  const data = datasetOf(body?.data);
  const a = typeof body?.a === 'string' ? body.a : '';
  const b = typeof body?.b === 'string' ? body.b : '';
  switch (body?.kind as (typeof KINDS)[number]) {
    case 'frequencies': return frequencies(data, a);
    case 'summary': return summary(data, a);
    case 'crosstab': return crossTab(data, a, b);
    case 'correlation': return correlation(data, a, b);
    case 'group-means': return groupMeans(data, a, b);
    default: throw new StatsError('Choose what to analyse.');
  }
}

export const analyse = (req: Request, res: Response) => {
  try {
    res.json({ result: run(req.body) });
  } catch (err) {
    fail(res, err, 'Could not analyse that.');
  }
};

export const reading = async (req: Request, res: Response) => {
  let result: Analysis;
  try {
    // Recomputed here, so the reading can only use numbers that really came from the data.
    result = run(req.body);
  } catch (err) {
    return fail(res, err, 'Could not analyse that.');
  }
  const tableLabel = typeof req.body?.tableLabel === 'string' ? req.body.tableLabel.slice(0, 40) : '';
  try {
    const text = await interpret(result, tableLabel, (req as any).user?.id);
    res.json(text
      ? { reading: text }
      : { reading: null, message: "The AI's reading used a number that isn't in your results, so it was left out. Describe the table in your own words." });
  } catch (err: any) {
    if (err.status === 429) return res.status(429).json({ error: err.message });
    log.warn({ err: err.message }, 'Reading failed');
    res.status(502).json({ error: 'Could not write a reading right now. Please try again.' });
  }
};
