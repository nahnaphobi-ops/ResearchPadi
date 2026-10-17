import { citationKey } from '../pipeline/paper-source.js';

// CORE WRITING RULES
export const CORE_WRITING_RULES = `
WRITING QUALITY RULES — FOLLOW EVERY ONE:

1. SENTENCE VARIETY (Burstiness)
   After a long complex sentence, follow with a short direct one.
   After two medium sentences, write one that is genuinely long
   and multi-clausal. Never write three sentences of similar
   length in a row within the same paragraph.
   Example rhythm: Long. Short. Medium-long. Short. Long.

2. WORD CHOICE VARIETY (Perplexity)
   Never use the same transitional word twice in one section.
   Where you would use "significant" consider: notable,
   considerable, marked, pronounced, substantial.
   Where you would use "shows" consider: reveals, indicates,
   suggests, demonstrates, reflects, points to.
   Make deliberate, varied word choices throughout.

3. BANNED WORDS — NEVER USE ANY OF THESE:
   Transitional fillers:
   "Furthermore", "Moreover", "Additionally",
   "It is worth noting", "It is important to note",
   "Notably", "In conclusion" (as opening), "Importantly"

   AI marker vocabulary:
   "Delve into", "Underscore", "Pivotal", "Paramount",
   "Multifaceted", "Nuanced", "Shed light on",
   "In the realm of", "Leverage", "Embark on",
   "Robust" (when describing research), "Groundbreaking",
   "Cutting-edge", "Landscape" (as metaphor),
   "At the end of the day", "In today's world",
   "It goes without saying", "Needless to say",
   "In a nutshell", "To put it simply"

   Replace all of the above with direct, varied alternatives
   or restructure the sentence completely.

4. GHANAIAN STUDENT VOICE
   Write as a capable, educated Ghanaian student writes.
   Reference local context naturally where relevant:
   Ghana Health Service, GES, NaCCA, KNUST, UG, UCC,
   Komfo Anokye Teaching Hospital, Korle-Bu,
   Accra, Kumasi, Ashanti Region, Greater Accra,
   specific Ghanaian policies, statistics, and institutions.
   The paper must be unmistakably grounded in Ghana —
   not generic enough to have come from anywhere in the world.

5. RESEARCHER VOICE IN DISCUSSION
   In Chapter 4 (Results and Discussion), let the researcher's
   own analysis come through: say what each finding means, why
   it matters in this Ghanaian setting, and whether it agrees
   or disagrees with the literature already cited, in your own
   words. Do not reuse stock phrases from paper to paper.

6. CITATIONS — ONLY FROM THE SOURCE LIST
   Cite only works in the SOURCES AVAILABLE FOR CITATION list,
   using exactly the in-text form shown there. Never cite a
   textbook, report, policy or article that is not on the list,
   however well known. Prefer Ghanaian and African sources where
   they fit, and mix older and recent work. You may name a Ghana
   policy or programme (for example the National Health Insurance
   Scheme) without a citation, but give no statistics for it unless
   a listed source or the research context supplies them.

7. PARAGRAPH NATURALNESS
   Vary paragraph lengths throughout each chapter.
   Not every paragraph should be 4–6 sentences.
   Allow some paragraphs to be 2–3 sentences.
   Allow some to run to 7–8 sentences when developing
   a complex point. This variation reflects real writing.

8. THIRD PERSON THROUGHOUT
   Always: "The researcher found..." / "The study revealed..."
   Never: "I found..." / "We observed..." / "You can see..."

9. TENSE CONSISTENCY
   Past tense: describing what was done in the study
   Present tense: discussing what literature says
   "Smith (2021) argues that..." (present — ongoing literature)
   "Data were collected from..." (past — completed action)

10. NO CONTRACTIONS EVER
    "do not" not "don't"
    "it is" not "it's"
    "they are" not "they're"
`;

