import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { CONFIG } from '../config/index.js';
import { childLogger } from '../lib/logger.js';
import { debitWallet } from '../lib/wallet.js';
import { checkPseudonym, collectText, scanPrivacy } from '../services/care-study/privacy.js';
import { cleanEntries, getTemplate, listTemplates, missingRequired, type CareStudyTemplate } from '../services/care-study/template.service.js';
import {
  checkWork, defaultGenerate, draftSection, help, retrieveSources, type StudyContext, type StudySection,
} from '../services/care-study/care-study.service.js';
import { buildCareStudyDocx, buildCleanCareStudyDocx } from '../services/care-study/export.service.js';
import type { CareSource } from '../services/care-study/guards.js';

const log = childLogger('care-study');

/** Drafts allowed per section; the first plus a few redrafts. */
const MAX_DRAFTS_PER_SECTION = 6;

const careStudyChargeReference = (id: string) => `care_study:${id}`;
const userIdOf = (req: Request) => (req as any).user?.id as string | undefined;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** JSON with object keys sorted. The database reorders keys, so plain JSON.stringify misreports changes. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

async function loadStudy(req: Request, res: Response): Promise<{ study: any; template: CareStudyTemplate; sections: Record<string, StudySection> } | null> {
  if (!UUID.test(String(req.params.id))) {
    res.status(404).json({ error: 'Care study not found' });
    return null;
  }
  const { data: study, error } = await supabase
    .from('care_studies')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', userIdOf(req))
    .maybeSingle();
  if (error) {
    res.status(500).json({ error: 'Could not load the care study' });
    return null;
  }
  if (!study) {
    res.status(404).json({ error: 'Care study not found' });
    return null;
  }
  const template = getTemplate(study.template_id);
  if (!template) {
    res.status(500).json({ error: 'This care study uses a template that is no longer available' });
    return null;
  }
  const { data: rows } = await supabase
    .from('care_study_sections')
    .select('section_key, entries, draft, drafted_at, updated_at')
    .eq('care_study_id', study.id);
  const sections = Object.fromEntries((rows ?? []).map((r) => [r.section_key, r]));
  return { study, template, sections };
}

const context = (study: any, template: CareStudyTemplate, sections: Record<string, StudySection>): StudyContext => ({
  template,
  pseudonym: study.pseudonym,
  focus: study.focus,
  sources: (study.sources ?? []) as CareSource[],
  sourcesPending: !study.sources_fetched_at,
  sections,
});

async function recordVersion(careStudyId: string, sectionKey: string, kind: 'notes' | 'draft' | 'edit', content: unknown) {
  const { error } = await supabase.from('care_study_versions').insert({ care_study_id: careStudyId, section_key: sectionKey, kind, content });
  if (error) log.error({ careStudyId, sectionKey, kind, err: error.message }, 'Could not record version');
}

/**
 * Retrieve sources once per study; drafts may cite nothing else. An empty
 * result (often a search service being down) is not stored, so the next draft
 * tries again instead of the literature review staying locked.
 */
async function ensureSources(study: any, template: CareStudyTemplate): Promise<CareSource[]> {
  if (study.sources_fetched_at) return study.sources ?? [];
  let sources: CareSource[] = [];
  try {
    sources = await retrieveSources(template, study.focus);
  } catch (err: any) {
    log.warn({ careStudyId: study.id, err: err.message }, 'Source search failed');
    return study.sources ?? [];
  }
  if (!sources.length) {
    log.warn({ careStudyId: study.id }, 'Source search found nothing; will retry on the next draft');
    return [];
  }
  await supabase.from('care_studies').update({ sources, sources_fetched_at: new Date().toISOString() }).eq('id', study.id);
  study.sources = sources;
  study.sources_fetched_at = new Date().toISOString();
  return sources;
}

export const templates = (_req: Request, res: Response) => {
  res.json({ templates: listTemplates(), price: CONFIG.PRICING.CARE_STUDY_GHS });
};

export const list = async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('care_studies')
    .select('id, template_id, pseudonym, focus, created_at, updated_at')
    .eq('user_id', userIdOf(req))
    .order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Could not load your care studies' });
  res.json(data);
};

