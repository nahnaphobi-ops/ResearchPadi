export interface Citation {
  title: string;
  authors: string[];
  year: number;
  institution?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  publisher?: string;
  city?: string;
  type?: string;
  field?: string;
}

export interface CitationStyle {
  id: string;
  name: string;
  description: string;
  inText: (citation: Citation, page?: string) => string;
  bibliography: (citation: Citation) => string;
}

function formatAuthors(authors: string[], separator: string = '&'): string {
  if (authors.length === 0) return 'Unknown Author';
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} ${separator} ${authors[1]}`;
  return `${authors[0]} et al.`;
}

function formatAuthorsFull(authors: string[]): string {
  if (authors.length === 0) return 'Unknown Author';
  return authors.join(', ');
}

const CITATION_STYLES: CitationStyle[] = [
  {
    id: 'apa-7',
    name: 'APA 7th Edition',
    description: 'American Psychological Association - commonly used in social sciences',
    inText: (c, page) => {
      const author = formatAuthors(c.authors);
      if (page) return `(${c.year}, p. ${page})`;
      return `(${c.year})`;
    },
    bibliography: (c) => {
      const authors = formatAuthorsFull(c.authors);
      if (c.doi) {
        return `${authors} (${c.year}). ${c.title}. ${c.journal ? c.journal + '.' : ''} ${c.doi}`;
      }
      if (c.url) {
        return `${authors} (${c.year}). ${c.title}. ${c.url}`;
      }
      return `${authors} (${c.year}). ${c.title}.`;
    },
  },
  {
    id: 'apa-ghana',
    name: 'APA Ghana Style',
    description: 'APA style adapted for Ghanaian academic institutions',
    inText: (c, page) => {
      const author = formatAuthors(c.authors);
      if (page) return `(${c.year}, p. ${page})`;
      return `(${c.year})`;
    },
    bibliography: (c) => {
      const authors = formatAuthorsFull(c.authors);
      const institution = c.institution ? ` (${c.institution}).` : '';
      if (c.doi) {
        return `${authors} (${c.year}). ${c.title}.${institution} ${c.journal ? c.journal + '.' : ''} ${c.doi}`;
      }
      return `${authors} (${c.year}). ${c.title}.${institution}`;
    },
  },
  {
    id: 'knust-harvard',
    name: 'KNUST Harvard Style',
    description: 'Harvard referencing style used at Kwame Nkrumah University of Science and Technology',
    inText: (c, page) => {
      const author = formatAuthors(c.authors);
      if (page) return `(${c.year}, p. ${page})`;
      return `(${c.year})`;
    },
    bibliography: (c) => {
      const authors = formatAuthorsFull(c.authors);
      if (c.journal) {
        return `${authors} (${c.year}) '${c.title}', ${c.journal}${c.volume ? `, ${c.volume}` : ''}${c.issue ? `(${c.issue})` : ''}${c.pages ? `, pp. ${c.pages}` : ''}.`;
      }
      return `${authors} (${c.year}) ${c.title}. ${c.institution || ''}.`;
    },
  },
  {
    id: 'ug-harvard',
    name: 'University of Ghana Harvard',
    description: 'Harvard referencing style used at University of Ghana',
    inText: (c, page) => {
      const author = formatAuthors(c.authors);
      if (page) return `(${c.year}, p. ${page})`;
      return `(${c.year})`;
    },
    bibliography: (c) => {
      const authors = formatAuthorsFull(c.authors);
      if (c.journal) {
        return `${authors} (${c.year}). ${c.title}. ${c.journal}, ${c.volume || ''}(${c.issue || ''}), ${c.pages || ''}.`;
      }
      if (c.publisher) {
        return `${authors} (${c.year}). ${c.title}. ${c.city ? c.city + ': ' : ''}${c.publisher}.`;
      }
      return `${authors} (${c.year}). ${c.title}. ${c.institution || ''}.`;
    },
  },
  {
    id: 'vancouver',
    name: 'Vancouver',
    description: 'Commonly used in medical and health sciences',
    inText: (c, page) => {
      const author = formatAuthors(c.authors);
      if (page) return `${c.authors.length > 1 ? author.replace(' et al.', '') : author} ${c.year};${page}`;
      return `${c.authors.length > 1 ? author.replace(' et al.', '') : author} ${c.year}`;
    },
    bibliography: (c) => {
      const authors = formatAuthorsFull(c.authors);
      if (c.journal) {
        return `${authors}. ${c.title}. ${c.journal}. ${c.year};${c.volume || ''}(${c.issue || ''}):${c.pages || ''}.`;
      }
      return `${authors}. ${c.title}. ${c.institution || ''}; ${c.year}.`;
    },
  },
  {
    id: 'chicago-author-date',
    name: 'Chicago Author-Date',
    description: 'Chicago Manual of Style - Author-Date system',
    inText: (c, page) => {
      const author = formatAuthors(c.authors);
      if (page) return `(${c.year}, ${page})`;
      return `(${c.year})`;
    },
    bibliography: (c) => {
      const authors = formatAuthorsFull(c.authors);
      if (c.journal) {
        return `${authors} ${c.year}. "${c.title}." ${c.journal} ${c.volume || ''} (${c.issue || ''}): ${c.pages || ''}.`;
      }
      return `${authors} ${c.year}. ${c.title}. ${c.publisher ? `${c.city ? c.city + ': ' : ''}${c.publisher}.` : ''}`;
    },
  },
  {
    id: 'ieee',
    name: 'IEEE',
    description: 'Institute of Electrical and Electronics Engineers',
    inText: (c, page) => {
      return `[${c.authors.length > 1 ? formatAuthors(c.authors, 'and') : c.authors[0]}, ${c.year}]`;
    },
    bibliography: (c) => {
      const authors = formatAuthorsFull(c.authors);
      if (c.journal) {
        return `${authors}, "${c.title}," ${c.journal}, vol. ${c.volume || 'N/A'}, no. ${c.issue || 'N/A'}, pp. ${c.pages || 'N/A'}, ${c.year}.`;
      }
      return `${authors}, "${c.title}," ${c.year}.`;
    },
  },
  {
    id: 'mla-9',
    name: 'MLA 9th Edition',
    description: 'Modern Language Association - used in humanities',
    inText: (c, page) => {
      const author = formatAuthors(c.authors);
      if (page) return `(${author} ${page})`;
      return `(${author})`;
    },
    bibliography: (c) => {
      const authors = formatAuthorsFull(c.authors);
      if (c.journal) {
        return `${authors}. "${c.title}." ${c.journal}, vol. ${c.volume || ''}, no. ${c.issue || ''}, ${c.year}, pp. ${c.pages || ''}.`;
      }
      return `${authors}. ${c.title}. ${c.publisher ? `${c.publisher}, ${c.year}.` : `${c.year}.`}`;
    },
  },
];

export function getCitationStyles(): Array<{ id: string; name: string; description: string }> {
  return CITATION_STYLES.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
  }));
}

export function getCitationStyle(id: string): CitationStyle | undefined {
  return CITATION_STYLES.find(s => s.id === id);
}

export function formatCitation(
  citation: Citation,
  styleId: string = 'apa-ghana',
  page?: string
): { inText: string; bibliography: string } {
  const style = getCitationStyle(styleId);
  if (!style) {
    return {
      inText: `(${citation.year})`,
      bibliography: `${citation.authors.join(', ')} (${citation.year}). ${citation.title}.`,
    };
  }

  return {
    inText: style.inText(citation, page),
    bibliography: style.bibliography(citation),
  };
}

export function generateBibliography(
  citations: Citation[],
  styleId: string = 'apa-ghana'
): string {
  const formatted = citations.map(c => formatCitation(c, styleId).bibliography);
  return formatted.sort().join('\n\n');
}
