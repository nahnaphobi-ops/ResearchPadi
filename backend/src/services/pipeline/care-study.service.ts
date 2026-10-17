/**
 * Client/family centred maternity care study (Nursing and Midwifery Training
 * Colleges). The model only chooses the client's profile and clinical values;
 * code fixes every date and calculation (EDD by Naegele's rule, gestational
 * ages, fundal height, lochia, involution) and keeps values in believable
 * ranges. Chapters are written from that one case record and checked against
 * it afterwards, so names, dates and figures agree everywhere.
 */

export const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East',
  'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
] as const;

export const DELIVERY_MODES = ['spontaneous vaginal delivery', 'vacuum-assisted delivery', 'caesarean section'] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export interface CareStudyBrief {
  caseFocus: string;
  parity: 'primigravida' | 'multigravida';
  gestationAtFirstContact: number;
  deliveryMode: DeliveryMode;
  region: string;
  facility?: string;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Validate the order form's care study details. */
export function parseCareStudyBrief(body: unknown): { brief: CareStudyBrief } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const caseFocus = text(b.caseFocus, 200);
  if (caseFocus.length < 5) return { error: 'Describe the case, for example "Primigravida with anaemia in pregnancy".' };
  const parity = b.parity === 'multigravida' ? 'multigravida' : 'primigravida';
  const weeks = Math.round(Number(b.gestationAtFirstContact));
  // Up to 30 weeks leaves room for the home visit and later antenatal visits before delivery.
  if (!Number.isFinite(weeks) || weeks < 12 || weeks > 30) return { error: 'Gestation at first contact must be between 12 and 30 weeks.' };
  const deliveryMode = (DELIVERY_MODES as readonly string[]).includes(b.deliveryMode as string) ? (b.deliveryMode as DeliveryMode) : 'spontaneous vaginal delivery';
  const region = GHANA_REGIONS.find((r) => r.toLowerCase() === text(b.region, 40).toLowerCase());
  if (!region) return { error: 'Choose the region in Ghana where the care took place.' };
  return { brief: { caseFocus, parity, gestationAtFirstContact: weeks, deliveryMode, region, facility: text(b.facility, 120) || undefined } };
}

// ── Values the model chooses ─────────────────────────────────────────────────

interface Vitals { systolic: number; diastolic: number; pulse: number; temp: number; resp: number }

export interface CaseValues {
  client: { name: string; age: number; occupation: string; religion: string; maritalStatus: string; education: string; ethnicity: string; residence: string };
  partner: { name: string; age: number; occupation: string };
  family: string;
  medicalHistory: string;
  pastObstetric: string;
  gravida: number;
  para: number;
  abortions: number;
  livingChildren: number;
  bloodGroup: string;
  rhesus: 'positive' | 'negative';
  hbBooking: number;
  hbLater: number;
  booking: Vitals & { weightKg: number };
  visits: { systolic: number; diastolic: number; weightKg: number; fhr: number }[];
  labour: { cervixOnAdmissionCm: number; membranes: string; firstStageHours: number; secondStageMinutes: number; thirdStageMinutes: number; bloodLossMl: number; perineum: string };
  baby: { sex: 'male' | 'female'; weightKg: number; apgar1: number; apgar5: number };
  postnatal: Vitals[];
  problems: { antenatal: string[]; labour: string[]; postnatal: string[] };
}

