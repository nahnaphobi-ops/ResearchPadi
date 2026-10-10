import { Eye, FileText, Minus, Plus } from 'lucide-react';
import { ZOOM_MAX, ZOOM_MIN, type PageSettings } from './pageLayout';

interface Props {
  currentPage: number;
  pageCount: number;
  wordCount: number;
  selectedWords: number;
  settings: PageSettings;
  onSettingsChange: (patch: Partial<PageSettings>) => void;
}

/** Word-style status bar: page and word counts on the left, view and zoom on the right. */
export function StatusBar({ currentPage, pageCount, wordCount, selectedWords, settings, onSettingsChange }: Props) {
  const setZoom = (z: number) => onSettingsChange({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z))) });
  const btn = 'h-6 w-6 grid place-items-center rounded hover:bg-[#e1dfdd]';

  return (
    <div className="h-7 bg-[#f3f2f1] border-t border-[#d2d0ce] px-2 sm:px-3 flex items-center justify-between gap-3 text-[11.5px] text-[#323130] shrink-0 select-none no-print">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {settings.view === 'print' && <span className="whitespace-nowrap">Page {currentPage} of {pageCount}</span>}
        <span className="truncate whitespace-nowrap">
          {selectedWords > 0 ? `${selectedWords.toLocaleString()} of ${wordCount.toLocaleString()} words` : `${wordCount.toLocaleString()} ${wordCount === 1 ? 'word' : 'words'}`}
        </span>
        <span className="hidden md:inline text-[#605e5c]">English (Ghana)</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={`${btn} ${settings.view === 'print' ? 'bg-[#e1dfdd]' : ''}`}
          onClick={() => onSettingsChange({ view: 'print' })}
          aria-label="Print Layout"
          title="Print Layout"
        >
          <FileText size={13} />
        </button>
        <button
          type="button"
          className={`${btn} ${settings.view === 'web' ? 'bg-[#e1dfdd]' : ''}`}
          onClick={() => onSettingsChange({ view: 'web' })}
          aria-label="Web Layout"
          title="Web Layout"
        >
          <Eye size={13} />
        </button>
        <span className="w-px h-4 bg-[#c8c6c4] mx-1" />
        <button type="button" className={btn} onClick={() => setZoom(settings.zoom - 10)} aria-label="Zoom out" title="Zoom out"><Minus size={13} /></button>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={5}
          value={settings.zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="hidden sm:block w-28 accent-[#605e5c] cursor-pointer"
        />
        <button type="button" className={btn} onClick={() => setZoom(settings.zoom + 10)} aria-label="Zoom in" title="Zoom in"><Plus size={13} /></button>
        <button type="button" onClick={() => setZoom(100)} className="w-10 text-right tabular-nums hover:underline" title="Reset zoom to 100%">
          {settings.zoom}%
        </button>
      </div>
    </div>
  );
}