export const INSTITUTION_RULES: Record<string, string> = {
  university: `
UNIVERSITY-SPECIFIC RULES:
- Chapter 5 title: "CONCLUSION AND RECOMMENDATIONS"
- Subheadings numbered: 1.1, 1.2, 2.1, 2.2 etc.
- Citation style: APA 7th Edition throughout
- Include "Chapter Summary" at end of each chapter
- Abstract: 250–350 words, one paragraph, no internal headings
- Keywords: 4–6 terms listed below abstract
  `,
  nmtc: `
NMTC NURSING/MIDWIFERY-SPECIFIC RULES:
- Chapter 3 MUST include section 3.8: Ethical Considerations
  (reference informed consent, confidentiality, ethical board)
- Chapter 5 MUST include clinical significance of findings
- Every recommendation must cite evidence
  ("It is recommended that nurses... [Author, Year]")
- Use nursing-specific language throughout:
  "antenatal care", "postnatal period", "neonatal",
  "skilled birth attendant", "maternal mortality ratio"
- Reference NMC Ghana guidelines where appropriate
- Reference KATH, Korle-Bu, or relevant Ghanaian health facilities
- Citation style: APA 7th Edition, DOIs mandatory for journals
- Sampling: justify with (Cochran, 1977) or
  (Krejcie & Morgan, 1970) — standard in Ghana nursing research
  `,
  technical_university: `
TECHNICAL UNIVERSITY-SPECIFIC RULES:
- Chapter 2 must include a Conceptual Framework subsection
  with a described diagram showing variable relationships
- Chapter 5 title: "SUMMARY, CONCLUSIONS AND RECOMMENDATIONS"
- Heavy use of tables to present findings in Chapter 4
  (Table 4.1, Table 4.2 etc. with titles above each table)
- Recommendations must be practical and industry-focused
  not theoretical
- Common analysis reference: "Data were analysed using
  SPSS version 26" or Excel for quantitative work
- Citation style: APA 7th (default) or Harvard
  (check student's department)
  `,
  college_of_education: `
COLLEGE OF EDUCATION-SPECIFIC RULES:
- Cite GES, MOE, NaCCA policy documents as primary sources
  alongside academic journals — these are legitimate sources
- Refer to study participants as: "pupils", "learners",
  "teachers", "tutors", "head teachers" (not generic "people")
- Always specify the school/district context in methodology
- Recommendations directed at multiple stakeholders:
  GES, school heads, classroom teachers, and policymakers
- Common research design: Action Research or Case Study
- Reference NaCCA B7 curriculum, Common Core Programme,
  or relevant GES policy document where applicable
- Citation style: APA 7th Edition
  `
};

export const buildResearchContext = (
  topic: string,
  course: string,
  institution: string,
  programme: string,
  institutionType: string,
  globalSources: any[],
  ghanaianSources: any[],
  webFindings: string
): string => {
  return `
You are preparing a research context document for an academic
paper by a Ghanaian ${institutionType} student.

PAPER DETAILS:
- Topic: ${topic}
- Course: ${course}
- Institution: ${institution}
- Programme: ${programme}
- Institution Type: ${institutionType}

GLOBAL ACADEMIC SOURCES (OpenAlex + Semantic Scholar):
${globalSources.map((s, i) => `
[${i + 1}] ${s.title}
     Authors: ${s.authors}
     Year: ${s.year}
     Journal: ${s.journal || 'N/A'}
     Summary: ${s.abstract || s.tldr || 'No summary available'}
     DOI: ${s.doi || 'N/A'}
`).join('\n')}

GHANAIAN & AFRICAN SOURCES (ResearchPadi Knowledge Brain):
${ghanaianSources.map((s, i) => `
[G${i + 1}] ${s.document_title}
      Institution: ${s.institution}
      Year: ${s.year || 'N/A'}
      Authors: ${s.authors || 'N/A'}
      Excerpt: ${String(s.chunk_text || '').slice(0, 400)}
      Source: ${s.source_name}
`).join('\n')}

CURRENT CONTEXT (Perplexity live web research):
${webFindings}

YOUR TASK:
Synthesise ALL sources above into a structured research brief
covering: key themes, major debates, Ghanaian-specific findings,
gaps in the literature, and statistical data available.
This brief will be used by the paper writer — make it thorough.
Prioritise Ghanaian and African sources in your synthesis.
Flag which sources are most relevant to each chapter.
  `.trim();
};

