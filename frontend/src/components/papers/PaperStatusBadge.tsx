import type { Paper } from '../../types';

const LABELS: Record<string, string> = {
  queued: 'Queued',
  processing: 'Processing',
  researching: 'Researching',
  drafting: 'Drafting',
  supervising: 'Reviewing',
  completed: 'Completed',
  failed: 'Failed',
};

export default function PaperStatusBadge({ status, className = '' }: { status: Paper['status']; className?: string }) {
  const tone =
    status === 'completed' ? 'bg-green-100 text-green-700' :
    status === 'failed' ? 'bg-red-100 text-red-700' :
    'bg-orange-100 text-orange-700 pulse-badge';

  return (
    <span className={`inline-block w-fit px-2.5 py-1 rounded-lg text-xs font-bold ${tone} ${className}`}>
      {LABELS[status] || 'Processing'}
    </span>
  );
}
