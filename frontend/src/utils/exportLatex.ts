import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * The document as LaTeX, for students whose department or supervisor works in
 * LaTeX/Overleaf: a .zip with main.tex and any figures as PNG files. Headings
 * keep the student's own numbering (unnumbered sectioning commands with
 * contents entries), citations keep their formatted labels, and the reference
 * list goes in as written.
 */
const SPECIAL: Record<string, string> = {
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', $: '\\$', '&': '\\&', '#': '\\#', '^': '\\textasciicircum{}', _: '\\_', '%': '\\%', '~': '\\textasciitilde{}',
};
export const escapeLatex = (text: string) => text.replace(/[\\{}$&#^_%~]/g, (ch) => SPECIAL[ch]);

/**
 * Letters of Akan, Ewe, Ga, Dagbani and other Ghanaian languages (with any
 * accents on them) that Times-style fonts lack. They go in \gh{\u2026}, set in a
 * font that has them under XeLaTeX.
 */
const GHANAIAN = /(?:[\u025b\u0190\u0254\u0186\u014b\u014a\u0192\u0191\u028b\u01b2\u0256\u0189\u0263\u0194\u0292\u01b7][\u0300-\u036f]*)+/g;
export const hasGhanaianLetters = (text: string) => new RegExp(GHANAIAN.source).test(text);

/** Escaped text, with Ghanaian letters marked for their font. */
const texText = (text: string) => escapeLatex(text).replace(GHANAIAN, (run) => `\\gh{${run}}`);

interface Context { figures: { name: string; data: string }[] }

function inline(node: ChildNode, ctx: Context): string {
  if (node.nodeType === Node.TEXT_NODE) return texText((node.textContent ?? '').replace(/\u00a0/g, ' '));
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const inner = () => Array.from(el.childNodes).map((c) => inline(c, ctx)).join('');
  switch (tag) {
    case 'strong': case 'b': return `\\textbf{${inner()}}`;
    case 'em': case 'i': return `\\textit{${inner()}}`;
    case 'u': return `\\underline{${inner()}}`;
    case 's': return `\\sout{${inner()}}`;
    case 'sup': return `\\textsuperscript{${inner()}}`;
    case 'sub': return `\\textsubscript{${inner()}}`;
    case 'br': return '\\\\\n';
    case 'a': return `\\href{${(el.getAttribute('href') ?? '').replace(/[%#\\]/g, (c) => `\\${c}`)}}{${inner()}}`;
    case 'img': return figure(el, ctx);
    default: return inner();
  }
}

function figure(el: Element, ctx: Context): string {
  const src = el.getAttribute('src') ?? '';
  const match = src.match(/^data:image\/(png|jpe?g);base64,(.*)$/);
  if (!match) return '';
  const name = `figures/figure-${ctx.figures.length + 1}.${match[1] === 'png' ? 'png' : 'jpg'}`;
  ctx.figures.push({ name, data: match[2] });
  return `\n\\begin{center}\n\\includegraphics[width=0.9\\textwidth]{${name}}\n\\end{center}\n`;
}

const HEADINGS: Record<string, [string, string]> = {
  h1: ['chapter', 'chapter'], h2: ['section', 'section'], h3: ['subsection', 'subsection'], h4: ['subsubsection', 'subsubsection'],
};

function block(node: ChildNode, ctx: Context): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').trim() ? `${inline(node, ctx)}\n\n` : '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const kids = () => Array.from(el.childNodes).map((c) => inline(c, ctx)).join('').trim();

  if (HEADINGS[tag]) {
    const text = kids();
    if (!text) return '';
    const [command, level] = HEADINGS[tag];
    return `\\${command}*{${text}}\n\\addcontentsline{toc}{${level}}{${text}}\n\n`;
  }
  if (tag === 'p') {
    const text = kids();
    if (!text) return '';
    const centred = /text-align:\s*center/.test(el.getAttribute('style') ?? '');
    return centred ? `\\begin{center}\n${text}\n\\end{center}\n\n` : `${text}\n\n`;
  }
  if (tag === 'img') return figure(el, ctx);
  if (tag === 'ul' || tag === 'ol') {
    const env = tag === 'ul' ? 'itemize' : 'enumerate';
    const items = Array.from(el.children).map((li) => `  \\item ${Array.from(li.childNodes).map((c) => (c.nodeType === Node.ELEMENT_NODE && ['ul', 'ol'].includes((c as Element).tagName.toLowerCase()) ? block(c, ctx) : inline(c, ctx))).join('').trim()}`);
    return `\\begin{${env}}\n${items.join('\n')}\n\\end{${env}}\n\n`;
  }
  if (tag === 'blockquote') return `\\begin{quote}\n${Array.from(el.childNodes).map((c) => block(c, ctx)).join('').trim()}\n\\end{quote}\n\n`;
  if (tag === 'table') {
    const rows = Array.from(el.querySelectorAll('tr'));
    const cols = Math.max(1, ...rows.map((r) => r.children.length));
    const body = rows.map((r) => Array.from(r.children).map((c) => {
      const text = Array.from(c.childNodes).map((n) => inline(n, ctx)).join('').trim();
      return c.tagName.toLowerCase() === 'th' ? `\\textbf{${text}}` : text;
    }).join(' & ')).join(' \\\\ \\hline\n');
    return `\\begin{center}\n\\begin{tabular}{|${'l|'.repeat(cols)}}\n\\hline\n${body} \\\\ \\hline\n\\end{tabular}\n\\end{center}\n\n`;
  }
  if (tag === 'div' && el.hasAttribute('data-page-break')) return '\\newpage\n\n';
  if (tag === 'div' && el.hasAttribute('data-bibliography')) {
    const entries = Array.from(el.children).filter((c) => c.tagName.toLowerCase() !== 'h1' && !c.classList.contains('bib-empty'));
    const title = el.querySelector('h1')?.textContent?.trim() || 'References';
    // Hanging indent, as reference lists are set.
    return `\\section*{${texText(title)}}\n\\addcontentsline{toc}{chapter}{${texText(title)}}\n\\begin{list}{}{\\leftmargin=0.5in \\itemindent=-0.5in}\n${entries.map((e) => `  \\item ${Array.from(e.childNodes).map((c) => inline(c, ctx)).join('').trim()}`).join('\n')}\n\\end{list}\n\n`;
  }
  return Array.from(el.childNodes).map((c) => block(c, ctx)).join('');
}

/** main.tex and its figures from the editor's HTML. */
export function htmlToLatex(html: string, title: string): { tex: string; figures: { name: string; data: string }[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ctx: Context = { figures: [] };
  const body = Array.from(doc.body.childNodes).map((n) => block(n, ctx)).join('').replace(/\n{3,}/g, '\n\n');
  const ghanaian = hasGhanaianLetters(html) || hasGhanaianLetters(title);
  // pdfLaTeX has no font with ɛ, ɔ and the rest, so those documents need XeLaTeX; say so plainly.
  const pdfTexStop = ghanaian
    ? '\n  \\errmessage{This document uses Ghanaian letters (e.g. open e, open o). Compile it with XeLaTeX: in Overleaf, Menu > Compiler > XeLaTeX}'
    : '';
  const tex = `% Exported from ResearchPadi. Compile with ${ghanaian ? 'XeLaTeX (Overleaf: Menu > Compiler > XeLaTeX), because it uses Ghanaian letters' : 'pdfLaTeX or XeLaTeX (e.g. on Overleaf)'}.
\\documentclass[12pt,a4paper]{report}
\\usepackage{iftex}
\\ifPDFTeX${pdfTexStop}
  \\usepackage[utf8]{inputenc}
  \\usepackage[T1]{fontenc}
  \\usepackage{mathptmx}
  \\DeclareRobustCommand{\\gh}[1]{#1}
\\else
  % Times-style text; Ghanaian letters in Noto Serif, which has them all. Both come with TeX Live.
  \\usepackage{fontspec}
  \\setmainfont{texgyretermes}[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-italic, BoldItalicFont=*-bolditalic]
  \\newfontfamily\\ghfont{NotoSerif}[Extension=.ttf, UprightFont=*-Regular, BoldFont=*-Bold, ItalicFont=*-Italic, BoldItalicFont=*-BoldItalic]
  \\DeclareRobustCommand{\\gh}[1]{{\\ghfont #1}}
\\fi
\\usepackage[left=1.5in,right=1in,top=1in,bottom=1in]{geometry}
\\usepackage{setspace}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage[normalem]{ulem}
\\onehalfspacing

\\title{${texText(title)}}
\\date{}

\\begin{document}
\\maketitle
\\tableofcontents

${body.trim()}

\\end{document}
`;
  return { tex, figures: ctx.figures };
}

export async function exportToLatex(html: string, title: string) {
  const { tex, figures } = htmlToLatex(html, title);
  const zip = new JSZip();
  zip.file('main.tex', tex);
  for (const f of figures) zip.file(f.name, f.data, { base64: true });
  saveAs(await zip.generateAsync({ type: 'blob' }), `${title.replace(/\s+/g, '_') || 'document'}_latex.zip`);
}