export function buildCaseValuesPrompt(brief: CareStudyBrief): string {
  return `
You are a senior midwifery tutor in Ghana creating a FICTIONAL client for a model client/family centred maternity care study. No real person is described.

CASE: ${brief.caseFocus}
Parity: ${brief.parity}. Delivery: ${brief.deliveryMode}. Region: ${brief.region}${brief.facility ? `. Facility: ${brief.facility}` : ''}.
First antenatal contact at ${brief.gestationAtFirstContact} weeks.

Choose values that fit this case and are clinically believable. Where the case is about a condition (for example anaemia or pre-eclampsia), the values must show it; everything else stays within normal limits.

Return ONLY JSON with exactly these fields:
{
  "client": { "name": "a Ghanaian first name and surname", "age": 0, "occupation": "", "religion": "", "maritalStatus": "", "education": "", "ethnicity": "", "residence": "a town in ${brief.region} Region" },
  "partner": { "name": "", "age": 0, "occupation": "" },
  "family": "2-3 sentences on the household and family health",
  "medicalHistory": "1-2 sentences",
  "pastObstetric": "${brief.parity === 'primigravida' ? 'state that this is her first pregnancy' : 'each previous pregnancy: year, outcome, place and mode of delivery'}",
  "gravida": 0, "para": 0, "abortions": 0, "livingChildren": 0,
  "bloodGroup": "A | B | AB | O", "rhesus": "positive | negative",
  "hbBooking": 0.0, "hbLater": 0.0,
  "booking": { "systolic": 0, "diastolic": 0, "pulse": 0, "temp": 0.0, "resp": 0, "weightKg": 0.0 },
  "visits": [ { "systolic": 0, "diastolic": 0, "weightKg": 0.0, "fhr": 0 }, { ... }, { ... } ],
  "labour": { "cervixOnAdmissionCm": 0, "membranes": "intact | ruptured, clear liquor", "firstStageHours": 0.0, "secondStageMinutes": 0, "thirdStageMinutes": 0, "bloodLossMl": 0, "perineum": "intact | first-degree tear | episiotomy" },
  "baby": { "sex": "male | female", "weightKg": 0.0, "apgar1": 0, "apgar5": 0 },
  "postnatal": [ { "systolic": 0, "diastolic": 0, "pulse": 0, "temp": 0.0, "resp": 0 }, { ... } ],
  "problems": { "antenatal": ["2-3 nursing problems"], "labour": ["2-3"], "postnatal": ["2-3"] }
}
"visits" has exactly 3 entries; "postnatal" has exactly 2 (day 1 and day 2 after delivery).
`.trim();
}

// ── Checking and completing the record ───────────────────────────────────────

const clamp = (v: unknown, min: number, max: number, fallback: number, decimals = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const f = 10 ** decimals;
  return Math.round(Math.min(max, Math.max(min, n)) * f) / f;
};

function vitals(v: any, fallback: Vitals): Vitals {
  let systolic = clamp(v?.systolic, 80, 200, fallback.systolic);
  let diastolic = clamp(v?.diastolic, 40, 130, fallback.diastolic);
  if (diastolic >= systolic - 15) diastolic = Math.max(40, systolic - 30);
  systolic = Math.round(systolic);
  return {
    systolic,
    diastolic: Math.round(diastolic),
    pulse: clamp(v?.pulse, 50, 140, fallback.pulse),
    temp: clamp(v?.temp, 35.5, 40.5, fallback.temp, 1),
    resp: clamp(v?.resp, 12, 32, fallback.resp),
  };
}

const NORMAL: Vitals = { systolic: 110, diastolic: 70, pulse: 82, temp: 36.6, resp: 18 };
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => text(x, 300)).filter(Boolean).slice(0, max) : []);

