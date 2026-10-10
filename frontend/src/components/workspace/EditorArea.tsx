import { useEffect, useRef, useState, type RefObject } from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import { MARGINS, PX_PER_CM, pageDimensions, type PageSettings } from './pageLayout';

interface Props {
  editor: Editor | null;
  settings: PageSettings;
  onPageMetrics: (metrics: { pageCount: number; currentPage: number }) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  children?: React.ReactNode; // overlays such as Find & Replace
}

/** Horizontal ruler in centimetres with the margins shaded, like Word's. */
function HorizontalRuler({ width, left, right }: { width: number; left: number; right: number }) {
  const totalCm = Math.floor(width / PX_PER_CM);
  const ticks = [];
  for (let half = 0; half <= totalCm * 2; half++) {
    const x = (half / 2) * PX_PER_CM;
    const whole = half % 2 === 0;
    const label = whole ? Math.round(Math.abs(x - left) / PX_PER_CM) : null;
    ticks.push(
      <div key={half} className="absolute bottom-0" style={{ left: x }}>
        <div className={`w-px bg-[#8a8886] ${whole ? 'h-[6px]' : 'h-[3px]'}`} />
        {whole && label !== 0 && x > 4 && x < width - 4 && (
          <span className="absolute -translate-x-1/2 bottom-[7px] text-[8.5px] text-[#605e5c] select-none">{label}</span>
        )}
      </div>
    );
  }
  return (
    <div className="relative h-[20px] bg-white border border-[#c8c6c4] mb-2 overflow-hidden no-print" style={{ width }} aria-hidden="true">
      <div className="absolute inset-y-0 left-0 bg-[#e1dfdd]" style={{ width: left }} />
      <div className="absolute inset-y-0 right-0 bg-[#e1dfdd]" style={{ width: right }} />
      {ticks}
      <div className="absolute top-0 w-0 h-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-[#605e5c]" style={{ left: left - 5 }} />
      <div className="absolute top-0 w-0 h-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-[#605e5c]" style={{ left: width - right - 5 }} />
    </div>
  );
}

export const EditorArea: React.FC<Props> = ({ editor, settings, onPageMetrics, scrollRef, children }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const { width, height } = pageDimensions(settings);
  const margins = MARGINS[settings.margins];
  const contentHeight = height - margins.top - margins.bottom;
  const isPrint = settings.view === 'print';
  const scale = settings.zoom / 100;

  // Lay the flowing content out into pages: a page ends when it fills up or at a manual
  // page break. pageStarts are offsets (px, unzoomed) from the top of the text area.
  const [layout, setLayout] = useState<{ pageStarts: number[]; autoBreaks: number[]; end: number }>({ pageStarts: [0], autoBreaks: [], end: 0 });

  useEffect(() => {
    const sheet = sheetRef.current;
    const scroller = scrollRef.current;
    if (!sheet || !scroller || !isPrint) {
      setLayout({ pageStarts: [0], autoBreaks: [], end: 0 });
      onPageMetrics({ pageCount: 1, currentPage: 1 });
      return;
    }
    const content = sheet.querySelector('.ProseMirror') as HTMLElement | null;
    if (!content) return;

    let pageStarts: number[] = [0];

    const paginate = () => {
      const starts = [0];
      const autoBreaks: number[] = [];
      let pageStart = 0;
      const origin = content.offsetTop; // children are measured from the sheet, which includes the top margin
      for (const child of Array.from(content.children) as HTMLElement[]) {
        const top = child.offsetTop - origin;
        const bottom = top + child.offsetHeight;
        if (child.classList.contains('page-break')) {
          pageStart = bottom;
          starts.push(pageStart);
          continue;
        }
        while (bottom - pageStart > contentHeight) {
          pageStart += contentHeight;
          starts.push(pageStart);
          autoBreaks.push(pageStart);
        }
      }
      pageStarts = starts;
      setLayout({ pageStarts: starts, autoBreaks, end: Math.max(content.scrollHeight, starts[starts.length - 1] + contentHeight) });
      updateCurrent();
    };

    const updateCurrent = () => {
      const sheetTop = sheet.offsetTop * scale;
      const viewY = (scroller.scrollTop + scroller.clientHeight / 3 - sheetTop) / scale - margins.top;
      let current = 1;
      pageStarts.forEach((start, i) => { if (viewY >= start) current = i + 1; });
      onPageMetrics({ pageCount: pageStarts.length, currentPage: current });
    };

    paginate();
    const ro = new ResizeObserver(paginate);
    ro.observe(content);
    scroller.addEventListener('scroll', updateCurrent, { passive: true });
    return () => {
      ro.disconnect();
      scroller.removeEventListener('scroll', updateCurrent);
    };
  }, [contentHeight, margins.top, scale, isPrint, scrollRef, onPageMetrics, editor]);

  const lastStart = layout.pageStarts[layout.pageStarts.length - 1];
  const sheetHeight = margins.top + Math.max(layout.end, lastStart + contentHeight) + margins.bottom;

  return (
    <div className="flex-1 min-w-0 relative flex flex-col overflow-hidden">
      {children}
      <div ref={scrollRef} className="flex-1 overflow-auto bg-[#e7e6e6] print-scroll">
        <div className="min-w-fit py-4 sm:py-6 px-2 sm:px-6 flex justify-center">
          <div style={{ zoom: scale }} className="print-zoom-reset">
            {isPrint && settings.showRuler && <HorizontalRuler width={width} left={margins.left} right={margins.right} />}
            <div
              ref={sheetRef}
              className={`relative bg-white print-page ${isPrint ? 'shadow-[0_0_0_1px_#d2d0ce,0_2px_8px_rgba(0,0,0,0.12)]' : 'border border-[#d2d0ce]'}`}
              style={isPrint
                ? {
                    width,
                    minHeight: sheetHeight,
                    ['--page-margin-left' as string]: `${margins.left}px`,
                    ['--page-margin-right' as string]: `${margins.right}px`,
                    ['--page-margin-top' as string]: `${margins.top}px`,
                    ['--page-margin-bottom' as string]: `${margins.bottom}px`,
                  }
                : { width: 'min(1100px, calc(100vw - 48px))', minHeight: 600, ['--page-margin-left' as string]: '48px', ['--page-margin-right' as string]: '48px', ['--page-margin-top' as string]: '24px', ['--page-margin-bottom' as string]: '24px' }}
            >
              {/* Page boundary markers: content flows continuously; these show where each page ends. */}
              {isPrint && layout.autoBreaks.map((y) => (
                <div
                  key={y}
                  className="absolute left-0 right-0 pointer-events-none no-print"
                  style={{ top: margins.top + y }}
                  aria-hidden="true"
                >
                  <div className="border-t border-dashed border-[#a19f9d]" />
                  <span className="absolute right-2 -top-[9px] bg-white px-1 text-[9px] uppercase tracking-wider text-[#a19f9d]">
                    Page {layout.pageStarts.indexOf(y) + 1}
                  </span>
                </div>
              ))}
              <EditorContent
                editor={editor}
                className={`word-doc ${settings.showMarks ? 'show-marks' : ''}`}
                style={isPrint
                  ? { paddingTop: margins.top, paddingBottom: margins.bottom, paddingLeft: margins.left, paddingRight: margins.right }
                  : { padding: '40px 48px' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
