import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCareStudyBrief, parseCaseValues, buildCaseRecord, eddFromLmp, gestation, formatDate, findDates,
  checkAgainstRecord, formatCaseRecord, recordDates, type CareStudyBrief,
} from '../care-study.service.js';

const brief: CareStudyBrief = { caseFocus: 'Primigravida with anaemia in pregnancy', parity: 'primigravida', gestationAtFirstContact: 16, deliveryMode: 'spontaneous vaginal delivery', region: 'Bono' };
const TODAY = new Date(Date.UTC(2026, 9, 17)); // 17 October 2026

const modelValues = JSON.stringify({
  client: { name: 'Akua Mensah', age: 23, occupation: 'Seamstress', religion: 'Christian', maritalStatus: 'Married', education: 'JHS', ethnicity: 'Bono', residence: 'Berekum' },
  partner: { name: 'Kofi Mensah', age: 29, occupation: 'Farmer' },
  family: 'She lives with her husband.', medicalHistory: 'No chronic illness.', pastObstetric: 'ignored for primigravida',
  gravida: 3, para: 2, abortions: 0, livingChildren: 2,
  bloodGroup: 'O', rhesus: 'positive', hbBooking: 8.9, hbLater: 10.6,
  booking: { systolic: 110, diastolic: 70, pulse: 88, temp: 36.7, resp: 18, weightKg: 58 },
  visits: [{ systolic: 110, diastolic: 70, weightKg: 60, fhr: 144 }, { systolic: 112, diastolic: 72, weightKg: 62, fhr: 140 }, { systolic: 115, diastolic: 75, weightKg: 64, fhr: 138 }],
  labour: { cervixOnAdmissionCm: 5, membranes: 'intact', firstStageHours: 7.5, secondStageMinutes: 30, thirdStageMinutes: 8, bloodLossMl: 300, perineum: 'intact' },
  baby: { sex: 'female', weightKg: 3.05, apgar1: 7, apgar5: 9 },
  postnatal: [{ systolic: 108, diastolic: 68, pulse: 84, temp: 36.8, resp: 18 }, { systolic: 110, diastolic: 70, pulse: 80, temp: 36.6, resp: 18 }],
  problems: { antenatal: ['Fatigue related to anaemia'], labour: ['Pain'], postnatal: ['Risk of infection'] },
});

test('order form details are validated', () => {
  assert.ok('brief' in parseCareStudyBrief({ caseFocus: 'Primigravida with anaemia', gestationAtFirstContact: 16, region: 'bono' }));
  assert.ok('error' in parseCareStudyBrief({ caseFocus: 'x', gestationAtFirstContact: 16, region: 'Bono' }));
  assert.ok('error' in parseCareStudyBrief({ caseFocus: 'Primigravida with anaemia', gestationAtFirstContact: 34, region: 'Bono' }));
  assert.ok('error' in parseCareStudyBrief({ caseFocus: 'Primigravida with anaemia', gestationAtFirstContact: 16, region: 'Lagos' }));
});

test("Naegele's rule and gestational age", () => {
  const lmp = new Date(Date.UTC(2026, 0, 1));
  assert.equal(formatDate(eddFromLmp(lmp)), '8 October 2026');
  assert.equal(gestation(lmp, new Date(Date.UTC(2026, 0, 1) + 262 * 86_400_000)).label, '37 weeks 3 days');
  assert.equal(gestation(lmp, new Date(Date.UTC(2026, 0, 29))).label, '4 weeks');
});

test('a primigravida is always G1P0, and readings stay believable', () => {
  const v = parseCaseValues(modelValues, brief)!;
  assert.deepEqual([v.gravida, v.para, v.abortions, v.livingChildren], [1, 0, 0, 0]);
  const wild = parseCaseValues(JSON.stringify({ ...JSON.parse(modelValues), booking: { systolic: 300, diastolic: 290, pulse: 5, temp: 50, resp: 1, weightKg: 5 }, baby: { apgar1: 9, apgar5: 4, weightKg: 9 } }), brief)!;
  assert.ok(wild.booking.systolic <= 200 && wild.booking.diastolic < wild.booking.systolic);
  assert.ok(wild.booking.temp <= 40.5 && wild.booking.pulse >= 50 && wild.booking.weightKg >= 40);
  assert.ok(wild.baby.apgar5 >= wild.baby.apgar1);
  assert.ok(wild.baby.weightKg <= 4.8);
});

test('a multigravida has consistent gravidity and parity', () => {
  const v = parseCaseValues(JSON.stringify({ ...JSON.parse(modelValues), gravida: 3, para: 5, abortions: 0, livingChildren: 9 }), { ...brief, parity: 'multigravida' })!;
  assert.ok(v.para <= v.gravida - 1 - v.abortions);
  assert.ok(v.livingChildren <= v.para);
});

test('values without a full client name are rejected', () => {
  assert.equal(parseCaseValues(JSON.stringify({ ...JSON.parse(modelValues), client: { name: 'Akua' } }), brief), null);
  assert.equal(parseCaseValues('no json', brief), null);
});