/** Parse the model's values and force them into consistent, believable ranges. */
export function parseCaseValues(raw: string, brief: CareStudyBrief): CaseValues | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let d: any;
  try {
    d = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const name = text(d.client?.name, 60);
  if (!name.includes(' ')) return null;

  let gravida: number, para: number, abortions: number, livingChildren: number;
  if (brief.parity === 'primigravida') {
    [gravida, para, abortions, livingChildren] = [1, 0, 0, 0];
  } else {
    gravida = clamp(d.gravida, 2, 8, 2);
    abortions = clamp(d.abortions, 0, gravida - 2, 0);
    para = clamp(d.para, 1, gravida - 1 - abortions, gravida - 1 - abortions);
    livingChildren = clamp(d.livingChildren, 0, para, para);
  }

  const booking = { ...vitals(d.booking, NORMAL), weightKg: clamp(d.booking?.weightKg, 40, 130, 62, 1) };
  const visits = Array.from({ length: 3 }, (_, i) => {
    const v = d.visits?.[i] ?? {};
    const bp = vitals(v, { ...NORMAL, systolic: booking.systolic, diastolic: booking.diastolic });
    return { systolic: bp.systolic, diastolic: bp.diastolic, weightKg: clamp(v.weightKg, 40, 140, booking.weightKg + i + 1, 1), fhr: clamp(v.fhr, 110, 170, 140) };
  });
  const apgar1 = clamp(d.baby?.apgar1, 1, 10, 7);
  const apgar5 = clamp(d.baby?.apgar5, apgar1, 10, Math.min(10, apgar1 + 2));

  return {
    client: {
      name,
      age: clamp(d.client?.age, 16, 45, 26),
      occupation: text(d.client?.occupation, 80) || 'Trader',
      religion: text(d.client?.religion, 60) || 'Christian',
      maritalStatus: text(d.client?.maritalStatus, 40) || 'Married',
      education: text(d.client?.education, 80) || 'Senior High School',
      ethnicity: text(d.client?.ethnicity, 60) || 'Akan',
      residence: text(d.client?.residence, 80) || `${brief.region} Region`,
    },
    partner: { name: text(d.partner?.name, 60) || 'Not stated', age: clamp(d.partner?.age, 18, 70, 32), occupation: text(d.partner?.occupation, 80) || 'Not stated' },
    family: text(d.family, 600),
    medicalHistory: text(d.medicalHistory, 400),
    pastObstetric: brief.parity === 'primigravida' ? 'None. This is her first pregnancy.' : text(d.pastObstetric, 600),
    gravida, para, abortions, livingChildren,
    bloodGroup: ['A', 'B', 'AB', 'O'].includes(d.bloodGroup) ? d.bloodGroup : 'O',
    rhesus: d.rhesus === 'negative' ? 'negative' : 'positive',
    hbBooking: clamp(d.hbBooking, 6, 15, 11, 1),
    hbLater: clamp(d.hbLater, 6, 15, 11.5, 1),
    booking,
    visits,
    labour: {
      cervixOnAdmissionCm: clamp(d.labour?.cervixOnAdmissionCm, 3, 9, 5),
      membranes: text(d.labour?.membranes, 80) || 'intact',
      firstStageHours: clamp(d.labour?.firstStageHours, 1, 18, 8, 1),
      secondStageMinutes: clamp(d.labour?.secondStageMinutes, 5, 120, 30),
      thirdStageMinutes: clamp(d.labour?.thirdStageMinutes, 3, 30, 10),
      bloodLossMl: clamp(d.labour?.bloodLossMl, 50, 1500, 250),
      perineum: text(d.labour?.perineum, 80) || 'intact',
    },
    baby: { sex: d.baby?.sex === 'male' ? 'male' : 'female', weightKg: clamp(d.baby?.weightKg, 1.5, 4.8, 3.1, 2), apgar1, apgar5 },
    postnatal: [0, 1].map((i) => vitals(d.postnatal?.[i], NORMAL)),
    problems: { antenatal: list(d.problems?.antenatal, 3), labour: list(d.problems?.labour, 3), postnatal: list(d.problems?.postnatal, 3) },
  };
}

// ── Dates ────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const formatDate = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** "38 weeks 4 days" from LMP to a date. */
export function gestation(lmp: Date, on: Date): { weeks: number; days: number; label: string } {
  const total = Math.round((utcDay(on).getTime() - utcDay(lmp).getTime()) / DAY);
  const weeks = Math.floor(total / 7);
  const days = total % 7;
  return { weeks, days, label: days ? `${weeks} weeks ${days} day${days === 1 ? '' : 's'}` : `${weeks} weeks` };
}

/** Naegele's rule: LMP + 280 days. */
export const eddFromLmp = (lmp: Date) => addDays(utcDay(lmp), 280);

const lochiaOn = (day: number) => (day <= 3 ? 'lochia rubra' : day <= 10 ? 'lochia serosa' : 'lochia alba');
const fundusAfterBirth = (day: number) => (day <= 10 ? `about ${day} cm below the umbilicus` : 'no longer palpable abdominally');

export interface CaseEvent { label: string; date: Date }

export interface CaseRecord {
  brief: CareStudyBrief;
  values: CaseValues;
  lmp: Date;
  edd: Date;
  firstContact: Date;
  homeVisit: Date;
  visits: { date: Date; gestation: string; fundalHeightCm: number | null }[];
  admission: Date;
  delivery: Date;
  deliveryGestation: string;
  postnatalDays: { day: number; date: Date; lochia: string; fundus: string }[];
  postnatalVisits: { label: string; date: Date; lochia: string; fundus: string }[];
  discharge: Date;
}

function deliveryGestationDays(brief: CareStudyBrief): number {
  if (/\bpre-?term\b/i.test(brief.caseFocus)) return 35 * 7 + 2;
  if (/\b(post-?term|post-?date|prolonged pregnancy)\b/i.test(brief.caseFocus)) return 41 * 7 + 3;
  return brief.deliveryMode === 'caesarean section' ? 38 * 7 + 5 : 39 * 7 + 3;
}

