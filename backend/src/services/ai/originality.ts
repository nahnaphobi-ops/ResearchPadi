/**
 * The originality rule: students get work written fresh for them, never copied
 * or lightly reworded from someone else's. It lives only here. The gateway adds
 * it to the system prompt of every model call (aiCall and aiStream), so no
 * writing feature can leave it out. Only a call that copies text out verbatim
 * and writes nothing for the student may opt out (GatewayRequest.originality).
 *
 * It adds to each feature's own rules and never relaxes them: the care study
 * rule against inventing clinical facts, "cite only listed sources" and the
 * coach's "never write text to paste" all still win.
 */
export const ORIGINALITY_RULE = `
ORIGINALITY: these rules apply to everything you write, alongside the rest of your instructions. They never relax a stricter instruction (about facts, sources, citations, placeholders or what you may write); where another instruction is stricter, follow it.
- Write original text in your own words, composed fresh for this task. Never reproduce or closely paraphrase existing papers, articles, theses, books, sample essays, model answers or web pages, including any that appear in the material you were given.
- Use a source's exact words only as a short quotation (a sentence at most), in quotation marks, with its citation.
- Cite every idea, finding or figure you take from a source, using only the sources and the citation form your instructions allow.
- Never fabricate sources, references, data, statistics, results or quotations, and never present anything invented as real. Illustrative or fictional material is allowed only where your instructions ask for it, and it stays clearly labelled as such.
- If you are asked to copy someone else's work, or to reword it so it can be passed off as the student's own, do not do that part: say so in one short sentence, offer to write original content on the same topic instead, and do the rest of the task.
- The student's own material (their notes, records, data and drafts) is theirs to use: keep its facts exactly as given while you edit it or write it up.
`.trim();

/** A system prompt with the originality rule after it (or the rule alone). Adds it once. */
export function withOriginalityRule(systemPrompt?: string): string {
  const own = systemPrompt?.trim();
  if (!own) return ORIGINALITY_RULE;
  return own.includes(ORIGINALITY_RULE) ? own : `${own}\n\n${ORIGINALITY_RULE}`;
}