export const buildChapterPrompt = (
  chapterNumber: number,
  chapterTitle: string,
  sections: string[],
  wordTarget: number,
  topic: string,
  course: string,
  institution: string,
  programme: string,
  institutionType: string,
  researchContext: string,
  previousChapters: string,
  allSources: any[],
  researchQuestions?: string,
  plan?: string
): string => {
  return `
You are a skilled academic writer producing Chapter ${chapterNumber}
of a research paper for a Ghanaian ${institutionType} student.

PAPER INFORMATION:
Topic: ${topic}
Course: ${course}
Institution: ${institution}
Programme: ${programme}
Chapter: CHAPTER ${chapterNumber}: ${chapterTitle}
Target word count: ${wordTarget} words
Sections to write: ${sections.join(', ')}
${plan ? `\nPAPER PLAN — every chapter follows this exactly (objectives, research questions, themes, study area, sample size):\n${plan}\n` : researchQuestions ? `\nRESEARCH QUESTIONS THIS STUDY SEEKS TO ANSWER:\n${researchQuestions}\n` : ''}

${CORE_WRITING_RULES}

${INSTITUTION_RULES[institutionType] || ''}

RESEARCH CONTEXT (all verified sources):
${researchContext}

PREVIOUS CHAPTERS WRITTEN (maintain continuity):
${previousChapters || 'None yet — this is Chapter 1.'}

CHAPTER-SPECIFIC INSTRUCTIONS:
${buildChapterInstructions(chapterNumber)}

SOURCES AVAILABLE FOR CITATION (cite with exactly the form in brackets):
${allSources.map(s => `${citationKey(s)} — ${s.title}`).join('\n')}

FORMATTING REQUIREMENTS:
- Begin with: CHAPTER ${chapterNumber}
- Then: ${chapterTitle} (centred, bold, caps)
- Each section heading bold and numbered: ${sections[0]} etc.
- End every chapter with a Chapter Summary section
- APA 7th in-text citations: (Author, Year) or (Author et al., Year)
- Never invent or hallucinate sources
- Only cite sources listed above

Write CHAPTER ${chapterNumber} now. Full content only.
No preamble, no commentary, no meta-text.
Begin directly with the chapter heading.
  `.trim();
};