/**
 * Build the timeline: delivery ten weeks before today, so the six-week
 * postnatal visit is in the past; everything else follows from LMP.
 */
export function buildCaseRecord(brief: CareStudyBrief, values: CaseValues, today = new Date()): CaseRecord {
  const deliveryDay = addDays(utcDay(today), -70);
  const lmp = addDays(deliveryDay, -deliveryGestationDays(brief));
  const edd = eddFromLmp(lmp);
  const firstContact = addDays(lmp, brief.gestationAtFirstContact * 7);
  const homeVisit = addDays(firstContact, 7);

  // Up to three later visits, spread evenly between the home visit and delivery.
  const span = Math.round((deliveryDay.getTime() - homeVisit.getTime()) / DAY);
  const count = span >= 21 ? 3 : span >= 10 ? 2 : span >= 4 ? 1 : 0;
  const visits = Array.from({ length: count }, (_, k) => {
    const date = addDays(homeVisit, Math.round((span * (k + 1)) / (count + 1)));
    const g = gestation(lmp, date);
    return { date, gestation: g.label, fundalHeightCm: g.weeks >= 20 ? Math.min(g.weeks, 38) : null };
  });

  const labourMinutes = Math.round(values.labour.firstStageHours * 60) + values.labour.secondStageMinutes;
  // Born at 14:20 on the delivery day; admitted when the first stage began.
  const delivery = new Date(deliveryDay.getTime() + (14 * 60 + 20) * 60_000);
  const admission = new Date(delivery.getTime() - labourMinutes * 60_000);
  const stayDays = brief.deliveryMode === 'caesarean section' ? 3 : 2;

  return {
    brief,
    values,
    lmp,
    edd,
    firstContact,
    homeVisit,
    visits,
    admission,
    delivery,
    deliveryGestation: gestation(lmp, deliveryDay).label,
    postnatalDays: [1, 2].map((day) => ({ day, date: addDays(deliveryDay, day), lochia: lochiaOn(day), fundus: fundusAfterBirth(day) })),
    postnatalVisits: [
      { label: 'Postnatal home visit (day 7)', date: addDays(deliveryDay, 7), lochia: lochiaOn(7), fundus: fundusAfterBirth(7) },
      { label: 'Postnatal clinic visit (6 weeks)', date: addDays(deliveryDay, 42), lochia: lochiaOn(42), fundus: fundusAfterBirth(42) },
    ],
    discharge: addDays(deliveryDay, stayDays),
  };
}

const hhmm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
const bp = (v: { systolic: number; diastolic: number }) => `${v.systolic}/${v.diastolic} mmHg`;

/** Every date in the record (as YYYY-MM-DD), for checking the written chapters. */
export function recordDates(r: CaseRecord): Set<string> {
  return new Set([
    r.lmp, r.edd, r.firstContact, r.homeVisit, ...r.visits.map((v) => v.date), r.admission, r.delivery, r.discharge,
    ...r.postnatalDays.map((p) => p.date), ...r.postnatalVisits.map((p) => p.date),
  ].map((d) => iso(utcDay(d))));
}

export function recordBloodPressures(r: CaseRecord): Set<string> {
  const v = r.values;
  return new Set([v.booking, ...v.visits, ...v.postnatal].map((x) => `${x.systolic}/${x.diastolic}`));
}

