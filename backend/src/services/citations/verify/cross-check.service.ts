import { childLogger } from '../../../lib/logger.js';
import { normalizeText, surnameMatches, yearMatches } from './similarity.js';
import type {
  InTextCitation,
  ReferenceEntry,
  CrossConsistencyResult,
} from './types.js';

const log = childLogger('citation-crosscheck');

/**
 * Phase 4 — pure-logic cross-consistency between in-text citations and the
 * reference list. Needs NO external API and always runs (even if APIs are down).
 *
 * Rules:
 *  - Every in-text citation must map to a reference entry (orphan in-text => flag).
 *  - Every reference entry should be cited at least once in-text (unused => flag).
 *
 * Matching is conservative: author surname(s) + year must align. A reference
 * with no year still counts as "used" if its primary surname appears in-text.
 */
export function crossConsistencyCheck(
  inText: InTextCitation[],
  references: ReferenceEntry[],
  yearTolerance: number,
): CrossConsistencyResult {
  const orphan_in_text: string[] = [];
  const unused_references: string[] = [];

  const referenceUsed = new Array(references.length).fill(false);

  for (const it of inText) {
    const itSurnames = it.authors.map(a => normalizeText(a.surname));
    const itYear = it.year;

    let matched = false;
    for (let i = 0; i < references.length; i++) {
      const ref = references[i];
      const refSurnames = ref.authors.map(a => normalizeText(a.surname));
      const surnameOverlap = itSurnames.some(its =>
        refSurnames.some(refs => surnameMatches(its, refs)),
      );
      const sameYear = yearMatches(itYear, ref.year, yearTolerance);
      // Match if surnames overlap AND (year matches OR reference has no year).
      if (surnameOverlap && (sameYear || ref.year == null)) {
        matched = true;
        referenceUsed[i] = true;
        break;
      }
    }

    if (!matched) {
      orphan_in_text.push(it.raw_string);
    }
  }

  for (let i = 0; i < references.length; i++) {
    if (!referenceUsed[i]) {
      unused_references.push(references[i].raw_string || references[i].title || references[i].id);
    }
  }

  log.info(
    { orphan: orphan_in_text.length, unused: unused_references.length },
    'Cross-consistency check complete',
  );

  return { orphan_in_text, unused_references };
}
