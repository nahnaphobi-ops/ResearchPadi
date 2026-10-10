/** Page geometry for the Word-style editor. All lengths are CSS px at 96 dpi. */

export const PX_PER_CM = 96 / 2.54;
export const cm = (value: number) => Math.round(value * PX_PER_CM);

export type PageSizeKey = 'a4' | 'letter' | 'legal';
export type Orientation = 'portrait' | 'landscape';
export type MarginKey = 'normal' | 'narrow' | 'moderate' | 'wide';
export type ViewMode = 'print' | 'web';

export const PAGE_SIZES: Record<PageSizeKey, { label: string; detail: string; width: number; height: number; css: string }> = {
  a4: { label: 'A4', detail: '21 cm × 29.7 cm', width: cm(21), height: cm(29.7), css: 'A4' },
  letter: { label: 'Letter', detail: '21.59 cm × 27.94 cm', width: cm(21.59), height: cm(27.94), css: 'letter' },
  legal: { label: 'Legal', detail: '21.59 cm × 35.56 cm', width: cm(21.59), height: cm(35.56), css: 'legal' },
};

export const MARGINS: Record<MarginKey, { label: string; detail: string; top: number; bottom: number; left: number; right: number }> = {
  normal: { label: 'Normal', detail: 'Top/Bottom 2.54 cm · Left/Right 2.54 cm', top: cm(2.54), bottom: cm(2.54), left: cm(2.54), right: cm(2.54) },
  narrow: { label: 'Narrow', detail: 'All sides 1.27 cm', top: cm(1.27), bottom: cm(1.27), left: cm(1.27), right: cm(1.27) },
  moderate: { label: 'Moderate', detail: 'Top/Bottom 2.54 cm · Left/Right 1.91 cm', top: cm(2.54), bottom: cm(2.54), left: cm(1.91), right: cm(1.91) },
  wide: { label: 'Wide', detail: 'Top/Bottom 2.54 cm · Left/Right 5.08 cm', top: cm(2.54), bottom: cm(2.54), left: cm(5.08), right: cm(5.08) },
};

export interface PageSettings {
  size: PageSizeKey;
  orientation: Orientation;
  margins: MarginKey;
  zoom: number; // percent
  showRuler: boolean;
  showMarks: boolean;
  spellcheck: boolean;
  view: ViewMode;
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  size: 'a4',
  orientation: 'portrait',
  margins: 'normal',
  zoom: 100,
  showRuler: true,
  showMarks: false,
  spellcheck: true,
  view: 'print',
};

export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;

export function pageDimensions(settings: Pick<PageSettings, 'size' | 'orientation'>) {
  const { width, height } = PAGE_SIZES[settings.size];
  return settings.orientation === 'portrait' ? { width, height } : { width: height, height: width };
}

const STORAGE_KEY = 'rp-page-settings';

/** Page settings are a per-viewer convenience, so browser storage is fine (and optional). */
export function loadPageSettings(): PageSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PAGE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PageSettings>;
    return {
      ...DEFAULT_PAGE_SETTINGS,
      ...parsed,
      size: parsed.size && parsed.size in PAGE_SIZES ? parsed.size : DEFAULT_PAGE_SETTINGS.size,
      margins: parsed.margins && parsed.margins in MARGINS ? parsed.margins : DEFAULT_PAGE_SETTINGS.margins,
      zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(parsed.zoom) || 100)),
    };
  } catch {
    return DEFAULT_PAGE_SETTINGS;
  }
}

export function savePageSettings(settings: PageSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode); settings still work for this visit.
  }
}
