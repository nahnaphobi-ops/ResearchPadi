import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, inflateSync } from 'zlib';
import JSZip from 'jszip';
import { getTemplate, type SectionEntries } from '../template.service.js';
import { chartData, chartImages, hasChart, parseNaiveTime } from '../chart.service.js';
import { ruleChecks } from '../checks.js';
import { buildCareStudyDocx, buildCleanCareStudyDocx, widestTable } from '../export.service.js';
import type { CareSource } from '../guards.js';

const midwifery = getTemplate('midwifery-family-centred')!;
const labour = midwifery.sections.find((s) => s.key === 'labour')!;
const partograph = labour.charts![0];

const readings: SectionEntries = {
  fields: { admission: 'Admitted 09/11/21 at 06:00' },
  items: [
    { time: '2021-11-09T10:00', dilatation_cm: '6', fhr: '142', contractions: '3' },
    { time: '2021-11-09T06:00', dilatation_cm: '4', fhr: '136', contractions: '2' },
    { time: '2021-11-09T08:00', dilatation_cm: '5', fhr: '140', contractions: '3' },
    { time: '', dilatation_cm: '9' },
  ],
};

const sources: CareSource[] = [{ id: 'S1', title: 'Antenatal care in Ghana', authors: 'Mensah, Kofi', surnames: ['Mensah'], year: 2020 }];
const study = {
  id: 's1', pseudonym: 'Madam A.K.', focus: 'G3P2', institution_name: 'Holy Family NMTC', supervisor_name: 'Ms. B',
  consent_confirmed_at: '2026-10-14T10:00:00Z', declaration_confirmed_at: '2026-10-14T10:00:00Z', sources,
};

const carePlan = [
  'MANAGEMENT OF LABOUR',
  '| DATE/TIME | NURSING DIAGNOSIS | OBJECTIVES | ORDERS | INTERVENTIONS | DATE/TIME | EVALUATION | SIGN |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  '| 09/11/21 | Labour pain | Relieved in 2 hours | 1. Reassure | 1. Client was reassured | 09/11/21 | Goal fully met | [Student to supply: initials] |',
].join('\n');

const sections = {
  introduction: { entries: { fields: { where_met: 'ANC clinic' } }, draft: 'INTRODUCTION\nThe client was met at the antenatal clinic (Mensah, 2020).' },
  labour: { entries: readings, draft: 'The first stage was monitored on the partograph.' },
  labour_care_plan: { entries: { items: [{ problem: 'pain' }] }, draft: carePlan },
};

const xml = async (buffer: Buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  return { zip, document: await zip.file('word/document.xml')!.async('string') };
};

test('chart data is sorted by time, skips readings without a time, and widens the axis to fit the data', () => {
  const data = chartData(partograph, readings);
  const dilatation = data.series.find((s) => s.field === 'dilatation_cm')!;
  assert.deepEqual(dilatation.points.map((p) => p.v), [4, 5, 6]);
  assert.equal(data.skipped, 1);
  assert.equal(data.mode, 'time');
  assert.ok(hasChart(data));
  // Series with no readings are left out.
  assert.deepEqual(data.series.map((s) => s.field).sort(), ['contractions', 'dilatation_cm', 'fhr']);

  const high = chartData(partograph, { items: [{ time: '2021-11-09T06:00', fhr: '210' }, { time: '2021-11-09T07:00', fhr: '90' }] });
  const fhr = high.series[0];
  assert.ok(fhr.max >= 210 && fhr.min <= 90, 'every point must sit inside the axis');
});

test('date-only readings are plotted by date, and a single reading is not charted', () => {
  assert.equal(parseNaiveTime('2021-11-09'), Date.UTC(2021, 10, 9));
  assert.equal(parseNaiveTime('09/11/2021'), null);
  assert.equal(parseNaiveTime('2021-11-09T06:30'), Date.UTC(2021, 10, 9, 6, 30));

  const antenatal = midwifery.sections.find((s) => s.key === 'antenatal_visits')!.charts![0];
  const data = chartData(antenatal, { items: [{ date: '2021-10-28', weight_kg: '65' }, { date: '2021-11-04', weight_kg: '66' }] });
  assert.equal(data.mode, 'date');
  assert.ok(hasChart(data));
  assert.equal(hasChart(chartData(antenatal, { items: [{ date: '2021-10-28', weight_kg: '65' }] })), false);
  assert.deepEqual(chartImages(chartData(antenatal, { items: [] })), []);
});