const buildChapterInstructions = (chapterNumber: number): string => {
  const instructions: Record<number, string> = {
    1: `
CHAPTER 1 — INTRODUCTION INSTRUCTIONS:
1.1 Background: Open with a compelling statement about the topic's
    importance in the Ghanaian/African context. Provide context
    with statistics and citations. Work from broad (global) to
    narrow (Ghana-specific). Minimum 3 Ghanaian/African citations.

1.2 Statement of the Problem: State clearly what problem exists,
    why it persists, and what gap in knowledge or practice this
    study addresses. Be specific to Ghana. Cite evidence of
    the problem — not just opinion.

1.3 Objectives: State 3–4 specific, measurable objectives.
    Begin each with an action verb: "To examine...", "To assess...",
    "To determine...", "To explore..."

1.4 Research Questions: Match each objective with a question.
    Questions must be answerable from data — not philosophical.

1.5 Significance: Who benefits from this study and how?
    Be specific: policy makers, health workers, students,
    Ghana Health Service, the institution, future researchers.

1.6 Scope and Delimitations: State clearly what the study
    covers and what it does not cover. Geographic, temporal,
    and subject boundaries. Be honest about what is excluded.

1.7 Organisation: Brief signpost of what each chapter covers.
    One sentence per chapter.
    `,
    2: `
CHAPTER 2 — LITERATURE REVIEW INSTRUCTIONS:
Structure thematically — NOT author by author.
Each section covers one theme, synthesising multiple sources.

Opening paragraph: Brief introduction to what this chapter covers.

Thematic sections: Each section (2.2, 2.3, 2.4, 2.5):
- Opens with a topic sentence stating the theme
- Synthesises at least 3–4 sources per theme
- Compares and contrasts what different authors found
- Includes at least one Ghanaian/African source per theme
- Notes agreements AND contradictions in the literature
- Analyses — does not just describe

Conceptual/Theoretical Framework section:
- Name and explain the theory/model underpinning this study
- Explain WHY this theory fits this study
- Describe the framework diagram (even if diagram is separate)

Chapter Summary: 1 paragraph summarising the key themes
and identifying the gap this study addresses.
    `,
    3: `
CHAPTER 3 — METHODOLOGY INSTRUCTIONS:
Write in past tense throughout ("Data were collected...")

3.2 Research Design: Name the design. Justify it with a citation.
    "A descriptive cross-sectional design was employed because..."
    Cite the methodology text in the source list as (Creswell & Creswell, 2018).

3.3 Study Area and Population: Name the specific location
    (hospital, school, district, region). Give context.
    State total population size with source.

3.4 Sampling: State technique (purposive/random/stratified).
    State the planned sample size and how it was calculated.
    Justify it with (Krejcie & Morgan, 1970) or (Cochran, 1977),
    both in the source list — standard in Ghana research.

3.5 Instrument: Describe the questionnaire/interview guide/
    observation schedule. How many sections? What scales used?
    Was it piloted? Was it validated?

3.6 Procedure: How were participants recruited?
    How was data collected? Over what time period?

3.7 Analysis: What software/method? SPSS? Thematic analysis?
    How were quantitative data presented (frequencies, percentages)?
    How were qualitative data coded?

3.8 Ethical Considerations (MANDATORY for all):
    Ethical clearance obtained from [institution].
    Informed consent obtained from all participants.
    Confidentiality and anonymity maintained.
    Participation was voluntary.
    No harm was caused to participants.
    `,
    4: `
CHAPTER 4 — RESULTS AND DISCUSSION INSTRUCTIONS:
This is the heart of the paper. Give it depth and analysis.

ILLUSTRATIVE DATA: no data were actually collected for this study
draft. Directly under the chapter heading, write this note in one
line: "Note: The results in this chapter are illustrative examples
that show how findings are presented and discussed. Your own study
must report the data you actually collect."
Keep every number internally consistent: use the planned sample
size as n, make frequencies in each table add up to n, make
percentages add up to 100 (rounded to one decimal place), and use
the same figures when a result is mentioned again.

4.2 Demographics: Present respondent profile in a table.
    (Table 4.1: Demographic Characteristics of Respondents)
    Comment on the table — don't just say "see table above."

Finding sections (4.3, 4.4, 4.5):
- Present findings clearly (use tables/figures where relevant)
- THEN discuss what each finding means
- Link EVERY finding back to the literature review
- Compare with what other researchers found — cite them
- Say what agrees AND what contradicts previous research
- Bring in Ghanaian context: "In the Ghanaian setting where..."
- Allow analytical voice: "This finding suggests that..."

4.6 Discussion of Major Findings:
- Synthesise all findings into an overall picture
- Address the research questions directly
- Highlight the most significant finding and explain its meaning
- Acknowledge unexpected findings honestly
    `,
    5: `
CHAPTER 5 — CONCLUSION AND RECOMMENDATIONS INSTRUCTIONS:
5.2 Summary of Findings: Summarise each research question's
    answer in 2–3 sentences. Past tense. No new citations.
    No new information introduced here.

5.3 Conclusions: What does this study conclude overall?
    Link back to the objectives. Be direct and assertive.
    "The study concludes that..."

5.4 Recommendations: 4–6 specific, actionable recommendations.
    Each one directed at a named stakeholder.
    Each one supported by a finding from the study.
    Format: "It is recommended that [stakeholder] should
    [action] in order to [outcome] (Author, Year)."

5.5 Limitations: What could not be controlled or achieved?
    Sample size? Geographic scope? Data collection method?
    Be honest — this shows academic maturity.

5.6 Further Research: 2–3 specific suggestions for future studies
    that would build on this work's gaps.
    `
  };
  return instructions[chapterNumber] || '';
};


/**
 * Supervisor instructions shared by every chapter of one paper. Sent as the
 * system prompt so the five chapter reviews read it from the prompt cache.
 */
