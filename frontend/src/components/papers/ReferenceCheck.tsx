import { useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { Paper } from '../../types';

/**
 * What the reference check found before delivery. Every reference we couldn't
 * match to a real source is listed, so the student checks or replaces it
 * instead of trusting it.
 */
export default function ReferenceCheck({ paper }: { paper: Paper }) {
  const [open, setOpen] = useState(false);
  if (paper.status !== 'completed') return null;

  const report = paper.citation_report;
  if (!report) {
    return (
      <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="font-bold text-amber-900 flex items-center gap-1.5 mb-1"><AlertTriangle size={15} /> References not checked</p>
        <p className="text-amber-900/80 leading-relaxed">
          We couldn't run the automatic reference check on this draft. Check each reference against the original source before you use it.
        </p>
      </div>
    );
  }

  const doubtful = report.results.filter((r) => r.match_status !== 'verified');
  const needsReview = paper.citation_status === 'needs_review';

  if (report.total_citations === 0) {
    return (
      <div className="rounded-[14px] border border-rule bg-white p-4 text-sm">
        <p className="font-bold text-navy mb-1">Reference check</p>
        <p className="text-muted leading-relaxed">We didn't find a reference list to check in this draft.</p>
      </div>
    );
  }

  const tone = needsReview || doubtful.length > 0
    ? 'border-amber-200 bg-amber-50'
    : 'border-green-200 bg-green-50';

  return (
    <div className={`rounded-[14px] border p-4 text-sm ${tone}`}>
      <p className="font-bold text-navy flex items-center gap-1.5 mb-1">
        {doubtful.length > 0 ? <AlertTriangle size={15} className="text-amber-700" /> : <CheckCircle size={15} className="text-green-700" />}
        Reference check
      </p>
      <p className="text-sm text-ink leading-relaxed">
        {report.verified} of {report.total_citations} references matched a real source.
        {needsReview && ' Several could not be matched, so treat this reference list with care.'}
      </p>

      {doubtful.length > 0 && (
        <>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            Check the ones below before you use them. A reference we couldn't find may be wrong or made up.
          </p>
          <button
            onClick={() => setOpen(!open)}
            className="mt-2 flex items-center gap-1.5 text-xs font-bold text-navy hover:underline"
            aria-expanded={open}
          >
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {doubtful.length} reference{doubtful.length !== 1 ? 's' : ''} to check
          </button>
          {open && (
            <ul className="mt-2 space-y-1.5 max-h-80 overflow-y-auto">
              {doubtful.map((r, i) => (
                <li key={`${r.citation_id}-${i}`} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-ink">
                  <span className={`font-bold ${r.match_status === 'unverified' ? 'text-red-700' : 'text-amber-800'}`}>
                    {r.match_status === 'unverified' ? 'Not found' : 'Close match, check details'}
                  </span>
                  <span className="block mt-0.5 break-words">{r.raw_string}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