export const create = async (req: Request, res: Response) => {
  const userId = userIdOf(req)!;
  const { template_id, pseudonym, focus, institution_name, supervisor_name, consent, declaration } = req.body ?? {};

  const template = typeof template_id === 'string' ? getTemplate(template_id) : null;
  if (!template) return res.status(400).json({ error: 'Choose a care study template' });

  const nameError = checkPseudonym(String(pseudonym ?? ''));
  if (nameError) return res.status(400).json({ error: nameError, field: 'pseudonym' });

  if (consent !== true) return res.status(400).json({ error: 'Confirm that your client gave consent for this care study', field: 'consent' });
  if (declaration !== true) return res.status(400).json({ error: 'Confirm that you personally cared for this client', field: 'declaration' });

  const focusText = String(focus ?? '').trim().slice(0, 200);
  const blocked = scanPrivacy(`${focusText}\n${institution_name ?? ''}\n${supervisor_name ?? ''}`).filter((i) => i.severity === 'block');
  if (blocked.length) return res.status(422).json({ error: blocked[0].message, issues: blocked });

  const now = new Date().toISOString();
  const { data: study, error } = await supabase
    .from('care_studies')
    .insert({
      user_id: userId,
      template_id: template.id,
      pseudonym: String(pseudonym).trim(),
      focus: focusText,
      institution_name: institution_name ? String(institution_name).slice(0, 200) : null,
      supervisor_name: supervisor_name ? String(supervisor_name).slice(0, 120) : null,
      consent_confirmed_at: now,
      declaration_confirmed_at: now,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: 'Could not start the care study' });

  const fee = CONFIG.PRICING.CARE_STUDY_GHS;
  const charge = await debitWallet(userId, fee, 'care_study', careStudyChargeReference(study.id));
  if (!charge.ok) {
    await supabase.from('care_studies').delete().eq('id', study.id);
    if (charge.reason === 'insufficient_funds') {
      return res.status(402).json({ error: `Insufficient balance. A care study costs GHS ${fee}. Please top up your wallet.` });
    }
    return res.status(500).json({ error: 'Could not process payment. You have not been charged.' });
  }

  res.json({ study, balance: charge.balance });
};

export const get = async (req: Request, res: Response) => {
  const loaded = await loadStudy(req, res);
  if (!loaded) return;
  const { study, template, sections } = loaded;
  const sourceCount = (study.sources ?? []).length;
  // Theory sections are unlocked by the search, so count them as ready if it has not run yet.
  const status = Object.fromEntries(template.sections.map((s) => [
    s.key,
    { missing: missingRequired(s, sections[s.key]?.entries, s.requires_sources && !study.sources_fetched_at ? 1 : sourceCount) },
  ]));
  res.json({ study, template, sections, status });
};

export const saveSection = async (req: Request, res: Response) => {
  const loaded = await loadStudy(req, res);
  if (!loaded) return;
  const { study, template, sections } = loaded;
  const section = template.sections.find((s) => s.key === req.params.key);
  if (!section) return res.status(404).json({ error: 'Unknown section' });

  const entries = cleanEntries(section, req.body?.entries);
  const issues = scanPrivacy(collectText(entries));
  const blocked = issues.filter((i) => i.severity === 'block');
  if (blocked.length) {
    return res.status(422).json({ error: 'Remove the personal details highlighted below before saving.', issues: blocked });
  }

  const changed = stableJson(entries) !== stableJson(sections[section.key]?.entries ?? null);
  const now = new Date().toISOString();
  if (changed) {
    const { error } = await supabase
      .from('care_study_sections')
      .upsert({ care_study_id: study.id, section_key: section.key, entries, updated_at: now }, { onConflict: 'care_study_id,section_key' });
    if (error) return res.status(500).json({ error: 'Could not save this section' });
    await Promise.all([
      recordVersion(study.id, section.key, 'notes', entries),
      supabase.from('care_studies').update({ updated_at: now }).eq('id', study.id),
    ]);
  }

  res.json({
    saved: changed,
    warnings: issues.filter((i) => i.severity === 'warn'),
    missing: missingRequired(section, entries, section.requires_sources && !study.sources_fetched_at ? 1 : (study.sources ?? []).length),
    updated_at: changed ? now : sections[section.key]?.updated_at ?? null,
  });
};

