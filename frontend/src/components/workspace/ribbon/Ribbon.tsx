import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import type { Mark } from '@tiptap/pm/model';
import {
  AArrowDown, AArrowUp, ArrowLeft, Baseline, BookMarked, BookOpen, CalendarDays, CaseSensitive, ChevronDown, ChevronUp,
  ClipboardPaste, Copy, Eye, FileDown, FileText, Highlighter, Image as ImageIcon, IndentDecrease, IndentIncrease,
  Link as LinkIcon, List, ListChecks, ListOrdered, ListTree, Minus, Omega, PaintBucket, PanelRight, Pilcrow, Printer, Quote,
  RectangleHorizontal, RectangleVertical, RemoveFormatting, Replace, Ruler, Save, Scissors, Search, SeparatorHorizontal,
  Sparkles, SpellCheck, SquareCode, Strikethrough, Subscript, Superscript, Table, TextAlignCenter, TextAlignEnd,
  TextAlignJustify, TextAlignStart, TextCursorInput, Underline, Bold, Italic, Columns2, ZoomIn, Maximize2,
} from 'lucide-react';
import {
  ColorSplitButton, LargeButton, Popover, RibbonGroup, RibbonRow, RibbonRows, SelectMenu, SmallButton,
  SymbolGrid, TableGridPicker,
} from './controls';
import { HIGHLIGHT_COLORS, TEXT_COLORS } from './constants';
import { changeCase } from '../search';
import { CITATION_STYLES } from '../citations/format';
import { getCitationStyle, getCitedSources, hasBibliography } from '../citations/CitationExtension';
import type { CitationStyleId } from '../citations/types';
import { MARGINS, PAGE_SIZES, type MarginKey, type PageSettings, type PageSizeKey } from '../pageLayout';

type Tab = 'file' | 'home' | 'insert' | 'layout' | 'references' | 'review' | 'view';

const TABS: { key: Tab; label: string }[] = [
  { key: 'file', label: 'File' },
  { key: 'home', label: 'Home' },
  { key: 'insert', label: 'Insert' },
  { key: 'layout', label: 'Layout' },
  { key: 'references', label: 'References' },
  { key: 'review', label: 'Review' },
  { key: 'view', label: 'View' },
];

const FONT_FAMILIES = [
  'Times New Roman', 'Calibri', 'Arial', 'Cambria', 'Georgia', 'Garamond', 'Book Antiqua',
  'Palatino Linotype', 'Century Gothic', 'Helvetica', 'Tahoma', 'Trebuchet MS', 'Verdana', 'Courier New',
];

const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

const LINE_SPACINGS = ['1', '1.15', '1.5', '2', '2.5', '3'];

const STYLES = [
  { key: 'normal', label: 'Normal', preview: 'AaBbCcDd', className: 'text-[13px]' },
  { key: 'nospacing', label: 'No Spacing', preview: 'AaBbCcDd', className: 'text-[13px]' },
  { key: 'h1', label: 'Heading 1', preview: 'AaBbCc', className: 'text-[16px] font-bold text-[#2f5496]' },
  { key: 'h2', label: 'Heading 2', preview: 'AaBbCcD', className: 'text-[14px] font-bold text-[#2f5496]' },
  { key: 'h3', label: 'Heading 3', preview: 'AaBbCcD', className: 'text-[13px] font-bold text-[#1f3763]' },
  { key: 'h4', label: 'Heading 4', preview: 'AaBbCcD', className: 'text-[13px] font-bold italic text-[#2f5496]' },
  { key: 'title', label: 'Title', preview: 'AaBb', className: 'text-[19px] font-light' },
  { key: 'quote', label: 'Quote', preview: 'AaBbCcD', className: 'text-[13px] italic text-[#404040]' },
] as const;

type StyleKey = typeof STYLES[number]['key'];

/** Read a stored font size ("12pt" or legacy "16px") as points. */
function toPoints(size: string | undefined | null): number | null {
  if (!size) return null;
  const n = parseFloat(size);
  if (Number.isNaN(n)) return null;
  return size.endsWith('px') ? Math.round(n * 0.75 * 2) / 2 : n;
}

function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export interface RibbonProps {
  editor: Editor;
  settings: PageSettings;
  onSettingsChange: (patch: Partial<PageSettings>) => void;
  pageCount: number;
  onSave: () => void;
  onExportDocx: () => void;
  onPrint: () => void;
  onInsertToc: () => void;
  onOpenFind: (mode: 'find' | 'replace') => void;
  onOpenPanel: (panel: 'ai' | 'citations') => void;
  onTogglePanel: () => void;
  onFitWidth: () => void;
  onBack: () => void;
  notify: (message: string) => void;
  lastSaved: Date | null;
}

