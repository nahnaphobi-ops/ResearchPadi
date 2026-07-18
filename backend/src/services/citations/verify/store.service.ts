import { supabase } from '../../../db/supabase';
import { childLogger } from '../../../lib/logger';
import type { VerificationResult, VerificationSummary } from './types';

const log = childLogger('citation-store');

/**
 * Phase 5 — persist every verification result for full auditability.
 * Each run is reproducible from this table.
 */
export async function persistVerification(
  paperId: string,
  summary: VerificationSummary,
): Promise<void> {
  const rows = summary.results.map(r => ({
    paper_id: paperId,
    citation_id: r.citation_id,
    raw_string: r.raw_string,
    parsed_authors: r.parsed_authors,
    parsed_year: r.parsed_year,
    parsed_title: r.parsed_title,
    match_status: r.match_status,
    matched_source: r.matched_source,
    matched_record_id: r.matched_record_id,
    confidence_score: r.confidence_score,
    checked_at: r.checked_at,
  }));

  if (rows.length === 0) {
    log.info({ paperId }, 'No citation rows to persist');
    return;
  }

  const { error } = await supabase.from('citation_verifications').insert(rows);
  if (error) {
    log.error({ paperId, err: error.message }, 'Failed to persist citation verifications');
    throw error;
  }

  // Attach the summary to the paper record for quick review.
  const { error: updErr } = await supabase
    .from('papers')
    .update({
      citation_report: summary,
      citation_status: summary.policy.action === 'manual_review' ? 'needs_review' : 'verified',
    })
    .eq('id', paperId);

  if (updErr) {
    log.error({ paperId, err: updErr.message }, 'Failed to attach citation report to paper');
  }

  log.info({ paperId, rows: rows.length }, 'Citation verifications persisted');
}