/** The case record as the chapter writer must follow it. */
export function formatCaseRecord(r: CaseRecord): string {
  const v = r.values;
  const lines = [
    `Client (fictional): Madam ${v.client.name}, ${v.client.age} years, ${v.client.occupation}, ${v.client.religion}, ${v.client.maritalStatus}, education: ${v.client.education}, ${v.client.ethnicity}, lives in ${v.client.residence}, ${r.brief.region} Region.`,
    `Partner: ${v.partner.name}, ${v.partner.age} years, ${v.partner.occupation}.`,
    `Family: ${v.family}`,
    `Medical/surgical history: ${v.medicalHistory}`,
    `Past obstetric history: ${v.pastObstetric}`,
    `Gravida ${v.gravida}, Para ${v.para} (G${v.gravida}P${v.para}); abortions ${v.abortions}; living children ${v.livingChildren}.`,
    `Blood group ${v.bloodGroup} Rhesus ${v.rhesus}. Haemoglobin ${v.hbBooking} g/dL at booking, ${v.hbLater} g/dL later in pregnancy.`,
    `LMP: ${formatDate(r.lmp)}. EDD (Naegele's rule): ${formatDate(r.edd)}.`,
    `Case focus: ${r.brief.caseFocus}.${r.brief.facility ? ` Facility: ${r.brief.facility}.` : ''}`,
    '',
    `First contact (booking): ${formatDate(r.firstContact)}, ${gestation(r.lmp, r.firstContact).label}. BP ${bp(v.booking)}, pulse ${v.booking.pulse} bpm, temperature ${v.booking.temp} °C, respiration ${v.booking.resp} cpm, weight ${v.booking.weightKg} kg.`,
    `First antenatal home visit: ${formatDate(r.homeVisit)}, ${gestation(r.lmp, r.homeVisit).label}.`,
    ...r.visits.map((visit, i) =>
      `Antenatal visit ${i + 1}: ${formatDate(visit.date)}, ${visit.gestation}. BP ${bp(v.visits[i])}, weight ${v.visits[i].weightKg} kg${visit.fundalHeightCm ? `, fundal height ${visit.fundalHeightCm} cm` : ''}, fetal heart rate ${v.visits[i].fhr} bpm.`),
    '',
    `Admission in labour: ${formatDate(r.admission)} at ${hhmm(r.admission)}. Cervix ${v.labour.cervixOnAdmissionCm} cm dilated; membranes ${v.labour.membranes}.`,
    `First stage: ${v.labour.firstStageHours} hours. Second stage: ${v.labour.secondStageMinutes} minutes. Third stage: ${v.labour.thirdStageMinutes} minutes.`,
    `Delivery: ${r.brief.deliveryMode} on ${formatDate(r.delivery)} at ${hhmm(r.delivery)}, at ${r.deliveryGestation}. Estimated blood loss ${v.labour.bloodLossMl} ml. Perineum: ${v.labour.perineum}. Placenta and membranes delivered complete.`,
    `Baby: ${v.baby.sex}, birth weight ${v.baby.weightKg} kg, APGAR ${v.baby.apgar1} at 1 minute and ${v.baby.apgar5} at 5 minutes.`,
    '',
    ...r.postnatalDays.map((p, i) => `Postnatal day ${p.day}: ${formatDate(p.date)}. BP ${bp(v.postnatal[i])}, pulse ${v.postnatal[i].pulse} bpm, temperature ${v.postnatal[i].temp} °C. Fundus ${p.fundus}; ${p.lochia}.`),
    `Discharged: ${formatDate(r.discharge)}.`,
    ...r.postnatalVisits.map((p) => `${p.label}: ${formatDate(p.date)}. Fundus ${p.fundus}; ${p.lochia}.`),
    '',
    `Nursing problems — antenatal: ${v.problems.antenatal.join('; ') || 'as identified'}. Labour: ${v.problems.labour.join('; ') || 'as identified'}. Postnatal: ${v.problems.postnatal.join('; ') || 'as identified'}.`,
  ];
  return lines.join('\n');
}

// ── Checking the written chapters against the record ─────────────────────────

const MONTH_INDEX = Object.fromEntries(MONTHS.map((m, i) => [m.toLowerCase(), i]));