export const draft = async (req: Request, res: Response) => {
  const loaded = await loadStudy(req, res);
  if (!loaded) return;
  const { study, template, sections } = loaded;
  const section = template.sections.find((s) => s.key === req.params.key);
  if (!section) return res.status(404).json({ error: 'Unknown section' });

  // Check the student's own inputs before spending a search or a model call.
  const ownMissing = missingRequired({ ...section, requires_sources: false }, sections[section.key]?.entries);
  if (ownMissing.length) {
    return res.status(422).json({ error: 'Fill in the required details for this section first.', missing: ownMissing });
  }

  // The care study fee covers drafting, so it is not counted against the daily plan allowance
  // (the full-paper pipeline works the same way). A cap per section keeps the cost bounded.
  const { count: drafts } = await supabase
    .from('care_study_versions')
    .select('id', { count: 'exact', head: true })
    .eq('care_study_id', study.id)
    .eq('section_key', section.key)
    .eq('kind', 'draft');
  if ((drafts ?? 0) >= MAX_DRAFTS_PER_SECTION) {
    return res.status(429).json({ error: `You have drafted this section ${MAX_DRAFTS_PER_SECTION} times. Edit the draft yourself, or contact support if you need more.` });
  }

  await ensureSources(study, template);
  try {
    const result = await draftSection(context(study, template, sections), section, defaultGenerate());
    if (result.status === 'locked') {
      return res.status(422).json({ error: 'Fill in the required details for this section first.', missing: result.missing });
    }
    const now = new Date().toISOString();
    // Upsert: a section with no required fields (the preface) can be drafted before any notes are saved.
    const { error } = await supabase
      .from('care_study_sections')
      .upsert(
        sections[section.key]
          ? { care_study_id: study.id, section_key: section.key, draft: result.draft, drafted_at: now }
          : { care_study_id: study.id, section_key: section.key, entries: {}, draft: result.draft, drafted_at: now, updated_at: now },
        { onConflict: 'care_study_id,section_key' },
      );
    if (error) return res.status(500).json({ error: 'Could not save the draft' });
    await recordVersion(study.id, section.key, 'draft', {
      text: result.draft, flagged_values: result.flaggedValues, removed_citations: result.removedCitations,
    });
    await supabase.from('care_studies').update({ updated_at: now }).eq('id', study.id);
    res.json({ draft: result.draft, drafted_at: now, flaggedValues: result.flaggedValues, removedCitations: result.removedCitations });
  } catch (err: any) {
    log.error({ careStudyId: study.id, section: section.key, err: err.message }, 'Draft failed');
    res.status(err.status || 500).json({ error: 'Drafting failed. Please try again.' });
  }
};

export const editDraft = async (req: Request, res: Response) => {
  const loaded = await loadStudy(req, res);
  if (!loaded) return;
  const { study, template, sections } = loaded;
  const section = template.sections.find((s) => s.key === req.params.key);
  if (!section) return res.status(404).json({ error: 'Unknown section' });
  if (!sections[section.key]?.draft) return res.status(400).json({ error: 'Draft this section before editing it' });

  const text = typeof req.body?.draft === 'string' ? req.body.draft.slice(0, 60000) : '';
  if (!text.trim()) return res.status(400).json({ error: 'The draft cannot be empty' });
  const blocked = scanPrivacy(text).filter((i) => i.severity === 'block');
  if (blocked.length) return res.status(422).json({ error: 'Remove the personal details highlighted below before saving.', issues: blocked });

  const { error } = await supabase
    .from('care_study_sections')
    .update({ draft: text })
    .eq('care_study_id', study.id)
    .eq('section_key', section.key);
  if (error) return res.status(500).json({ error: 'Could not save your edit' });
  await recordVersion(study.id, section.key, 'edit', { text });
  res.json({ saved: true, warnings: scanPrivacy(text).filter((i) => i.severity === 'warn') });
};

export const versions = async (req: Request, res: Response) => {
  const loaded = await loadStudy(req, res);
  if (!loaded) return;
  let query = supabase
    .from('care_study_versions')
    .select('id, section_key, kind, content, created_at')
    .eq('care_study_id', loaded.study.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (typeof req.query.section === 'string') query = query.eq('section_key', req.query.section);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Could not load the history' });
  res.json(data);
};

export const check = async (req: Request, res: Response) => {
  const loaded = await loadStudy(req, res);
  if (!loaded) return;
  const { study, template, sections } = loaded;
  const issues = await checkWork(context(study, template, sections), defaultGenerate(userIdOf(req)));
  res.json({
    issues,
    note: 'These are questions to check, not corrections. Confirm anything clinical with your supervisor.',
  });
};

export const askHelp = async (req: Request, res: Response) => {
  const loaded = await loadStudy(req, res);
  if (!loaded) return;
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) return res.status(400).json({ error: 'Type your question first' });
  const blocked = scanPrivacy(message).filter((i) => i.severity === 'block');
  if (blocked.length) return res.status(422).json({ error: blocked[0].message, issues: blocked });
  const { study, template, sections } = loaded;
  try {
    res.json(await help(context(study, template, sections), message, defaultGenerate(userIdOf(req))));
  } catch (err: any) {
    // The daily AI allowance message is useful to the student; anything else is not.
    res.status(err.status || 500).json({ error: err.status === 429 ? err.message : 'Could not answer right now. Please try again.' });
  }
};

export const exportDocx = async (req: Request, res: Response) => {
  const loaded = await loadStudy(req, res);
  if (!loaded) return;
  const { study, template, sections } = loaded;
  // "clean" is the document to submit; the default keeps the student's notes beside the draft for a supervisor.
  const clean = req.query.format === 'clean';
  const buffer = clean
    ? await buildCleanCareStudyDocx(study, template, sections)
    : await buildCareStudyDocx(study, template, sections);
  const safe = String(study.pseudonym).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'client';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="Care_study_${safe}${clean ? '' : '_supervisor_copy'}.docx"`);
  res.setHeader('X-AI-Generated', 'true');
  res.send(buffer);
};