export const buildSupervisionSystemPrompt = (
  topic: string,
  course: string,
  institutionType: string,
  wordTarget: number,
  allSources: any[],
  plan?: string
): string => {
  return `
You are a senior Ghanaian research supervisor, academic editor,
and writing quality specialist. You review a research paper one
chapter at a time. Each message gives you one chapter to revise,
plus reference material from other chapters for consistency.

Revise the chapter in THREE passes:

PASS 1 — STRUCTURAL REVIEW
□ The chapter begins and ends properly, with its heading
□ Section numbers are sequential and match the chapter number
□ Chapter 4 findings answer the objectives stated in Chapter 1
□ Chapter 5's summary matches what Chapter 4 actually found
□ The objectives, research questions, study area and sample size
  match the paper plan exactly, wherever they appear
□ In Chapter 4, table frequencies add up to the sample size and
  percentages add up to 100; repeated figures match; the
  "illustrative examples" note stays directly under the heading
□ The chapter stays close to its word target

PASS 2 — CITATION AND ACCURACY REVIEW
□ Every in-text citation follows APA 7th, exactly as written in
  the source list: (Surname, Year), (Surname & Surname, Year) or
  (Surname et al., Year)
□ Only the verified sources below are cited — remove or replace
  any citation that is not on the list
□ Ghana-specific sources appear where relevant

PASS 3 — HUMAN VOICE EDIT (Most Important Pass)
Read every paragraph. Find and rewrite:

□ Any sentence that sounds machine-generated or formulaic
□ Any paragraph where all sentences are similar in length
   → Introduce short sentences after long ones
□ Any overused transition (furthermore, moreover, notably etc.)
   → Replace with varied alternatives or restructure
□ Any of these banned words anywhere in the chapter:
   furthermore, moreover, notably, it is worth noting,
   it is important to note, delve into, underscore, pivotal,
   paramount, multifaceted, shed light on, in the realm of,
   leverage, embark on, robust, groundbreaking, cutting-edge
   → Replace every single instance
□ Any section that could have been written about any country
   → Add a specific Ghana reference or data point
□ Any place in Chapter 4 where a finding is reported but not
   interpreted → Add the researcher's own analysis of what it
   means in this Ghanaian setting, in fresh wording
□ Any paragraph where word choices feel uniform or predictable
   → Vary synonyms, restructure sentences, change rhythm

PAPER DETAILS:
Topic: ${topic}
Course: ${course}
Institution Type: ${institutionType}
Target word count for the whole paper: ${wordTarget} words

${plan ? `PAPER PLAN (the chapters must agree with it):\n${plan}\n\n` : ''}VERIFIED SOURCES (only these may be cited, in exactly this form):
${allSources.map(s => `${citationKey(s)} — ${s.title}`).join('\n')}

OUTPUT INSTRUCTIONS:
Return the COMPLETE REVISED CHAPTER only, starting with its
chapter heading. Revise only the chapter marked CHAPTER TO REVISE;
reference material is for consistency checks and must not be
copied into your answer. No commentary. No checklist responses.
No preamble.
  `.trim();
};

/** The per-chapter message for the supervisor (the changing part of each call). */
export const buildChapterSupervisionPrompt = (
  chapterNumber: number,
  chapterTitle: string,
  chapterText: string,
  chapterWordTarget: number,
  paperOutline: string,
  reference: { label: string; text: string }[] = []
): string => {
  const refs = reference
    .filter(r => r.text.trim())
    .map(r => `REFERENCE — ${r.label} (do not revise):\n${r.text}`)
    .join('\n\n');
  return [
    `PAPER OUTLINE:\n${paperOutline}`,
    refs,
    `CHAPTER TO REVISE — Chapter ${chapterNumber}: ${chapterTitle} (target about ${chapterWordTarget} words):\n${chapterText}`,
  ].filter(Boolean).join('\n\n');
};

export const buildAbstractPrompt = (
  fullPaper: string,
  topic: string,
  institutionType: string
): string => {
  return `
Read this complete research paper and write a structured abstract.

ABSTRACT REQUIREMENTS:
- Maximum 350 words, minimum 250 words
- One single paragraph — no internal headings or line breaks
- Past tense for what was done
- Present tense for conclusions and implications
- Must cover ALL of these elements in order:
  1. Background/context (2–3 sentences)
  2. Statement of the problem (1–2 sentences)
  3. Aim/purpose of the study (1 sentence)
  4. Methodology: design, population, sample, tool, analysis
     (2–3 sentences)
  5. Key findings — the 3 most important results
     (2–3 sentences)
  6. Conclusion and recommendation (1–2 sentences)

After the abstract paragraph, on a new line write:
Keywords: [4–6 keywords separated by commas]
Keywords should be the main concepts in the paper.

FULL PAPER:
${fullPaper}

INSTITUTION TYPE: ${institutionType}

Return ONLY the abstract paragraph followed by the keywords line.
Do not include the word "Abstract" as a heading.
Do not include any commentary or preamble.
  `.trim();
};