test('the chart image is a valid PNG with the plotted line in it', () => {
  const [image] = chartImages(chartData(partograph, readings));
  const png = image.png;
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const idat: Buffer[] = [];
  let offset = 8;
  let width = 0;
  let height = 0;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    assert.equal(png.readUInt32BE(offset + 8 + length), crc32(png.subarray(offset + 4, offset + 8 + length)) >>> 0, `CRC of ${type}`);
    if (type === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  assert.equal(offset, png.length);
  const raw = inflateSync(Buffer.concat(idat));
  assert.equal(raw.length, (width * 4 + 1) * height);

  // Somewhere in the image is the blue data line; the rest is white and grey.
  let blue = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * (width * 4 + 1) + 1 + x * 4;
      if (raw[i] === 31 && raw[i + 1] === 75 && raw[i + 2] === 216) blue++;
    }
  }
  assert.ok(blue > 200, `blue pixels: ${blue}`);
});

test('"Check my work" flags readings outside the template ranges and times out of order', () => {
  const issues = ruleChecks(midwifery, {
    labour: { entries: { items: [
      { time: '2021-11-09T10:00', dilatation_cm: '12', fhr: '140' },
      { time: '2021-11-09T06:00', dilatation_cm: '4', fhr: '30' },
    ] } },
  }, 3);
  const text = issues.filter((i) => i.section === 'labour' && i.kind === 'value').map((i) => i.message).join('\n');
  assert.match(text, /Cervical dilatation \(cm\): 12 looks unusual/);
  assert.match(text, /Fetal heart rate: 30 looks unusual/);
  assert.match(text, /not in order/);
  assert.match(text, /supervisor/);
});

test('the clean copy is the draft only: no notes column, real tables, a landscape care plan, highlighted gaps, and the chart', async () => {
  assert.equal(widestTable(carePlan), 8);

  const { zip, document } = await xml(await buildCleanCareStudyDocx(study, midwifery, sections));
  assert.doesNotMatch(document, /Student&apos;s own notes|Student's own notes|Polished draft/);
  assert.match(document, /MIDWIFERY|CLIENT\/FAMILY CENTRED MATERNITY CARE STUDY/i);
  assert.match(document, /The client was met at the antenatal clinic/);

  // The part heading is printed once even though the draft repeats it.
  assert.equal((document.match(/>INTRODUCTION</g) ?? []).length, 1);

  // The 8-column care plan is a Word table on a landscape page.
  assert.match(document, /<w:tbl>/);
  assert.match(document, /NURSING DIAGNOSIS/);
  assert.match(document, /w:orient="landscape"/);

  // Missing items stay highlighted, including sections never drafted.
  assert.match(document, /w:highlight w:val="yellow"/);
  assert.match(document, /has not been drafted yet/);

  // The partograph is drawn into the document.
  const images = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
  assert.ok(images.length >= 3, `images: ${images.join(', ')}`);

  // Bibliography from retrieved sources only.
  assert.match(document, /BIBLIOGRAPHY/);
  assert.match(document, /Mensah, K\./);
});

test('the supervisor copy keeps the notes beside the draft and also carries the chart', async () => {
  const { zip, document } = await xml(await buildCareStudyDocx(study, midwifery, sections));
  assert.match(document, /Student&apos;s own notes|Student's own notes/);
  assert.match(document, /Polished draft/);
  assert.ok(Object.keys(zip.files).some((f) => f.startsWith('word/media/')));
});

test('the clean copy has a contents page built from the headings, with numbered headings in Word heading styles', async () => {
  const withHeadings = {
    ...sections,
    client_particulars: { entries: { fields: { age: '30' } }, draft: '1.0 INTRODUCTION\nThis chapter covers the history.\n1.1 SOCIAL HISTORY\nShe is a farmer.' },
  };
  const { zip, document } = await xml(await buildCleanCareStudyDocx(study, midwifery, withHeadings));
  assert.match(document, /TABLE OF CONTENTS/);
  assert.match(document, /TOC \h \o &quot;1-2&quot;|TOC \o &quot;1-2&quot; \h|TOC [^<]*1-2/);
  assert.match(document, /w:pStyle w:val="Heading2"/);
  const settings = await zip.file('word/settings.xml')!.async('string');
  assert.match(settings, /w:updateFields/);
});
