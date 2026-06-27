import { Editor } from '@tiptap/react';
import { useState } from 'react';
import { FileDown, ListTree, RemoveFormatting } from 'lucide-react';

interface Props {
  editor: Editor | null;
  onExportDocx?: () => void;
  onInsertToc?: () => void;
}

const FONT_FAMILIES = [
  'Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Georgia',
  'Garamond', 'Helvetica', 'Tahoma', 'Verdana',
];

const FONT_SIZES = [
  '8px', '9px', '10px', '10.5px', '11px', '12px', '14px', '16px',
  '18px', '20px', '22px', '24px', '26px', '28px', '36px', '48px', '72px',
];

const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#B7B7B7', '#CCCCCC', '#D9D9D9', '#EFEFEF',
  '#980000', '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#4A86E8', '#0000FF',
  '#9900FF', '#FF00FF', '#E6B8AF', '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3',
  '#C9DAF8', '#CFE2F3', '#D9D2E9', '#EAD1DC', '#DD7E6B', '#EA9999', '#F9CB9C', '#FFE599',
  '#B6D7A8', '#A2C4C9', '#A4C2F4', '#9FC5E8', '#B4A7D6', '#D5A6BD', '#CC4125', '#E06666',
];

const LINE_HEIGHTS = ['1', '1.15', '1.5', '2', '2.5', '3'];