/** Dates written as "12 March 2026", "12th March, 2026", "March 12, 2026" or "12/03/2026". */
export function findDates(textIn: string): { raw: string; iso: string; index: number }[] {
  const out: { raw: string; iso: string; index: number }[] = [];
  const push = (raw: string, index: number, day: number, month: number, year: number) => {
    if (month < 0 || month > 11 || day < 1 || day > 31) return;
    out.push({ raw, index, iso: iso(new Date(Date.UTC(year, month, day))) });
  };
  for (const m of textIn.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})\b/gi)) {
    push(m[0], m.index ?? 0, Number(m[1]), MONTH_INDEX[m[2].toLowerCase()], Number(m[3]));
  }
  for (const m of textIn.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi)) {
    push(m[0], m.index ?? 0, Number(m[2]), MONTH_INDEX[m[1].toLowerCase()], Number(m[3]));
  }
  for (const m of textIn.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    push(m[0], m.index ?? 0, Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return out;
}

/** Facts in a chapter that disagree with the case record. Empty means consistent. */
export function checkAgainstRecord(chapter: string, r: CaseRecord): string[] {
  const issues: string[] = [];
  const v = r.values;
  const dates = recordDates(r);

  for (const d of findDates(chapter)) {
    if (!dates.has(d.iso)) issues.push(`The date "${d.raw}" is not in the case record.`);
  }
  for (const label of ['EDD', 'expected date of delivery', 'LMP', 'last menstrual period']) {
    const want = /edd|expected/i.test(label) ? r.edd : r.lmp;
    for (const m of chapter.matchAll(new RegExp(`\\b${label}\\b`, 'gi'))) {
      const after = findDates(chapter.slice(m.index ?? 0, (m.index ?? 0) + 80))[0];
      if (after && after.iso !== iso(want)) issues.push(`The ${label} should be ${formatDate(want)}, not "${after.raw}".`);
    }
  }

  const pressures = recordBloodPressures(r);
  for (const m of chapter.matchAll(/\b(\d{2,3})\s*\/\s*(\d{2,3})\s*mm\s?Hg/gi)) {
    if (!pressures.has(`${m[1]}/${m[2]}`)) issues.push(`The blood pressure ${m[1]}/${m[2]} mmHg is not in the case record.`);
  }

  for (const m of chapter.matchAll(/\bAPGAR\b[^.]{0,90}/gi)) {
    const nums = [...m[0].matchAll(/\b(\d{1,2})\b/g)].map((x) => Number(x[1])).filter((n) => n <= 10 && n !== 1 && n !== 5);
    const allowed = new Set([v.baby.apgar1, v.baby.apgar5, 10]);
    if (nums.some((n) => !allowed.has(n))) issues.push(`APGAR scores must be ${v.baby.apgar1} at 1 minute and ${v.baby.apgar5} at 5 minutes.`);
  }

  for (const m of chapter.matchAll(/\b(?:birth weight|weigh(?:ed|ing|t)?)\b[^.]{0,40}?\b(\d(?:\.\d{1,2})?)\s*kg/gi)) {
    const kg = Number(m[1]);
    const isBaby = /baby|birth|newborn|neonate/i.test(chapter.slice(Math.max(0, (m.index ?? 0) - 80), (m.index ?? 0) + m[0].length));
    if (isBaby && kg < 6 && Math.abs(kg - v.baby.weightKg) > 0.005) issues.push(`The baby's birth weight is ${v.baby.weightKg} kg, not ${kg} kg.`);
  }

  for (const m of chapter.matchAll(/\bG(\d+)\s*P(\d+)/g)) {
    if (Number(m[1]) !== v.gravida || Number(m[2]) !== v.para) issues.push(`Gravidity and parity are G${v.gravida}P${v.para}, not ${m[0]}.`);
  }
  for (const m of chapter.matchAll(/\bgravida\s+(\d+)/gi)) {
    if (Number(m[1]) !== v.gravida) issues.push(`She is gravida ${v.gravida}, not gravida ${m[1]}.`);
  }

  const nameParts = v.client.name.split(' ').filter((p) => p.length > 1).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (nameParts.length && !new RegExp(`\\b(${nameParts.join('|')})\\b`, 'i').test(chapter)) issues.push(`Refer to the client as Madam ${v.client.name}.`);
  return [...new Set(issues)];
}

// ── Prompts ──────────────────────────────────────────────────────────────────

/** Doses we are sure of; every other medicine is "as prescribed" with no dose. */
const MEDICATION_RULE = `MEDICINES: give a dose only for these routine items: oxytocin 10 IU intramuscularly for active management of the third stage of labour, vitamin K 1 mg intramuscularly for the newborn, and tetracycline 1% eye ointment for the newborn. For every other medicine, name the medicine and route and write "as prescribed" instead of a dose.`;

export const CARE_STUDY_SYSTEM_PROMPT = `You are an experienced Ghanaian midwifery tutor writing a model client/family centred maternity care study for students at a Nursing and Midwifery Training College. It follows the Nursing and Midwifery Council of Ghana care study format and the nursing process (assessment, nursing diagnosis, planning, implementation, evaluation).

RULES:
- The client is fictional. Use only the facts in the CASE RECORD. Never add dates, readings, test results or events that are not in it.
- Write every date exactly as in the case record (for example "12 March 2026") and every blood pressure as "120/80 mmHg".
- Third person, past tense: "Madam X was…", "Care was given…". UK English. No contractions.
- Nursing diagnoses use the problem–aetiology–signs form: "[Problem] related to [cause] as evidenced by [signs]".
- Each Nursing Care Plan entry is a labelled block (the document is plain text, so no tables):
  Date: … / Nursing diagnosis: … / Objective: … / Nursing orders: … / Nursing interventions (with rationale): … / Evaluation: …
- ${MEDICATION_RULE}
- Cite only works in the SOURCES list, with exactly the in-text form shown. If a WHO or Ghana Health Service guideline is relevant but not listed, describe the practice without a citation.
- Begin with the chapter heading exactly as given. No preamble or commentary.`;

const CHAPTER_GUIDE: Record<number, string> = {
  1: `1.1 Introduction: what a client/family centred maternity care study is, why this client was chosen, and that her name and details are fictional for this study draft. Then social, family, medical/surgical, past obstetric and present obstetric history from the record. End with a Nursing Care Plan for 2 problems identified at booking.`,
  2: `First contact (booking) with findings and investigations, the first antenatal home visit (home environment, family involvement, health education), each later antenatal visit in date order with its findings and the health education given, then a Nursing Care Plan for 2-3 antenatal problems.`,
  3: `Admission and assessment, first stage (partograph monitoring, comfort, observations), second stage, third stage (active management) and fourth stage (monitoring for haemorrhage), immediate care of the newborn (drying, warmth, cord care, early breastfeeding, vitamin K, eye care, APGAR), then a Nursing Care Plan for 2-3 labour problems.`,
  4: `Daily care of the mother (observations, fundus and lochia exactly as recorded, perineal care, breastfeeding) and of the newborn (cord care, feeding, danger signs, immunisation), discharge and its health education, each postnatal visit, then a summary and conclusion reflecting on what was learned. Do not write a reference list; it is added automatically.`,
};

export const CARE_STUDY_STRUCTURE = [
  { num: 1, title: 'CLIENT PROFILE', sections: ['1.1 Introduction', '1.2 Social History', '1.3 Family History', '1.4 Medical/Surgical History', '1.5 Past Obstetric History', '1.6 Present Obstetric History', '1.7 Nursing Care Plan'], wordTarget: 1300 },
  { num: 2, title: 'ANTENATAL CARE', sections: ['2.1 Introduction', '2.2 First Contact with Client', '2.3 First Antenatal Home Visit', '2.4 Subsequent Visits', '2.5 Nursing Care Plan'], wordTarget: 1500 },
  { num: 3, title: 'LABOUR AND DELIVERY', sections: ['3.1 Introduction', '3.2 Admission and Assessment', '3.3 First Stage of Labour', '3.4 Second Stage of Labour', '3.5 Third and Fourth Stages of Labour', '3.6 Immediate Care of the Newborn', '3.7 Nursing Care Plan'], wordTarget: 1800 },
  { num: 4, title: 'PUERPERIUM', sections: ['4.1 Introduction', '4.2 Management of the Mother', '4.3 Management of the Newborn', '4.4 Discharge and Postnatal Visits', '4.5 Summary and Conclusion'], wordTarget: 1400 },
];

export function buildCareStudyChapterPrompt(input: {
  chapter: (typeof CARE_STUDY_STRUCTURE)[number];
  record: string;
  sources: string[];
  previous: string;
  institution?: string;
}): string {
  const { chapter } = input;
  return [
    `CASE RECORD (the only facts you may use):\n${input.record}`,
    `SOURCES (cite only these, in exactly this form):\n${input.sources.join('\n') || 'None — write without citations.'}`,
    input.previous ? `EARLIER CHAPTERS (for continuity; do not repeat them):\n${input.previous.slice(-12_000)}` : '',
    `WRITE: CHAPTER ${chapter.num}: ${chapter.title}${input.institution ? ` (for ${input.institution})` : ''}
Sections, numbered and in this order: ${chapter.sections.join(', ')}
About ${chapter.wordTarget} words.
${CHAPTER_GUIDE[chapter.num]}`,
  ].filter(Boolean).join('\n\n');
}

/** Ask for the listed facts to be corrected and nothing else. */
export function buildCareStudyFixPrompt(chapter: string, issues: string[], record: string): string {
  return [
    `CASE RECORD:\n${record}`,
    `PROBLEMS TO FIX (make the chapter agree with the case record; change nothing else):\n${issues.map((i) => `- ${i}`).join('\n')}`,
    `CHAPTER:\n${chapter}`,
    'Return the complete corrected chapter only, starting with its heading.',
  ].join('\n\n');
}
