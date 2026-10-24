import type { CheckedSource } from '../../types/writingAssist';

const STYLES: Record<CheckedSource['status'], { mark: string; className: string }> = {
  checked: { mark: '✓', className: 'bg-green-50 text-green-700 border-green-200' },
  skipped: { mark: '–', className: 'bg-gray-50 text-gray-500 border-gray-200' },
  failed: { mark: '!', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

/** Where the plagiarism check looked, so a low score is read with its coverage in mind. */
export default function CheckedSources({ sources, sentences }: { sources?: CheckedSource[]; sentences?: number }) {
  if (!sources?.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium text-gray-500">
        Checked {sentences ? `${sentences} sentence${sentences === 1 ? '' : 's'}` : 'your text'} against:
      </p>
      <ul className="flex flex-wrap gap-1">
        {sources.map((s) => (
          <li key={s.name} title={s.note} className={`px-1.5 py-0.5 rounded border text-[10px] ${STYLES[s.status].className}`}>
            {STYLES[s.status].mark} {s.name}
            {s.status !== 'checked' && s.note ? ` (${s.note})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
