export const STYLES = ['apa', 'mla', 'chicago', 'harvard', 'ieee'] as const;
export type CitationStyle = (typeof STYLES)[number];

  export interface CitationData {
    title?: string;
    authors?: string;
    year?: number;
    source?: string;
    institution?: string;
    url?: string;
    type?: 'academic' | 'rag';
    doi?: string;
    publisher?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    chunk_text?: string;
  }

const splitAuthors = (authors?: string): string[] =>
  authors ? authors.split(',').map(a => a.trim()).filter(Boolean) : [];

const formatAuthorsApa = (authors?: string): string => {
  const list = splitAuthors(authors);
  if (list.length === 0) return 'Unknown';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} & ${list[1]}`;
  if (list.length === 3) return `${list[0]}, ${list[1]}, & ${list[2]}`;
  return `${list[0]} et al.`;
};

const formatAuthorsMla = (authors?: string): string => {
  const list = splitAuthors(authors);
  if (list.length === 0) return 'Unknown';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]}, et al.`;
};

const formatAuthorsChicago = (authors?: string): string => {
  const list = splitAuthors(authors);
  if (list.length === 0) return 'Unknown';
  if (list.length === 1) return list[0];
  if (list.length <= 3) return list.join(', ');
  return `${list[0]} et al.`;
};

const formatAuthorsHarvard = (authors?: string): string => {
  const list = splitAuthors(authors);
  if (list.length === 0) return 'Unknown';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]} et al.`;
};

const formatAuthorsIeee = (authors?: string): string => {
  const list = splitAuthors(authors);
  if (list.length === 0) return 'Unknown';
  return list.join(', ');
};

export function formatCitation(c: CitationData, style: CitationStyle): string {
  const title = c.title || 'Untitled';
  const year = c.year ? String(c.year) : 'n.d.';
  const source = c.source || '';
  const url = c.url || '';

  switch (style) {
    case 'apa': {
      const authorStr = formatAuthorsApa(c.authors);
      return `${authorStr} (${year}). *${title}*. ${source}${url ? `. ${url}` : ''}`;
    }
    case 'mla': {
      const authorStr = formatAuthorsMla(c.authors);
      return `${authorStr}. "${title}." *${source}*, ${year}${url ? `, ${url}` : ''}.`;
    }
    case 'chicago': {
      const authorStr = formatAuthorsChicago(c.authors);
      return `${authorStr}. "${title}." ${source} (${year})${url ? `. ${url}` : ''}.`;
    }
    case 'harvard': {
      const authorStr = formatAuthorsHarvard(c.authors);
      return `${authorStr} (${year}) '${title}', ${source}${url ? `. Available at: ${url}` : ''}.`;
    }
    case 'ieee': {
      const authorStr = formatAuthorsIeee(c.authors);
      return `${authorStr}, "${title}," ${source}, ${year}${url ? `. [Online]. Available: ${url}` : ''}.`;
    }
    default:
      return `${c.authors || 'Unknown'} (${year}). ${title}. ${source}.`;
  }
}

export function formatBibliography(citations: CitationData[], style: CitationStyle): string {
  return citations
    .map((c, i) => {
      if (style === 'ieee') {
        return `[${i + 1}] ${formatCitation(c, style)}`;
      }
      return formatCitation(c, style);
    })
    .join('\n\n');
}
