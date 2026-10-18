import { supabase } from '../../db/supabase.js';
import { childLogger } from '../../lib/logger.js';
import { toGhanaMsisdn } from '../../lib/phone.js';
import { isArkeselConfigured, sendSms } from '../sms/arkesel.service.js';
import { ReviewError, isActiveReviewer } from './review.service.js';
import { cleanSpecialties } from './review-sources.js';

const log = childLogger('reviewer-applications');

export interface ApplicationInput {
  display_name: string;
  institution: string;
  qualification: string;
  specialties: string[];
  years_experience: number;
  bio: string | null;
  profile_url: string | null;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** Validate and clean an application. Returns the first problem in plain words. */
export function validateApplication(raw: unknown): { ok: true; value: ApplicationInput } | { ok: false; error: string } {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const display_name = text(body.display_name, 80);
  if (display_name.length < 2) return { ok: false, error: 'Enter the name students should see, e.g. "Dr. A. Mensah".' };

  const institution = text(body.institution, 150);
  if (institution.length < 2) return { ok: false, error: 'Enter your institution or workplace.' };

  const qualification = text(body.qualification, 150);
  if (qualification.length < 2) return { ok: false, error: 'Enter your highest qualification, e.g. "MPhil Midwifery".' };

  const specialties = cleanSpecialties(body.specialties);
  if (!specialties.length) return { ok: false, error: 'Choose at least one area you can review.' };

  const years = Number(body.years_experience);
  if (!Number.isInteger(years) || years < 0 || years > 60) return { ok: false, error: 'Enter your years of experience as a whole number.' };

  const bio = text(body.bio, 500) || null;

  let profile_url: string | null = text(body.profile_url, 300) || null;
  if (profile_url) {
    try {
      const url = new URL(profile_url);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol');
      profile_url = url.toString();
    } catch {
      return { ok: false, error: 'The profile link must start with https://.' };
    }
  }

  if (body.declaration !== true) {
    return { ok: false, error: 'Confirm that your details are true and that you will keep students\' work confidential.' };
  }

  return { ok: true, value: { display_name, institution, qualification, specialties, years_experience: years, bio, profile_url } };
}

export async function submitApplication(userId: string, raw: unknown) {
  const parsed = validateApplication(raw);
  if (!parsed.ok) throw new ReviewError(parsed.error);
  if (await isActiveReviewer(userId)) throw new ReviewError('You are already an approved reviewer.', 409);

  const { data, error } = await supabase
    .from('reviewer_applications')
    .insert({ user_id: userId, ...parsed.value, declaration_confirmed_at: new Date().toISOString() })
    .select('id, status, created_at')
    .single();
  if (error) {
    // The unique index allows one pending application per person.
    if ((error as { code?: string }).code === '23505') throw new ReviewError('You already have an application waiting for review.', 409);
    throw new ReviewError('Could not send your application. Please try again.', 500);
  }
  return data;
}

/** The applicant's latest application, and whether they are already a reviewer. */
export async function myApplication(userId: string) {
  const [{ data: latest }, reviewer] = await Promise.all([
    supabase
      .from('reviewer_applications')
      .select('id, display_name, institution, qualification, specialties, years_experience, bio, profile_url, status, admin_notes, created_at, decided_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    isActiveReviewer(userId),
  ]);
  return { application: latest ?? null, isReviewer: reviewer };
}

export async function adminListApplications(status?: string) {
  let query = supabase
    .from('reviewer_applications')
    .select('id, user_id, display_name, institution, qualification, specialties, years_experience, bio, profile_url, status, admin_notes, created_at, decided_at, users!reviewer_applications_user_id_fkey(phone, full_name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new ReviewError('Could not load applications.', 500);
  return data ?? [];
}

/**
 * Approve or reject. The decision is claimed first (only a pending application
 * can be decided, once), then an approval creates the reviewer with the vetting
 * details and who approved them.
 */
export async function decideApplication(
  adminId: string,
  id: string,
  decision: 'approve' | 'reject',
  notes: unknown,
  overrides?: { specialties?: unknown }
) {
  const adminNotes = text(notes, 1000);
  if (decision === 'reject' && adminNotes.length < 10) {
    throw new ReviewError('Give a short reason. The applicant will see it.');
  }

  const now = new Date().toISOString();
  const { data: application } = await supabase
    .from('reviewer_applications')
    .update({ status: decision === 'approve' ? 'approved' : 'rejected', admin_notes: adminNotes || null, decided_by: adminId, decided_at: now })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, user_id, display_name, institution, qualification, specialties, years_experience, bio')
    .maybeSingle();
  if (!application) throw new ReviewError('That application has already been decided.', 409);

  if (decision === 'approve') {
    const specialties = overrides?.specialties !== undefined ? cleanSpecialties(overrides.specialties) : application.specialties;
    if (!specialties.length) {
      await supabase.from('reviewer_applications').update({ status: 'pending', decided_by: null, decided_at: null, admin_notes: null }).eq('id', id);
      throw new ReviewError('Choose at least one area for this reviewer.');
    }
    const { error } = await supabase.from('reviewers').upsert({
      user_id: application.user_id,
      display_name: application.display_name,
      bio: application.bio,
      active: true,
      specialties,
      institution: application.institution,
      qualification: application.qualification,
      years_experience: application.years_experience,
      vetted_by: adminId,
      vetted_at: now,
      vetting_notes: adminNotes || null,
      application_id: application.id,
    });
    if (error) {
      await supabase.from('reviewer_applications').update({ status: 'pending', decided_by: null, decided_at: null, admin_notes: null }).eq('id', id);
      throw new ReviewError('Could not create the reviewer. The application is still pending.', 500);
    }
  }

  void notifyApplicant(application.user_id, decision);
  return { userId: application.user_id };
}

async function notifyApplicant(userId: string, decision: 'approve' | 'reject') {
  try {
    if (!isArkeselConfigured()) return;
    const { data: user } = await supabase.from('users').select('phone').eq('id', userId).maybeSingle();
    const msisdn = user?.phone ? toGhanaMsisdn(user.phone) : null;
    if (!msisdn) return;
    await sendSms(
      msisdn,
      decision === 'approve'
        ? 'ResearchPadi: your reviewer application was approved. Open the Review desk to start taking requests.'
        : 'ResearchPadi: your reviewer application was not approved. Open Become a reviewer to see why.',
    );
  } catch (err: any) {
    log.warn({ err: err?.message }, 'Application decision SMS failed');
  }
}
