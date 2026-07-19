import { CONFIG } from '../../../config/index.js';
import { childLogger } from '../../../lib/logger.js';
import { extractCitations } from './extractor.service.js';
import { verifyAllReferences } from './verifier.service.js';
import { crossConsistencyCheck } from './cross-check.service.js';
import { persistVerification } from './store.service.js';
import type { VerificationSummary, VerificationResult } from './types.js';

const log = childLogger('citation-verify');

export interface CitationVerifyInput {
  paperId: string;
  fullContent: string;
  referenceList?: string;
  /** Set false in tests to skip DB persistence. */
  persist?: boolean;
}

/**
 * Orchestrates the full citation verification module:
 *   Phase 1 extraction → Phase 2/3 external verification → Phase 4 cross-check
 *   → Phase 5 persist → Phase 6 policy decision (deliver vs manual_review).
 *
 * Never blocks the pipeline on a third-party outage: external API failures
 * only downgrade matched_source to 'api_unavailable' / status to 'unverified'.
 */
export async function runCitationVerification(
  input: CitationVerifyInput,
): Promise<VerificationSummary> {
  const { paperId, fullContent, referenceList, persist = true } = input;
  const cfg = CONFIG.CITATION_VERIFY;

  log.info({ paperId }, 'Starting citation verification');

  const { inText, references } = await extractCitations(fullContent, referenceList);

  const results: VerificationResult[] = await verifyAllReferences(references);

  const cross = crossConsistencyCheck(inText, references, cfg.YEAR_TOLERANCE);

  const verified = results.filter(r => r.match_status === 'verified').length;
  const partial = results.filter(r => r.match_status === 'partial_match').length;
  const unverified = results.filter(r => r.match_status === 'unverified').length;

  const total = results.length;
  const unverifiedRatio = total > 0 ? unverified / total : 0;
  const action: VerificationSummary['policy']['action'] =
    unverifiedRatio > cfg.UNVERIFIED_BLOCK_RATIO ? 'manual_review' : 'deliver';

  const summary: VerificationSummary = {
    paper_id: paperId,
    total_citations: total,
    verified,
    partial_match: partial,
    unverified,
    orphan_in_text: cross.orphan_in_text,
    unused_references: cross.unused_references,
    results,
    policy: {
      action,
      unverified_ratio: Number(unverifiedRatio.toFixed(4)),
      block_ratio_threshold: cfg.UNVERIFIED_BLOCK_RATIO,
    },
    ran_at: new Date().toISOString(),
  };

  if (persist) {
    await persistVerification(paperId, summary);
  }

  log.info(
    { paperId, total, verified, partial, unverified, action },
    'Citation verification complete',
  );

  return summary;
}
