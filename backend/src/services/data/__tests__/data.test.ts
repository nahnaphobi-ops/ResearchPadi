import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  chiSquareP, correlation, crossTab, describeColumns, fTestP, formatP, frequencies, groupMeans, percentages, summary, tTestP, type Dataset,
} from '../stats.js';
import { readCsv, readXlsx, toDataset } from '../parse.js';
import { checkReading, describeResult, interpret, INTERPRET_SYSTEM_PROMPT } from '../interpret.service.js';

const close = (actual: number, expected: number, tolerance = 0.002) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} is not close to ${expected}`);

test('p-values match the textbook critical values', () => {
  close(chiSquareP(3.841, 1), 0.05);
  close(chiSquareP(5.991, 2), 0.05);
  close(chiSquareP(0.7937, 1), 0.373);
  close(tTestP(2.228, 10), 0.05);
  close(tTestP(1.96, 10_000), 0.05);
  close(fTestP(4.103, 2, 10), 0.05);
  close(fTestP(13.5, 1, 4), 0.0213);
  assert.equal(formatP(0.0004), 'p < .001');
  assert.equal(formatP(0.0321), 'p = .032');
});

test('percentages are to one decimal place and add up to exactly 100', () => {
  assert.deepEqual(percentages([1, 1, 1]), [33.4, 33.3, 33.3]);
  assert.deepEqual(percentages([60, 90]), [40, 60]);
  assert.equal(percentages([7, 13, 29, 1]).reduce((s, p) => Math.round((s + p) * 10) / 10, 0), 100);
  assert.deepEqual(percentages([0, 0]), [0, 0]);
});

const survey: Dataset = {
  columns: ['Sex', 'Age', 'Mobile money helps me save', 'Weekly savings (GHS)'],
  rows: [
    ['Female', 24, 'Agree', 50],
    ['Male', 31, 'Strongly agree', 80],
    ['female', 28, 'Disagree', 20],
    ['Female', 35, 'Agree', 60],
    ['Male', null, 'Strongly disagree', 10],
    ['Male', 40, 'Agree', 70],
    [null, 22, 'Neutral', 30],
  ],
};

test('frequencies follow the answer scale, keep missing answers apart and use the first spelling', () => {
  const sex = frequencies(survey, 'Sex');
  assert.deepEqual(sex.rows, [{ value: 'Female', count: 3, percent: 50 }, { value: 'Male', count: 3, percent: 50 }]);
  assert.equal(sex.missing, 1);
  const scale = frequencies(survey, 'Mobile money helps me save');
  assert.deepEqual(scale.rows.map((r) => r.value), ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']);
  assert.equal(scale.n, 7);
});

test('a numeric summary gives mean, SD, median and range', () => {
  const age = summary(survey, 'Age');
  assert.equal(age.n, 6);
  assert.equal(age.missing, 1);
  assert.equal(age.mean, 30);
  assert.equal(age.median, 29.5);
  assert.equal(age.min, 22);
  assert.equal(age.max, 40);
  close(age.sd, 6.78, 0.005); // sqrt(230 / 5)
});

test('a 2×2 cross-tabulation gives the right chi-square', () => {
  const rows = [
    ...Array(10).fill(['Urban', 'Yes']), ...Array(20).fill(['Urban', 'No']),
    ...Array(30).fill(['Rural', 'Yes']), ...Array(40).fill(['Rural', 'No']),
  ];
  const t = crossTab({ columns: ['Area', 'Saves'], rows }, 'Area', 'Saves');
  assert.equal(t.n, 100);
  assert.equal(t.chiSquare, 0.79);
  assert.equal(t.df, 1);
  close(t.p, 0.373);
  assert.deepEqual(t.columnValues, ['No', 'Yes']);
  assert.equal(t.lowExpected, 0);
});

test('correlation and one-way ANOVA', () => {
  const r = correlation(survey, 'Age', 'Weekly savings (GHS)');
  assert.equal(r.n, 6);
  assert.ok(r.r > 0.5 && r.r <= 1);
  const g = groupMeans({ columns: ['Group', 'Score'], rows: [['A', 1], ['A', 2], ['A', 3], ['B', 4], ['B', 5], ['B', 6]] }, 'Score', 'Group');
  assert.deepEqual(g.groups.map((x) => [x.group, x.mean]), [['A', 2], ['B', 5]]);
  assert.equal(g.f, 13.5);
  close(g.p, 0.0213);
  assert.throws(() => correlation(survey, 'Sex', 'Age'), /at least three people/);
  assert.throws(() => frequencies(survey, 'Nope'), /no column called/);
});

test('columns are described as numeric or not', () => {
  assert.deepEqual(describeColumns(survey).map((c) => [c.name, c.numeric]), [
    ['Sex', false], ['Age', true], ['Mobile money helps me save', false], ['Weekly savings (GHS)', true],
  ]);
});

test('CSV: quotes, embedded commas and semicolon files', () => {
  const data = toDataset(readCsv(String.fromCharCode(0xfeff) + 'Name,"Comment, if any",Age\r\nAma,"Good, very ""good""",21\r\n\r\nKofi,,30\n'));
  assert.deepEqual(data.columns, ['Name', 'Comment, if any', 'Age']);
  assert.deepEqual(data.rows, [['Ama', 'Good, very "good"', '21'], ['Kofi', null, '30']]);
  assert.deepEqual(toDataset(readCsv('A;B\n1;2\n')).columns, ['A', 'B']);
  assert.throws(() => toDataset(readCsv('Only a header\n')), /at least one row of answers/);
});

test('Excel: shared strings, numbers and gaps on the first sheet', async () => {
  const zip = new JSZip();
  zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="Responses" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/sharedStrings.xml', '<sst><si><t>Sex</t></si><si><t>Age</t></si><si><r><t>Fe</t></r><r><t>male</t></r></si></sst>');
  zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>24</v></c></row><row r="3"><c r="B3"><v>31</v></c></row></sheetData></worksheet>');
  const data = toDataset(await readXlsx(await zip.generateAsync({ type: 'nodebuffer' })));
  assert.deepEqual(data, { columns: ['Sex', 'Age'], rows: [['Female', 24], [null, 31]] });
});

test('a reading may only use the numbers in the result', async () => {
  const sex = frequencies(survey, 'Sex');
  const facts = describeResult(sex);
  assert.match(facts, /Female: 3 \(50%\)/);
  assert.equal(checkReading('Table 4.1 shows that 3 respondents (50%) were female.', facts, 'Table 4.1'), 'Table 4.1 shows that 3 respondents (50%) were female.');
  assert.equal(checkReading('About 75% were female.', facts, 'Table 4.1'), null);
  assert.equal(checkReading('   ', facts, ''), null);
  assert.match(INTERPRET_SYSTEM_PROMPT, /using only the numbers given, written exactly as given/);
  assert.match(INTERPRET_SYSTEM_PROMPT, /never claim a cause/);

  let tier = '';
  const text = await interpret(sex, 'Table 4.1', 'u1', async (req) => {
    tier = req.tier;
    return { text: 'Table 4.1 shows that the respondents were evenly split, 3 (50%) female and 3 (50%) male.', model: 'm', provider: 'anthropic', inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0, cached: false, latencyMs: 1, attempts: 1, truncated: false };
  });
  assert.equal(tier, 'light');
  assert.match(text ?? '', /evenly split/);
});
