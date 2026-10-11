import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { SYMBOLS } from './constants';

/** A labelled section of a ribbon tab ("Font", "Paragraph", …). */
export function RibbonGroup({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={`flex flex-col shrink-0 px-2 border-r border-[#e1dfdd] last:border-r-0 ${className}`}>
      <div className="flex-1 flex items-start gap-0.5 pt-1">{children}</div>
      <div className="text-[10.5px] text-[#605e5c] text-center leading-none pt-1 pb-0.5 select-none whitespace-nowrap">{label}</div>
    </div>
  );
}

const FADE = '24px';

/**
 * A sideways-scrolling row that fades whichever edge has more content behind
 * it, so on a phone it's clear the ribbon continues. `watch` re-measures when
 * the content changes (e.g. switching ribbon tabs).
 */
export function ScrollRow({ className = '', children, watch, ...rest }: {
  className?: string;
  children: ReactNode;
  watch?: unknown;
} & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [watch]);

  const mask = edges.left && edges.right
    ? `linear-gradient(to right, transparent, #000 ${FADE}, #000 calc(100% - ${FADE}), transparent)`
    : edges.right
      ? `linear-gradient(to right, #000 calc(100% - ${FADE}), transparent)`
      : edges.left
        ? `linear-gradient(to right, transparent, #000 ${FADE})`
        : undefined;

  return (
    <div ref={ref} className={className} style={{ maskImage: mask, WebkitMaskImage: mask }} {...rest}>
      {children}
    </div>
  );
}

/** Stack rows of small controls inside a group. */
export function RibbonRows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-0.5">{children}</div>;
}

export function RibbonRow({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

interface ButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

/** Big icon-over-label button (Paste, Table, Page Break…). */
export function LargeButton({ icon, label, onClick, active, disabled, shortcut, caret }: ButtonProps & { caret?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={active}
      className={`flex flex-col items-center justify-start gap-1 w-[58px] min-h-[66px] px-1 pt-1.5 pb-1 rounded text-[11px] leading-tight text-[#252423] transition
        ${active ? 'bg-[#c7e0f4]' : 'hover:bg-[#edebe9]'} disabled:opacity-40 disabled:hover:bg-transparent`}
    >
      <span className="text-[#2b579a] [&_svg]:w-[26px] [&_svg]:h-[26px]">{icon}</span>
      <span className="text-center">
        {label}
        {caret && <ChevronDown size={10} className="inline ml-0.5 -mt-0.5" />}
      </span>
    </button>
  );
}

/** Small square icon button (Bold, Align left…). */
export function SmallButton({ icon, label, onClick, active, disabled, shortcut, text }: ButtonProps & { text?: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      className={`h-[26px] ${text ? 'px-1.5 gap-1' : 'w-[26px]'} inline-flex items-center justify-center rounded text-[12px] text-[#252423] transition
        ${active ? 'bg-[#c7e0f4] text-[#1b3a6b]' : 'hover:bg-[#edebe9]'} disabled:opacity-40 disabled:hover:bg-transparent
        [&_svg]:w-[15px] [&_svg]:h-[15px]`}
    >
      {icon}
      {text && <span className="whitespace-nowrap">{text}</span>}
    </button>
  );
}

const VIEWPORT_GUTTER = 8;

/**
 * A floating panel anchored to a trigger; closes on outside click or Escape.
 * Rendered into <body> with fixed positioning: the ribbon scrolls sideways on
 * small screens, and an absolutely positioned panel inside it would be clipped.
 */
export function Popover({
  trigger, children, align = 'left', panelClassName = '',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Place the panel under the trigger, kept inside the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = ref.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const width = panel.offsetWidth;
      const preferred = align === 'right' ? anchor.right - width : anchor.left;
      const maxLeft = window.innerWidth - width - VIEWPORT_GUTTER;
      setPos({ top: anchor.bottom + 4, left: Math.max(VIEWPORT_GUTTER, Math.min(preferred, maxLeft)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    setPos(null);
    setOpen((o) => !o);
  };

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle })}
      {open && createPortal(
        <div
          ref={panelRef}
          role="menu"
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            visibility: pos ? 'visible' : 'hidden',
            maxWidth: `calc(100vw - ${VIEWPORT_GUTTER * 2}px)`,
            maxHeight: pos ? `calc(100vh - ${pos.top + VIEWPORT_GUTTER}px)` : undefined,
          }}
          className={`z-[60] overflow-auto bg-white border border-[#c8c6c4] rounded shadow-[0_6px_16px_rgba(0,0,0,0.18)] ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Dropdown list (font family, styles, margins…). */
export function SelectMenu<T extends string>({
  value, options, onChange, label, width = 'w-[150px]', renderValue, renderOption, small,
}: {
  value: T;
  options: { value: T; label: string; detail?: string }[];
  onChange: (value: T) => void;
  label: string;
  width?: string;
  renderValue?: (label: string) => ReactNode;
  renderOption?: (opt: { value: T; label: string; detail?: string }) => ReactNode;
  small?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Popover
      panelClassName="py-1 max-h-[320px] overflow-y-auto"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggle}
          title={label}
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`${width} ${small ? 'h-[24px]' : 'h-[26px]'} flex items-center justify-between gap-1 px-1.5 bg-white border border-[#8a8886] rounded-sm text-[12px] text-[#252423] hover:border-[#323130]`}
        >
          <span className="truncate text-left">{renderValue ? renderValue(current?.label ?? value) : current?.label ?? value}</span>
          <ChevronDown size={12} className="shrink-0 text-[#605e5c]" />
        </button>
      )}
    >
      {(close) => (
        <ul role="listbox" aria-label={label}>
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(opt.value); close(); }}
                className={`w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-[#edebe9] whitespace-nowrap ${opt.value === value ? 'bg-[#deecf9]' : ''}`}
              >
                {renderOption ? renderOption(opt) : (
                  <>
                    <span className="block text-[#252423]">{opt.label}</span>
                    {opt.detail && <span className="block text-[11px] text-[#605e5c]">{opt.detail}</span>}
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}



/** Word-style split button: main part applies the last colour, the arrow opens the palette. */
export function ColorSplitButton({
  label, icon, color, colors, onApply, onClear, clearLabel,
}: {
  label: string;
  icon: ReactNode;
  color: string;
  colors: string[];
  onApply: (color: string) => void;
  onClear: () => void;
  clearLabel: string;
}) {
  return (
    <div className="flex items-center rounded hover:bg-[#edebe9]">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onApply(color)}
        title={label}
        aria-label={label}
        className="h-[26px] w-[24px] flex flex-col items-center justify-center rounded-l [&_svg]:w-[14px] [&_svg]:h-[14px]"
      >
        {icon}
        <span className="block w-[16px] h-[3px] mt-[1px]" style={{ backgroundColor: color }} />
      </button>
      <Popover
        panelClassName="p-2 w-[236px]"
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggle}
            aria-label={`${label} options`}
            aria-expanded={open}
            className="h-[26px] w-[12px] flex items-center justify-center rounded-r hover:bg-[#e1dfdd]"
          >
            <ChevronDown size={10} />
          </button>
        )}
      >
        {(close) => (
          <div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onClear(); close(); }}
              className="w-full text-left text-[12px] px-2 py-1 mb-1.5 rounded hover:bg-[#edebe9]"
            >
              {clearLabel}
            </button>
            <div className="grid grid-cols-10 gap-[3px]">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onApply(c); close(); }}
                  title={c}
                  aria-label={`Colour ${c}`}
                  className="w-[19px] h-[19px] border border-[#c8c6c4] hover:outline hover:outline-2 hover:outline-[#f2c811]"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        )}
      </Popover>
    </div>
  );
}