function ToolbarButton({
  onClick, active, disabled, children, title, className = '',
}: {
  onClick: () => void; active?: boolean; disabled?: boolean;
  children: React.ReactNode; title: string; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded text-sm transition ${
        active
          ? 'bg-blue-100 text-blue-700 shadow-sm'
          : 'text-gray-700 hover:bg-gray-100'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-gray-300 mx-0.5" />;
}

function Dropdown({
  value, options, onChange, title, renderOption,
}: {
  value: string; options: { value: string; label: string }[];
  onChange: (v: string) => void; title: string;
  renderOption?: (opt: { value: string; label: string }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        title={title}
        className="px-2 py-1 border border-gray-300 rounded text-xs bg-white hover:bg-gray-50 flex items-center gap-1 min-w-[100px] justify-between"
      >
        <span className="truncate">{renderOption ? renderOption(options.find(o => o.value === value) || options[0]) : options.find(o => o.value === value)?.label || value}</span>
        <span className="text-[10px] text-gray-400">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto min-w-[140px]">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 ${
                  opt.value === value ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
                }`}
              >
                {renderOption ? renderOption(opt) : opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ColorPicker({
  colors, currentColor, onChange, title,
}: {
  colors: string[]; currentColor: string; onChange: (c: string) => void; title: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        title={title}
        className="p-1.5 rounded text-sm hover:bg-gray-100 cursor-pointer flex flex-col items-center"
      >
        <span className="font-bold text-sm leading-none">A</span>
        <span className="w-4 h-1 mt-0.5 rounded-sm" style={{ backgroundColor: currentColor || '#000000' }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
            <div className="grid grid-cols-8 gap-0.5">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => { onChange(c); setOpen(false); }}
                  className="w-5 h-5 rounded border border-gray-200 hover:scale-125 transition"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TableMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);

  if (!editor.isActive('table')) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        title="Table"
        className="p-1.5 rounded text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
      >
        ▦
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs space-y-1">
            <button onClick={() => { editor.chain().focus().addColumnAfter().run(); setOpen(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded">Add Column After</button>
            <button onClick={() => { editor.chain().focus().addColumnBefore().run(); setOpen(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded">Add Column Before</button>
            <button onClick={() => { editor.chain().focus().deleteColumn().run(); setOpen(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded">Delete Column</button>
            <hr className="border-gray-200" />
            <button onClick={() => { editor.chain().focus().addRowAfter().run(); setOpen(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded">Add Row After</button>
            <button onClick={() => { editor.chain().focus().addRowBefore().run(); setOpen(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded">Add Row Before</button>
            <button onClick={() => { editor.chain().focus().deleteRow().run(); setOpen(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded">Delete Row</button>
            <hr className="border-gray-200" />
            <button onClick={() => { editor.chain().focus().deleteTable().run(); setOpen(false); }} className="w-full text-left px-2 py-1 hover:bg-red-50 text-red-600 rounded">Delete Table</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Toolbar({ editor, onExportDocx, onInsertToc }: Props) {
  if (!editor) return null;

  const currentFontFamily = editor.getAttributes('textStyle').fontFamily || 'Times New Roman';
  const currentFontSize = editor.getAttributes('textStyle').fontSize || '12px';
  const currentColor = editor.getAttributes('textStyle').color || '#000000';
  const currentHighlight = editor.getAttributes('highlight').color || '';

  return (
    <div className="border-b border-gray-200 bg-gray-50 px-3 py-1.5 sticky top-0 z-30">
      {/* Row 1: Font, Size, Color, Basic formatting */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Font Family */}
        <Dropdown
          value={currentFontFamily}
          options={FONT_FAMILIES.map(f => ({ value: f, label: f }))}
          onChange={(v) => editor.chain().focus().setFontFamily(v).run()}
          title="Font"
          renderOption={(opt) => <span style={{ fontFamily: opt.value }}>{opt.label}</span>}
        />

        {/* Font Size */}
        <Dropdown
          value={currentFontSize}
          options={FONT_SIZES.map(s => ({ value: s, label: s.replace('px', 'pt') }))}
          onChange={(v) => editor.chain().focus().setFontSize(v).run()}
          title="Font Size"
        />

        <Divider />

        {/* Bold, Italic, Underline, Strikethrough */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <span className="line-through">S</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          active={editor.isActive('subscript')}
          title="Subscript"
        >
          <span>X<sub className="text-[9px]">2</sub></span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          active={editor.isActive('superscript')}
          title="Superscript"
        >
          <span>X<sup className="text-[9px]">2</sup></span>
        </ToolbarButton>

        <Divider />

        {/* Text Color */}
        <ColorPicker
          colors={COLORS}
          currentColor={currentColor}
          onChange={(c) => editor.chain().focus().setColor(c).run()}
          title="Text Color"
        />

        {/* Highlight Color */}
        <ColorPicker
          colors={['#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#FF9900', '#FFFFFF', ...COLORS]}
          currentColor={currentHighlight || '#FFFF00'}
          onChange={(c) => editor.chain().focus().toggleHighlight({ color: c }).run()}
          title="Highlight"
        />

        <Divider />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          ☰
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Center"
        >
          ☰
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          ☰
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          active={editor.isActive({ textAlign: 'justify' })}
          title="Justify"
        >
          ☰
        </ToolbarButton>

        <Divider />

        {/* Line Height */}
        <Dropdown
          value={editor.getAttributes('paragraph').lineHeight || '1.5'}
          options={LINE_HEIGHTS.map(l => ({ value: l, label: `${l}x` }))}
          onChange={(v) => {
            editor.chain().focus().setLineHeight(v).run();
          }}
          title="Line Spacing"
        />

        <Divider />

        {/* Undo / Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          ↩
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          ↪
        </ToolbarButton>
      </div>

      {/* Row 2: Paragraph, Lists, Indent, Table, Insert */}
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        {/* Headings */}
        <Dropdown
          value={editor.isActive('heading') ? `h${editor.getAttributes('heading').level}` : 'paragraph'}
          options={[
            { value: 'paragraph', label: 'Normal Text' },
            { value: 'h1', label: 'Heading 1' },
            { value: 'h2', label: 'Heading 2' },
            { value: 'h3', label: 'Heading 3' },
            { value: 'h4', label: 'Heading 4' },
          ]}
          onChange={(v) => {
            if (v === 'paragraph') {
              editor.chain().focus().setParagraph().run();
            } else {
              editor.chain().focus().toggleHeading({ level: parseInt(v.replace('h', '')) as 1 | 2 | 3 | 4 }).run();
            }
          }}
          title="Paragraph Style"
        />

        <Divider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          • ≡
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered List"
        >
          1. ≡
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')}
          title="Task List"
        >
          ☑
        </ToolbarButton>

        <Divider />

        {/* Indent */}
        <ToolbarButton
          onClick={() => (editor.chain().focus() as any).indent().run()}
          title="Increase Indent"
        >
          →|≡
        </ToolbarButton>
        <ToolbarButton
          onClick={() => (editor.chain().focus() as any).outdent().run()}
          title="Decrease Indent"
        >
          ←|≡
        </ToolbarButton>

        <Divider />

        {/* Block types */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Blockquote"
        >
          ❝
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Code Block"
        >
          {'</>'}
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Line"
        >
          —
        </ToolbarButton>

        <Divider />

        {/* Table */}
        <div className="relative">
          <button
            onClick={() => {
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            }}
            title="Insert Table"
            className="p-1.5 rounded text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            ⊞
          </button>
        </div>
        <TableMenu editor={editor} />

        <Divider />

        {/* Clear Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Clear Formatting"
        >
          <RemoveFormatting size={16} />
        </ToolbarButton>

        <Divider />

        {/* TOC */}
        <ToolbarButton
          onClick={() => onInsertToc?.()}
          title="Insert Table of Contents"
        >
          <ListTree size={16} />
        </ToolbarButton>

        {/* Export */}
        <ToolbarButton
          onClick={() => onExportDocx?.()}
          title="Export as DOCX"
        >
          <FileDown size={16} />
        </ToolbarButton>
      </div>
    </div>
  );
}
