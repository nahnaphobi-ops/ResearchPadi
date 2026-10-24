import { aiCall, type GatewayRequest, type GatewayResponse } from '../ai/gateway.service.js';
import { formatP, type Analysis } from './stats.js';

/**
 * A short reading of one result, in the student's Chapter 4 voice. The model
 * gets the numbers as computed and may use no others: any figure in its reply
 * that isn't in the result throws the reading away.
 */
export const INTERPRET_SYSTEM_PROMPT = `You write the short paragraph that follows a table in Chapter 4 (Results) of a Ghanaian student's research project.
- Two to four sentences, past tense, third person ("The results showed…"), UK English. No headings or lists.
- Report what the numbers show, using only the numbers given, written exactly as given. Never add, round differently, or work out any other number.
- Say what a test result means in plain words (for example, whether the difference or relationship was statistically significant at the .05 level) but never claim a cause, and never go beyond what the numbers show.
- Do not discuss literature, reasons or recommendations; the student will add those.`;

/** The result as plain lines: what the model may say, and the only numbers it may use. */
export function describeResult(result: Analysis): string {
  switch (result.kind) {
    case 'frequencies':
      return [
        `Question: ${result.column}`,
        `Respondents who answered: ${result.n}${result.missing ? ` (${result.missing} did not answer)` : ''}`,
        ...result.rows.map((r) => `${r.value}: ${r.count} (${r.percent}%)`),
      ].join('\n');
    case 'summary':
      return [
        `Question: ${result.column}`,
        `Respondents: ${result.n}`,
        `Mean: ${result.mean}, standard deviation: ${result.sd}, median: ${result.median}, lowest: ${result.min}, highest: ${result.max}`,
      ].join('\n');
    case 'crosstab':
      return [
        `Cross-tabulation of "${result.row}" (rows) by "${result.column}" (columns), ${result.n} respondents`,
        ...result.rowValues.map((rv, i) => `${rv}: ${result.columnValues.map((cv, j) => `${cv} ${result.counts[i][j]}`).join(', ')}`),
        `Chi-square test: χ²(${result.df}) = ${result.chiSquare}, ${formatP(result.p)}, Cramér's V = ${result.cramersV}`,
        result.lowExpected > 20 ? `Note: ${result.lowExpected}% of cells had expected counts below 5, so the chi-square result should be read with caution.` : '',
      ].filter(Boolean).join('\n');
    case 'correlation':
      return `Pearson correlation between "${result.a}" and "${result.b}": r = ${result.r}, n = ${result.n}, ${formatP(result.p)}`;
    case 'group-means':
      return [
        `"${result.value}" by "${result.group}"`,
        ...result.groups.map((g) => `${g.group}: n = ${g.n}, mean = ${g.mean}, SD = ${g.sd}`),
        `One-way ANOVA: F(${result.df1}, ${result.df2}) = ${result.f}, ${formatP(result.p)}`,
      ].join('\n');
  }
}

// Numbers as values: "40" matches "40.0", ".032" matches "0.032", "1,200" matches "1200".
const NUMBER = /\d[\d,]*(?:\.\d+)?|\.\d+/g;
const values = (s: string) => (s.match(NUMBER) ?? []).map((n) => Number(n.replace(/,/g, ''))).filter(Number.isFinite);

/** The reading, or null when it used a number that isn't in the result. */
export function checkReading(text: string, facts: string, tableLabel: string): string | null {
  const reading = text.replace(/\s+/g, ' ').trim();
  if (!reading) return null;
  // The .05 significance level and the table's own number are fine to mention.
  const allowed = new Set([...values(facts), ...values(tableLabel), 0.05]);
  return values(reading).every((v) => allowed.has(v)) ? reading : null;
}

export async function interpret(
  result: Analysis,
  tableLabel: string,
  userId: string,
  call: (req: GatewayRequest) => Promise<GatewayResponse> = aiCall,
): Promise<string | null> {
  const facts = describeResult(result);
  const res = await call({
    tier: 'light',
    prompt: `${tableLabel ? `This is ${tableLabel}.\n` : ''}RESULT:\n${facts}`,
    systemPrompt: INTERPRET_SYSTEM_PROMPT,
    cachePrompt: true,
    maxTokens: 300,
    userId,
    meta: { action: 'data-interpret', kind: result.kind },
  });
  return checkReading(res.text, facts, tableLabel);
}