/** Hover grid for "Insert Table", like Word's. */
export function TableGridPicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ r: 0, c: 0 });
  const ROWS = 8;
  const COLS = 10;
  return (
    <div className="p-2">
      <p className="text-[12px] text-[#252423] mb-1.5 h-4">
        {hover.r && hover.c ? `${hover.c} × ${hover.r} Table` : 'Insert Table'}
      </p>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${COLS}, 16px)` }} onMouseLeave={() => setHover({ r: 0, c: 0 })}>
        {Array.from({ length: ROWS * COLS }).map((_, i) => {
          const r = Math.floor(i / COLS) + 1;
          const c = (i % COLS) + 1;
          const on = r <= hover.r && c <= hover.c;
          return (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHover({ r, c })}
              onFocus={() => setHover({ r, c })}
              onClick={() => onPick(r, c)}
              aria-label={`Insert ${c} by ${r} table`}
              className={`w-4 h-4 border ${on ? 'bg-[#c7e0f4] border-[#2b579a]' : 'bg-white border-[#c8c6c4]'}`}
            />
          );
        })}
      </div>
    </div>
  );
}


export function SymbolGrid({ onPick }: { onPick: (symbol: string) => void }) {
  return (
    <div className="p-2">
      <p className="text-[12px] text-[#252423] mb-1.5">Symbols</p>
      <div className="grid grid-cols-10 gap-[2px]">
        {SYMBOLS.map((s) => (
          <button
            key={s}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(s)}
            title={s}
            aria-label={`Insert ${s}`}
            className="w-[26px] h-[26px] border border-[#e1dfdd] text-[15px] hover:bg-[#deecf9] hover:border-[#2b579a]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