test('the timeline is in order and follows from the LMP', () => {
  const r = buildCaseRecord(brief, parseCaseValues(modelValues, brief)!, TODAY);
  assert.equal(r.edd.getTime(), eddFromLmp(r.lmp).getTime());
  assert.equal(gestation(r.lmp, r.firstContact).label, '16 weeks');
  assert.equal(r.deliveryGestation, '39 weeks 3 days');
  assert.equal(r.visits.length, 3);
  const order = [r.firstContact, r.homeVisit, ...r.visits.map((v) => v.date), r.delivery, ...r.postnatalDays.map((p) => p.date), r.discharge, ...r.postnatalVisits.map((p) => p.date)];
  for (let i = 1; i < order.length; i++) assert.ok(order[i].getTime() >= order[i - 1].getTime(), `event ${i} out of order`);
  assert.ok(r.postnatalVisits[1].date.getTime() < TODAY.getTime(), 'six-week visit is in the past');
  assert.equal(r.postnatalDays[0].lochia, 'lochia rubra');
  assert.equal(r.postnatalVisits[0].lochia, 'lochia serosa');
  assert.equal(r.postnatalVisits[1].fundus, 'no longer palpable abdominally');
});

test('preterm and caesarean cases deliver at the right gestation, with visits still before delivery', () => {
  const values = parseCaseValues(modelValues, brief)!;
  const preterm = buildCaseRecord({ ...brief, caseFocus: 'Preterm labour at 35 weeks', gestationAtFirstContact: 30 }, values, TODAY);
  assert.equal(preterm.deliveryGestation, '35 weeks 2 days');
  assert.ok(preterm.visits.every((v) => v.date < preterm.delivery && v.date > preterm.homeVisit));
  const cs = buildCaseRecord({ ...brief, deliveryMode: 'caesarean section' }, values, TODAY);
  assert.equal(cs.deliveryGestation, '38 weeks 5 days');
  assert.equal(Math.round((cs.discharge.getTime() - cs.postnatalDays[0].date.getTime()) / 86_400_000), 2);
});

test('finds dates in the common written formats', () => {
  const found = findDates('Seen on 3rd March, 2026, then March 10, 2026 and 17/03/2026.').map((d) => d.iso);
  assert.deepEqual(found.sort(), ['2026-03-03', '2026-03-10', '2026-03-17']);
});

test('a chapter that follows the record passes the check', () => {
  const r = buildCaseRecord(brief, parseCaseValues(modelValues, brief)!, TODAY);
  const v = r.values;
  const chapter = `CHAPTER THREE: LABOUR AND DELIVERY
Madam Akua Mensah (G1P0) was admitted on ${formatDate(r.admission)}. Her EDD was ${formatDate(r.edd)} and her LMP ${formatDate(r.lmp)}.
Her blood pressure was ${v.booking.systolic}/${v.booking.diastolic} mmHg at booking. She weighed ${v.booking.weightKg} kg.
A female baby was born on ${formatDate(r.delivery)} with a birth weight of ${v.baby.weightKg} kg and APGAR scores of ${v.baby.apgar1} at 1 minute and ${v.baby.apgar5} at 5 minutes (out of 10).`;
  assert.deepEqual(checkAgainstRecord(chapter, r), []);
});

test('facts that disagree with the record are reported', () => {
  const r = buildCaseRecord(brief, parseCaseValues(modelValues, brief)!, TODAY);
  const chapter = `Madam Mensah (G2P1) was gravida 2. Her EDD was 1 January 2020. BP was 150/100 mmHg.
The baby had a birth weight of 2.5 kg and an APGAR score of 4 at 1 minute. She was seen on 2 February 2019.`;
  const issues = checkAgainstRecord(chapter, r).join('\n');
  assert.match(issues, /G1P0/);
  assert.match(issues, /gravida 1/);
  assert.match(issues, /EDD should be/);
  assert.match(issues, /150\/100/);
  assert.match(issues, /birth weight is 3\.05 kg/);
  assert.match(issues, /APGAR scores must be 7/);
  assert.match(issues, /2 February 2019/);
});

test('a chapter that never names the client is flagged', () => {
  const r = buildCaseRecord(brief, parseCaseValues(modelValues, brief)!, TODAY);
  assert.match(checkAgainstRecord('The client was well.', r).join(' '), /Madam Akua Mensah/);
});

test('the case record lists every date it is checked against', () => {
  const r = buildCaseRecord(brief, parseCaseValues(modelValues, brief)!, TODAY);
  const text = formatCaseRecord(r);
  for (const iso of recordDates(r)) {
    const [y, m, d] = iso.split('-').map(Number);
    assert.ok(text.includes(formatDate(new Date(Date.UTC(y, m - 1, d)))), `${iso} missing from the record text`);
  }
  assert.match(text, /fictional/);
});