export default function Ribbon(props: RibbonProps) {
  const { editor, settings, onSettingsChange } = props;
  const [tab, setTab] = useState<Tab>('home');
  const [collapsed, setCollapsed] = useState(false);
  const [painterMarks, setPainterMarks] = useState<Mark[] | null>(null);
  const [fontColor, setFontColor] = useState('#c00000');
  const [highlightColor, setHighlightColor] = useState('#ffff00');

  // Re-render the ribbon whenever selection/formatting changes, not just on typing.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const textStyle = e.getAttributes('textStyle');
      const blockType = e.isActive('heading') ? 'heading' : 'paragraph';
      return {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        subscript: e.isActive('subscript'),
        superscript: e.isActive('superscript'),
        fontFamily: (textStyle.fontFamily as string | undefined)?.replace(/['"]/g, '') || 'Times New Roman',
        fontSize: toPoints(textStyle.fontSize as string | undefined) ?? 12,
        align: (['left', 'center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
        bulletList: e.isActive('bulletList'),
        orderedList: e.isActive('orderedList'),
        taskList: e.isActive('taskList'),
        heading: e.isActive('heading') ? Number(e.getAttributes('heading').level) : 0,
        blockquote: e.isActive('blockquote'),
        codeBlock: e.isActive('codeBlock'),
        link: e.isActive('link'),
        linkHref: (e.getAttributes('link').href as string | undefined) ?? '',
        lineHeight: String(e.getAttributes(blockType).lineHeight ?? '1.5'),
        table: e.isActive('table'),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        hasSelection: !e.state.selection.empty,
        citationStyle: getCitationStyle(e.state),
        citedCount: getCitedSources(e.state).length,
        hasBibliography: hasBibliography(e.state) !== null,
      };
    },
  });

  // Format Painter: copy marks from the selection, apply them to the next selection made with the mouse.
  useEffect(() => {
    if (!painterMarks) return;
    const dom = editor.view.dom;
    const onUp = () => {
      window.setTimeout(() => {
        if (editor.state.selection.empty) return;
        let chain = editor.chain().focus().unsetAllMarks();
        for (const mark of painterMarks) chain = chain.setMark(mark.type.name, mark.attrs);
        chain.run();
        setPainterMarks(null);
      }, 0);
    };
    dom.classList.add('format-painter');
    dom.addEventListener('mouseup', onUp);
    return () => {
      dom.classList.remove('format-painter');
      dom.removeEventListener('mouseup', onUp);
    };
  }, [painterMarks, editor]);

  const chain = () => editor.chain().focus();

  const applyStyle = (key: StyleKey) => {
    switch (key) {
      case 'normal': chain().setParagraph().setTextAlign('left').setParagraphLineHeight('1.5').setSpaceAfter(null).run(); break;
      case 'nospacing': chain().setParagraph().setParagraphLineHeight('1').setSpaceAfter('0pt').run(); break;
      case 'h1': chain().setHeading({ level: 1 }).run(); break;
      case 'h2': chain().setHeading({ level: 2 }).run(); break;
      case 'h3': chain().setHeading({ level: 3 }).run(); break;
      case 'h4': chain().setHeading({ level: 4 }).run(); break;
      case 'title': chain().setHeading({ level: 1 }).setTextAlign('center').run(); break;
      case 'quote': chain().setParagraph().toggleBlockquote().run(); break;
    }
  };

  const activeStyle: StyleKey | null =
    state.blockquote ? 'quote'
      : state.heading === 1 && state.align === 'center' ? 'title'
        : state.heading ? (`h${state.heading}` as StyleKey)
          : state.lineHeight === '1' ? 'nospacing'
            : 'normal';

  const stepFontSize = (dir: 1 | -1) => {
    const cur = state.fontSize;
    const next = dir > 0 ? FONT_SIZES.find((s) => s > cur) ?? cur + 10 : [...FONT_SIZES].reverse().find((s) => s < cur) ?? Math.max(1, cur - 1);
    chain().setFontSize(`${next}pt`).run();
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) chain().insertContent(text).run();
    } catch {
      props.notify('Your browser blocked clipboard access. Press Ctrl+V to paste.');
    }
  };

  const clipboardCommand = (cmd: 'cut' | 'copy') => {
    editor.commands.focus();
    // execCommand is deprecated but is still the only way to cut/copy a rich selection from a button.
    const ok = document.execCommand(cmd);
    if (!ok) props.notify(`Press Ctrl+${cmd === 'cut' ? 'X' : 'C'} to ${cmd}.`);
  };

  const groupsByTab: Record<Tab, ReactNode> = {
    file: (
      <>
        <RibbonGroup label="Document">
          <LargeButton icon={<Save />} label="Save" shortcut="Ctrl+S" onClick={props.onSave} />
          <LargeButton icon={<FileDown />} label="Download .docx" onClick={props.onExportDocx} />
          <LargeButton icon={<Printer />} label="Print" shortcut="Ctrl+P" onClick={props.onPrint} />
        </RibbonGroup>
        <RibbonGroup label="Info">
          <div className="px-2 pt-1 text-[12px] text-[#323130] leading-5 min-w-[170px]">
            <p>{props.pageCount} {props.pageCount === 1 ? 'page' : 'pages'}</p>
            <p>{props.lastSaved ? `Saved ${props.lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not saved yet this visit'}</p>
            <p>Auto-saves every 30 seconds</p>
          </div>
        </RibbonGroup>
        <RibbonGroup label="Close">
          <LargeButton icon={<ArrowLeft />} label="Back to workspace" onClick={props.onBack} />
        </RibbonGroup>
      </>
    ),

    home: (
      <>
        <RibbonGroup label="Clipboard">
          <LargeButton icon={<ClipboardPaste />} label="Paste" shortcut="Ctrl+V" onClick={paste} />
          <RibbonRows>
            <SmallButton icon={<Scissors />} label="Cut" shortcut="Ctrl+X" text="Cut" onClick={() => clipboardCommand('cut')} disabled={!state.hasSelection} />
            <SmallButton icon={<Copy />} label="Copy" shortcut="Ctrl+C" text="Copy" onClick={() => clipboardCommand('copy')} disabled={!state.hasSelection} />
            <SmallButton
              icon={<PaintBucket />}
              label={painterMarks ? 'Format Painter (select text to apply)' : 'Format Painter'}
              text="Format Painter"
              active={!!painterMarks}
              onClick={() => {
                if (painterMarks) { setPainterMarks(null); return; }
                const { $from } = editor.state.selection;
                setPainterMarks([...(editor.state.storedMarks ?? $from.marks())]);
                props.notify('Format Painter on — select text to copy the formatting to it.');
              }}
            />
          </RibbonRows>
        </RibbonGroup>

        <RibbonGroup label="Font">
          <RibbonRows>
            <RibbonRow>
              <SelectMenu
                label="Font"
                value={state.fontFamily}
                options={(FONT_FAMILIES.includes(state.fontFamily) ? FONT_FAMILIES : [state.fontFamily, ...FONT_FAMILIES]).map((f) => ({ value: f, label: f }))}
                onChange={(f) => chain().setFontFamily(f).run()}
                renderValue={(label) => <span style={{ fontFamily: label }}>{label}</span>}
                renderOption={(o) => <span style={{ fontFamily: o.value }} className="text-[14px]">{o.label}</span>}
                width="w-[150px]"
              />
              <FontSizeBox value={state.fontSize} onChange={(pt) => chain().setFontSize(`${pt}pt`).run()} />
              <SmallButton icon={<AArrowUp />} label="Grow Font" shortcut="Ctrl+]" onClick={() => stepFontSize(1)} />
              <SmallButton icon={<AArrowDown />} label="Shrink Font" shortcut="Ctrl+[" onClick={() => stepFontSize(-1)} />
              <Popover
                panelClassName="py-1 w-[200px]"
                trigger={({ toggle, open }) => (
                  <SmallButton icon={<CaseSensitive />} label="Change Case" onClick={toggle} active={open} disabled={!state.hasSelection} />
                )}
              >
                {(close) => (
                  <div>
                    {([
                      ['sentence', 'Sentence case.'],
                      ['lower', 'lowercase'],
                      ['upper', 'UPPERCASE'],
                      ['title', 'Capitalise Each Word'],
                      ['toggle', 'tOGGLE cASE'],
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { changeCase(editor, mode); close(); }}
                        className="w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-[#edebe9]"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </Popover>
              <SmallButton icon={<RemoveFormatting />} label="Clear All Formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()} />
            </RibbonRow>
            <RibbonRow>
              <SmallButton icon={<Bold />} label="Bold" shortcut="Ctrl+B" active={state.bold} onClick={() => chain().toggleBold().run()} />
              <SmallButton icon={<Italic />} label="Italic" shortcut="Ctrl+I" active={state.italic} onClick={() => chain().toggleItalic().run()} />
              <SmallButton icon={<Underline />} label="Underline" shortcut="Ctrl+U" active={state.underline} onClick={() => chain().toggleUnderline().run()} />
              <SmallButton icon={<Strikethrough />} label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()} />
              <SmallButton icon={<Subscript />} label="Subscript" shortcut="Ctrl+=" active={state.subscript} onClick={() => chain().toggleSubscript().run()} />
              <SmallButton icon={<Superscript />} label="Superscript" shortcut="Ctrl+Shift+=" active={state.superscript} onClick={() => chain().toggleSuperscript().run()} />
              <span className="w-px h-5 bg-[#e1dfdd] mx-0.5" />
              <ColorSplitButton
                label="Text Highlight Colour"
                icon={<Highlighter />}
                color={highlightColor}
                colors={HIGHLIGHT_COLORS}
                onApply={(c) => { setHighlightColor(c); chain().setHighlight({ color: c }).run(); }}
                onClear={() => chain().unsetHighlight().run()}
                clearLabel="No Colour"
              />
              <ColorSplitButton
                label="Font Colour"
                icon={<Baseline />}
                color={fontColor}
                colors={TEXT_COLORS}
                onApply={(c) => { setFontColor(c); chain().setColor(c).run(); }}
                onClear={() => chain().unsetColor().run()}
                clearLabel="Automatic"
              />
            </RibbonRow>
          </RibbonRows>
        </RibbonGroup>

        <RibbonGroup label="Paragraph">
          <RibbonRows>
            <RibbonRow>
              <SmallButton icon={<List />} label="Bullets" active={state.bulletList} onClick={() => chain().toggleBulletList().run()} />
              <SmallButton icon={<ListOrdered />} label="Numbering" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()} />
              <SmallButton icon={<ListChecks />} label="Checklist" active={state.taskList} onClick={() => chain().toggleTaskList().run()} />
              <span className="w-px h-5 bg-[#e1dfdd] mx-0.5" />
              <SmallButton icon={<IndentDecrease />} label="Decrease Indent" shortcut="Shift+Tab" onClick={() => chain().outdent().run()} />
              <SmallButton icon={<IndentIncrease />} label="Increase Indent" shortcut="Tab" onClick={() => chain().indent().run()} />
              <span className="w-px h-5 bg-[#e1dfdd] mx-0.5" />
              <SmallButton icon={<Pilcrow />} label="Show/Hide ¶" active={settings.showMarks} onClick={() => onSettingsChange({ showMarks: !settings.showMarks })} />
            </RibbonRow>
            <RibbonRow>
              <SmallButton icon={<TextAlignStart />} label="Align Left" shortcut="Ctrl+L" active={state.align === 'left'} onClick={() => chain().setTextAlign('left').run()} />
              <SmallButton icon={<TextAlignCenter />} label="Center" shortcut="Ctrl+E" active={state.align === 'center'} onClick={() => chain().setTextAlign('center').run()} />
              <SmallButton icon={<TextAlignEnd />} label="Align Right" shortcut="Ctrl+R" active={state.align === 'right'} onClick={() => chain().setTextAlign('right').run()} />
              <SmallButton icon={<TextAlignJustify />} label="Justify" shortcut="Ctrl+J" active={state.align === 'justify'} onClick={() => chain().setTextAlign('justify').run()} />
              <span className="w-px h-5 bg-[#e1dfdd] mx-0.5" />
              <LineSpacingMenu value={state.lineHeight} editor={editor} />
              <SmallButton icon={<Quote />} label="Quote" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()} />
            </RibbonRow>
          </RibbonRows>
        </RibbonGroup>

        <RibbonGroup label="Styles">
          <div className="flex gap-1 max-w-[460px] overflow-x-auto pb-0.5">
            {STYLES.map((s) => (
              <button
                key={s.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyStyle(s.key)}
                aria-pressed={activeStyle === s.key}
                title={s.label}
                className={`shrink-0 w-[70px] h-[56px] flex flex-col items-start justify-between px-1.5 py-1 border rounded-sm bg-white text-left
                  ${activeStyle === s.key ? 'border-[#2b579a] bg-[#deecf9] shadow-[inset_0_0_0_1px_#2b579a]' : 'border-[#e1dfdd] hover:border-[#8a8886]'}`}
              >
                <span className={`${s.className} leading-tight truncate w-full`} style={{ fontFamily: s.key.startsWith('h') || s.key === 'title' ? 'Calibri Light, Calibri, sans-serif' : 'Calibri, sans-serif' }}>{s.preview}</span>
                <span className="text-[10.5px] text-[#605e5c] truncate w-full">{s.label}</span>
              </button>
            ))}
          </div>
        </RibbonGroup>

        <RibbonGroup label="Editing">
          <RibbonRows>
            <SmallButton icon={<Search />} label="Find" shortcut="Ctrl+F" text="Find" onClick={() => props.onOpenFind('find')} />
            <SmallButton icon={<Replace />} label="Replace" shortcut="Ctrl+H" text="Replace" onClick={() => props.onOpenFind('replace')} />
            <SmallButton icon={<TextCursorInput />} label="Select All" shortcut="Ctrl+A" text="Select All" onClick={() => chain().selectAll().run()} />
          </RibbonRows>
        </RibbonGroup>

        <RibbonGroup label="Writing tools">
          <LargeButton icon={<Sparkles />} label="AI Assistant" onClick={() => props.onOpenPanel('ai')} />
          <LargeButton icon={<BookOpen />} label="Citations" onClick={() => props.onOpenPanel('citations')} />
        </RibbonGroup>
      </>
    ),

    insert: (
      <>
        <RibbonGroup label="Pages">
          <LargeButton icon={<SeparatorHorizontal />} label="Page Break" shortcut="Ctrl+Enter" onClick={() => chain().setPageBreak().run()} />
        </RibbonGroup>
        <RibbonGroup label="Tables">
          <Popover
            trigger={({ toggle, open }) => <LargeButton icon={<Table />} label="Table" caret active={open} onClick={toggle} />}
          >
            {(close) => (
              <TableGridPicker onPick={(rows, cols) => { chain().insertTable({ rows, cols, withHeaderRow: true }).run(); close(); }} />
            )}
          </Popover>
          {state.table && <TableTools editor={editor} />}
        </RibbonGroup>
        <RibbonGroup label="Illustrations">
          <PictureMenu editor={editor} notify={props.notify} />
        </RibbonGroup>
        <RibbonGroup label="Links">
          <LinkMenu editor={editor} active={state.link} currentHref={state.linkHref} notify={props.notify} />
        </RibbonGroup>
        <RibbonGroup label="Text">
          <RibbonRows>
            <SmallButton icon={<Quote />} label="Quote" text="Quote" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()} />
            <SmallButton icon={<SquareCode />} label="Code block" text="Code block" active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()} />
            <SmallButton icon={<Minus />} label="Horizontal line" text="Horizontal line" onClick={() => chain().setHorizontalRule().run()} />
          </RibbonRows>
          <DateTimeMenu editor={editor} />
        </RibbonGroup>
        <RibbonGroup label="Symbols">
          <Popover
            align="right"
            trigger={({ toggle, open }) => <LargeButton icon={<Omega />} label="Symbol" caret active={open} onClick={toggle} />}
          >
            {(close) => <SymbolGrid onPick={(s) => { chain().insertContent(s).run(); close(); }} />}
          </Popover>
        </RibbonGroup>
      </>
    ),

    layout: (
      <>
        <RibbonGroup label="Page Setup">
          <Popover
            trigger={({ toggle, open }) => <LargeButton icon={<Columns2 />} label="Margins" caret active={open} onClick={toggle} />}
            panelClassName="py-1 w-[260px]"
          >
            {(close) => (
              <ul>
                {(Object.keys(MARGINS) as MarginKey[]).map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { onSettingsChange({ margins: key }); close(); }}
                      className={`w-full text-left px-3 py-2 hover:bg-[#edebe9] ${settings.margins === key ? 'bg-[#deecf9]' : ''}`}
                    >
                      <span className="block text-[12.5px] font-semibold text-[#252423]">{MARGINS[key].label}</span>
                      <span className="block text-[11px] text-[#605e5c]">{MARGINS[key].detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Popover>
          <Popover
            trigger={({ toggle, open }) => (
              <LargeButton
                icon={settings.orientation === 'portrait' ? <RectangleVertical /> : <RectangleHorizontal />}
                label="Orientation"
                caret
                active={open}
                onClick={toggle}
              />
            )}
            panelClassName="py-1 w-[160px]"
          >
            {(close) => (
              <ul>
                {(['portrait', 'landscape'] as const).map((o) => (
                  <li key={o}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { onSettingsChange({ orientation: o }); close(); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-[#edebe9] ${settings.orientation === o ? 'bg-[#deecf9]' : ''}`}
                    >
                      {o === 'portrait' ? <RectangleVertical size={18} /> : <RectangleHorizontal size={18} />}
                      {o === 'portrait' ? 'Portrait' : 'Landscape'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Popover>
          <Popover
            trigger={({ toggle, open }) => <LargeButton icon={<FileText />} label="Size" caret active={open} onClick={toggle} />}
            panelClassName="py-1 w-[210px]"
          >
            {(close) => (
              <ul>
                {(Object.keys(PAGE_SIZES) as PageSizeKey[]).map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { onSettingsChange({ size: key }); close(); }}
                      className={`w-full text-left px-3 py-2 hover:bg-[#edebe9] ${settings.size === key ? 'bg-[#deecf9]' : ''}`}
                    >
                      <span className="block text-[12.5px] font-semibold text-[#252423]">{PAGE_SIZES[key].label}</span>
                      <span className="block text-[11px] text-[#605e5c]">{PAGE_SIZES[key].detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Popover>
          <LargeButton icon={<SeparatorHorizontal />} label="Breaks" onClick={() => chain().setPageBreak().run()} shortcut="Ctrl+Enter" />
        </RibbonGroup>
        <RibbonGroup label="Paragraph">
          <RibbonRows>
            <RibbonRow>
              <span className="text-[11.5px] text-[#605e5c] w-[52px]">Indent</span>
              <SmallButton icon={<IndentDecrease />} label="Decrease Indent" onClick={() => chain().outdent().run()} />
              <SmallButton icon={<IndentIncrease />} label="Increase Indent" onClick={() => chain().indent().run()} />
            </RibbonRow>
            <RibbonRow>
              <span className="text-[11.5px] text-[#605e5c] w-[52px]">Spacing</span>
              <SelectMenu
                small
                label="Space after paragraph"
                width="w-[96px]"
                value="keep"
                options={[
                  { value: 'keep', label: 'After…' },
                  { value: '0pt', label: '0 pt' },
                  { value: '6pt', label: '6 pt' },
                  { value: '8pt', label: '8 pt' },
                  { value: '12pt', label: '12 pt' },
                  { value: '18pt', label: '18 pt' },
                ]}
                onChange={(v) => { if (v !== 'keep') chain().setSpaceAfter(v).run(); }}
              />
            </RibbonRow>
          </RibbonRows>
        </RibbonGroup>
      </>
    ),

    references: (
      <>
        <RibbonGroup label="Table of Contents">
          <LargeButton icon={<ListTree />} label="Table of Contents" onClick={props.onInsertToc} />
        </RibbonGroup>
        <RibbonGroup label="Citations & Bibliography">
          <LargeButton icon={<BookOpen />} label="Insert Citation" onClick={() => props.onOpenPanel('citations')} />
          <RibbonRows>
            <RibbonRow>
              <span className="text-[11.5px] text-[#605e5c] w-[36px]">Style</span>
              <SelectMenu
                small
                label="Citation style"
                width="w-[150px]"
                value={state.citationStyle}
                options={CITATION_STYLES.map((s) => ({ value: s.id, label: s.label }))}
                onChange={(v) => chain().setCitationStyle(v as CitationStyleId).run()}
              />
            </RibbonRow>
            <RibbonRow>
              <span className="text-[11.5px] text-[#605e5c] pl-0.5">{state.citedCount} {state.citedCount === 1 ? 'source' : 'sources'} cited</span>
            </RibbonRow>
          </RibbonRows>
          <LargeButton
            icon={<BookMarked />}
            label={state.hasBibliography ? 'Reference List ✓' : 'Bibliography'}
            disabled={state.hasBibliography}
            onClick={() => {
              if (!chain().insertBibliography().run()) props.notify('The reference list is already in your document.');
            }}
          />
        </RibbonGroup>
        <RibbonGroup label="Headings">
          <RibbonRows>
            <SmallButton icon={<span className="font-bold text-[11px]">H1</span>} label="Chapter heading" text="Chapter heading" onClick={() => applyStyle('h1')} />
            <SmallButton icon={<span className="font-bold text-[11px]">H2</span>} label="Section heading" text="Section heading" onClick={() => applyStyle('h2')} />
            <SmallButton icon={<span className="font-bold text-[11px]">H3</span>} label="Sub-section heading" text="Sub-section heading" onClick={() => applyStyle('h3')} />
          </RibbonRows>
        </RibbonGroup>
      </>
    ),

    review: (
      <>
        <RibbonGroup label="Proofing">
          <LargeButton
            icon={<SpellCheck />}
            label={settings.spellcheck ? 'Spelling: On' : 'Spelling: Off'}
            active={settings.spellcheck}
            onClick={() => onSettingsChange({ spellcheck: !settings.spellcheck })}
          />
          <WordCountButton editor={editor} pageCount={props.pageCount} />
        </RibbonGroup>
        <RibbonGroup label="AI Review">
          <LargeButton icon={<Sparkles />} label="Check Document" onClick={() => props.onOpenPanel('ai')} />
          <LargeButton icon={<BookOpen />} label="Find Sources" onClick={() => props.onOpenPanel('citations')} />
        </RibbonGroup>
      </>
    ),

    view: (
      <>
        <RibbonGroup label="Views">
          <LargeButton icon={<FileText />} label="Print Layout" active={settings.view === 'print'} onClick={() => onSettingsChange({ view: 'print' })} />
          <LargeButton icon={<Eye />} label="Web Layout" active={settings.view === 'web'} onClick={() => onSettingsChange({ view: 'web' })} />
        </RibbonGroup>
        <RibbonGroup label="Show">
          <RibbonRows>
            <CheckItem label="Ruler" icon={<Ruler size={14} />} checked={settings.showRuler} onChange={(v) => onSettingsChange({ showRuler: v })} />
            <CheckItem label="Formatting marks" icon={<Pilcrow size={14} />} checked={settings.showMarks} onChange={(v) => onSettingsChange({ showMarks: v })} />
          </RibbonRows>
        </RibbonGroup>
        <RibbonGroup label="Zoom">
          <Popover
            trigger={({ toggle, open }) => <LargeButton icon={<ZoomIn />} label="Zoom" caret active={open} onClick={toggle} />}
            panelClassName="py-1 w-[120px]"
          >
            {(close) => (
              <ul>
                {[50, 75, 100, 125, 150, 200].map((z) => (
                  <li key={z}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { onSettingsChange({ zoom: z }); close(); }}
                      className={`w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-[#edebe9] ${settings.zoom === z ? 'bg-[#deecf9]' : ''}`}
                    >
                      {z}%
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Popover>
          <LargeButton icon={<span className="text-[13px] font-bold leading-[26px]">100</span>} label="100%" onClick={() => onSettingsChange({ zoom: 100 })} />
          <LargeButton icon={<Maximize2 />} label="Page Width" onClick={props.onFitWidth} />
        </RibbonGroup>
        <RibbonGroup label="Window">
          <LargeButton icon={<PanelRight />} label="Writing Tools" onClick={props.onTogglePanel} />
        </RibbonGroup>
      </>
    ),
  };

  return (
    <div className="bg-[#f3f2f1] border-b border-[#d2d0ce] shrink-0 no-print">
      <div className="flex items-end justify-between bg-[#f3f2f1] px-1 sm:px-2" role="tablist" aria-label="Ribbon">
        <div className="flex overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => {
                setTab(t.key);
                if (collapsed) setCollapsed(false);
              }}
              className={`relative px-3 py-1.5 text-[13px] whitespace-nowrap transition
                ${t.key === 'file' ? 'text-[#2b579a] font-semibold' : 'text-[#252423]'}
                ${tab === t.key && !collapsed ? 'font-semibold' : 'hover:bg-[#e1dfdd]'}`}
            >
              {t.label}
              {tab === t.key && !collapsed && <span className="absolute left-2 right-2 bottom-0 h-[3px] rounded-t bg-[#2b579a]" />}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="mb-1 p-1 rounded text-[#605e5c] hover:bg-[#e1dfdd]"
          aria-label={collapsed ? 'Expand the ribbon' : 'Collapse the ribbon'}
          title={collapsed ? 'Expand the ribbon' : 'Collapse the ribbon'}
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {!collapsed && (
        <div role="tabpanel" className="bg-white border-t border-[#e1dfdd] mx-1 sm:mx-2 mb-1.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
          <div className="flex items-stretch overflow-x-auto py-1 min-h-[92px]">{groupsByTab[tab]}</div>
        </div>
      )}
    </div>
  );
}

function FontSizeBox({ value, onChange }: { value: number; onChange: (pt: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = parseFloat(draft);
    if (!Number.isNaN(n) && n >= 1 && n <= 400) onChange(Math.round(n * 2) / 2);
    setDraft(null);
  };
  return (
    <div className="flex items-center h-[26px] bg-white border border-[#8a8886] rounded-sm hover:border-[#323130]">
      <input
        aria-label="Font Size"
        title="Font Size"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') setDraft(null);
        }}
        inputMode="decimal"
        className="w-[34px] h-full px-1 text-[12px] text-[#252423] bg-transparent outline-none border-0"
        style={{ outline: 'none' }}
      />
      <Popover
        panelClassName="py-1 w-[64px] max-h-[300px] overflow-y-auto"
        trigger={({ toggle, open }) => (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggle}
            aria-label="Font size list"
            aria-expanded={open}
            className="h-full px-0.5 border-l border-[#e1dfdd] text-[#605e5c]"
          >
            <ChevronDown size={12} />
          </button>
        )}
      >
        {(close) => (
          <ul>
            {FONT_SIZES.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onChange(s); close(); }}
                  className={`w-full text-left px-3 py-1 text-[12.5px] hover:bg-[#edebe9] ${s === value ? 'bg-[#deecf9]' : ''}`}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </div>
  );
}

function LineSpacingMenu({ value, editor }: { value: string; editor: Editor }) {
  return (
    <Popover
      panelClassName="py-1 w-[220px]"
      trigger={({ toggle, open }) => (
        <SmallButton icon={<LineSpacingIcon />} label="Line and Paragraph Spacing" onClick={toggle} active={open} />
      )}
    >
      {(close) => (
        <div>
          {LINE_SPACINGS.map((l) => (
            <button
              key={l}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { editor.chain().focus().setParagraphLineHeight(l).run(); close(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-[#edebe9]"
            >
              <span className="w-4 text-[#2b579a]">{value === l ? '✓' : ''}</span>
              {Number(l).toFixed(l === '1.15' ? 2 : 1)}
            </button>
          ))}
          <div className="my-1 border-t border-[#e1dfdd]" />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { editor.chain().focus().setSpaceAfter('10pt').run(); close(); }}
            className="w-full text-left px-3 py-1.5 pl-9 text-[12.5px] hover:bg-[#edebe9]"
          >
            Add space after paragraph
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { editor.chain().focus().setSpaceAfter('0pt').run(); close(); }}
            className="w-full text-left px-3 py-1.5 pl-9 text-[12.5px] hover:bg-[#edebe9]"
          >
            Remove space after paragraph
          </button>
        </div>
      )}
    </Popover>
  );
}

function LineSpacingIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M7 3h7M7 6.5h7M7 10h7M7 13.5h7" />
      <path d="M3 2v12M1.5 3.5 3 2l1.5 1.5M1.5 12.5 3 14l1.5-1.5" />
    </svg>
  );
}

function TableTools({ editor }: { editor: Editor }) {
  const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => fn(editor.chain().focus()).run();
  const items: [string, () => void, boolean?][] = [
    ['Insert row above', () => run((c) => c.addRowBefore())],
    ['Insert row below', () => run((c) => c.addRowAfter())],
    ['Insert column left', () => run((c) => c.addColumnBefore())],
    ['Insert column right', () => run((c) => c.addColumnAfter())],
    ['Merge or split cells', () => run((c) => c.mergeOrSplit())],
    ['Toggle header row', () => run((c) => c.toggleHeaderRow())],
    ['Delete row', () => run((c) => c.deleteRow()), true],
    ['Delete column', () => run((c) => c.deleteColumn()), true],
    ['Delete table', () => run((c) => c.deleteTable()), true],
  ];
  return (
    <Popover
      panelClassName="py-1 w-[200px]"
      trigger={({ toggle, open }) => <LargeButton icon={<Table />} label="Table Tools" caret active={open} onClick={toggle} />}
    >
      {(close) => (
        <ul>
          {items.map(([label, action, danger]) => (
            <li key={label}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { action(); close(); }}
                className={`w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-[#edebe9] ${danger ? 'text-[#a4262c]' : ''}`}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function PictureMenu({ editor, notify }: { editor: Editor; notify: (m: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (file.size > MAX_IMAGE_BYTES) {
            notify('That picture is over 2 MB. Please use a smaller image.');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') editor.chain().focus().setImage({ src: reader.result, alt: file.name }).run();
          };
          reader.readAsDataURL(file);
        }}
      />
      <Popover
        panelClassName="p-2 w-[260px]"
        trigger={({ toggle, open }) => <LargeButton icon={<ImageIcon />} label="Pictures" caret active={open} onClick={toggle} />}
      >
        {(close) => (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => { fileRef.current?.click(); close(); }}
              className="w-full text-left px-2 py-1.5 text-[12.5px] rounded hover:bg-[#edebe9]"
            >
              This device… <span className="text-[11px] text-[#605e5c]">(up to 2 MB)</span>
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const src = safeUrl(url);
                if (!src || src.startsWith('mailto:')) { notify('Enter a valid image web address (https://…).'); return; }
                editor.chain().focus().setImage({ src }).run();
                setUrl('');
                close();
              }}
              className="border-t border-[#e1dfdd] pt-2"
            >
              <label htmlFor="rp-image-url" className="block text-[11.5px] text-[#605e5c] mb-1">Online picture address</label>
              <div className="flex gap-1">
                <input
                  id="rp-image-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  className="flex-1 min-w-0 h-7 px-2 text-[12px] border border-[#8a8886] rounded-sm"
                />
                <button type="submit" className="h-7 px-2 text-[12px] bg-[#2b579a] text-white rounded-sm hover:bg-[#1e4580]">Insert</button>
              </div>
            </form>
          </div>
        )}
      </Popover>
    </>
  );
}

function LinkMenu({ editor, active, currentHref, notify }: { editor: Editor; active: boolean; currentHref: string; notify: (m: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <Popover
      panelClassName="p-2 w-[280px]"
      trigger={({ toggle, open }) => (
        <LargeButton
          icon={<LinkIcon />}
          label="Link"
          shortcut="Ctrl+K"
          active={open || active}
          onClick={() => { setValue(currentHref); toggle(); }}
        />
      )}
    >
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const href = safeUrl(value);
            if (!href) { notify('Enter a valid web address, e.g. https://ugspace.ug.edu.gh'); return; }
            if (editor.state.selection.empty && !active) {
              editor.chain().focus().insertContent({ type: 'text', text: value.trim(), marks: [{ type: 'link', attrs: { href } }] }).run();
            } else {
              editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
            }
            close();
          }}
        >
          <label htmlFor="rp-link-url" className="block text-[11.5px] text-[#605e5c] mb-1">Address</label>
          <input
            id="rp-link-url"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://…"
            className="w-full h-7 px-2 text-[12px] border border-[#8a8886] rounded-sm mb-2"
          />
          <div className="flex justify-end gap-1">
            {active && (
              <button
                type="button"
                onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); close(); }}
                className="h-7 px-2 text-[12px] border border-[#8a8886] rounded-sm hover:bg-[#edebe9]"
              >
                Remove Link
              </button>
            )}
            <button type="submit" className="h-7 px-3 text-[12px] bg-[#2b579a] text-white rounded-sm hover:bg-[#1e4580]">OK</button>
          </div>
        </form>
      )}
    </Popover>
  );
}

function DateTimeMenu({ editor }: { editor: Editor }) {
  return (
    <Popover
      panelClassName="py-1 w-[230px]"
      trigger={({ toggle, open }) => <LargeButton icon={<CalendarDays />} label="Date & Time" active={open} onClick={toggle} />}
    >
      {(close) => {
        const now = new Date();
        const formats = [
          now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
          now.toLocaleDateString('en-GB'),
          now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          now.toISOString().slice(0, 10),
          now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        ];
        return (
          <ul>
            {formats.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { editor.chain().focus().insertContent(f).run(); close(); }}
                  className="w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-[#edebe9]"
                >
                  {f}
                </button>
              </li>
            ))}
          </ul>
        );
      }}
    </Popover>
  );
}

function WordCountButton({ editor, pageCount }: { editor: Editor; pageCount: number }) {
  return (
    <Popover
      panelClassName="p-4 w-[260px]"
      trigger={({ toggle, open }) => <LargeButton icon={<span className="text-[13px] font-bold leading-[26px]">ABC<sub className="text-[9px]">123</sub></span>} label="Word Count" active={open} onClick={toggle} />}
    >
      {(close) => {
        const text = editor.getText();
        const words = text.split(/\s+/).filter(Boolean).length;
        let paragraphs = 0;
        editor.state.doc.descendants((n) => { if (n.isTextblock && n.textContent.trim()) paragraphs++; return true; });
        const rows: [string, number][] = [
          ['Pages', pageCount],
          ['Words', words],
          ['Characters (no spaces)', text.replace(/\s/g, '').length],
          ['Characters (with spaces)', text.length],
          ['Paragraphs', paragraphs],
        ];
        return (
          <div>
            <p className="text-[13px] font-semibold text-[#252423] mb-2">Word Count</p>
            <dl className="text-[12.5px] space-y-1">
              {rows.map(([label, n]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-[#323130]">{label}</dt>
                  <dd className="font-semibold tabular-nums">{n.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
            <div className="flex justify-end mt-3">
              <button type="button" onClick={close} className="h-7 px-3 text-[12px] border border-[#8a8886] rounded-sm hover:bg-[#edebe9]">Close</button>
            </div>
          </div>
        );
      }}
    </Popover>
  );
}

function CheckItem({ label, icon, checked, onChange }: { label: string; icon: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 h-[26px] px-1.5 rounded text-[12px] text-[#252423] hover:bg-[#edebe9] cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#2b579a]" />
      {icon}
      {label}
    </label>
  );
}