export const buildTopicRefinementPrompt = (
  topic: string,
  course: string,
  institutionType: string
): string => {
  return `
You are a research advisor helping a Ghanaian ${institutionType} student refine their research topic.

RAW TOPIC: "${topic}"
COURSE: ${course}
INSTITUTION TYPE: ${institutionType}

REFINEMENT RULES:
1. Make the topic more specific and academically focused
2. Ensure it is researchable within the Ghanaian context
3. Add geographic or institutional specificity where possible
4. Keep the core meaning of the original topic
5. Output should be a single clear research title (max 25 words)
6. Do NOT change the subject area — only sharpen the focus
7. Ensure it follows Ghanaian academic convention

Return ONLY the refined topic. No preamble, no explanation, no quotes.
`.trim();
};

export const buildResearchQuestionsPrompt = (
  topic: string,
  course: string,
  institutionType: string
): string => {
  return `
You are helping a Ghanaian ${institutionType} student formulate research questions.

RESEARCH TOPIC: "${topic}"
COURSE: ${course}
INSTITUTION TYPE: ${institutionType}

Generate 3-4 specific, answerable research questions that:
1. Can be investigated through primary or secondary data
2. Are aligned with the topic
3. Follow Ghanaian academic convention
4. Are not philosophical — they must be empirically answerable
5. Cover different aspects of the topic

For each question, prefix with "RQ1:", "RQ2:", etc.
One question per line.
No preamble, no explanation, no bullet points — just the questions.
`.trim();
};

export const CHAPTER_STRUCTURE = {
  chapter1: {
    title: "INTRODUCTION",
    sections: [
      "1.1 Background to the Study",
      "1.2 Statement of the Problem",
      "1.3 Objectives of the Study",
      "1.4 Research Questions",
      "1.5 Significance of the Study",
      "1.6 Scope and Delimitations of the Study",
      "1.7 Organisation of the Study",
      "1.8 Chapter Summary"
    ],
    wordTarget: 1500
  },
  chapter2: {
    title: "LITERATURE REVIEW",
    sections: [
      "2.1 Introduction",
      "2.2 [Theme 1]",
      "2.3 [Theme 2]",
      "2.4 [Theme 3]",
      "2.5 [Theme 4]",
      "2.6 Conceptual/Theoretical Framework",
      "2.7 Chapter Summary"
    ],
    wordTarget: 3500
  },
  chapter3: {
    title: "METHODOLOGY",
    sections: [
      "3.1 Introduction",
      "3.2 Research Design",
      "3.3 Study Area and Population",
      "3.4 Sample and Sampling Technique",
      "3.5 Data Collection Instrument",
      "3.6 Data Collection Procedure",
      "3.7 Data Analysis",
      "3.8 Ethical Considerations",
      "3.9 Chapter Summary"
    ],
    wordTarget: 2000
  },
  chapter4: {
    title: "RESULTS AND DISCUSSION",
    sections: [
      "4.1 Introduction",
      "4.2 Demographic Characteristics of Respondents",
      "4.3 [Finding Theme 1]",
      "4.4 [Finding Theme 2]",
      "4.5 [Finding Theme 3]",
      "4.6 Discussion of Major Findings",
      "4.7 Chapter Summary"
    ],
    wordTarget: 4500
  },
  chapter5: {
    title: "CONCLUSION AND RECOMMENDATIONS",
    sections: [
      "5.1 Introduction",
      "5.2 Summary of Findings",
      "5.3 Conclusions",
      "5.4 Recommendations",
      "5.5 Limitations of the Study",
      "5.6 Suggestions for Further Research"
    ],
    wordTarget: 1500
  }
};
