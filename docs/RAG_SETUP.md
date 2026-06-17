# ResearchPadi — RAG System Setup Guide
**The Ghanaian Knowledge Brain**

---

## What This Guide Covers

How to build the RAG (Retrieval-Augmented Generation) system
that gives ResearchPadi knowledge of real Ghanaian academic
research. No competitor has this. This is your moat.

---

## How It Works (Simple)

```
STEP 1 — HARVEST
  Visit Ghanaian university repositories
  Download paper titles, abstracts, authors, years

STEP 2 — CHUNK
  Split each paper abstract/content into 500-word pieces
  Each piece = one "chunk"

STEP 3 — EMBED
  Convert each chunk into numbers (a "vector")
  using OpenAI text-embedding-3-small
  These numbers represent the MEANING of the text

STEP 4 — STORE
  Save all vectors in pgvector (inside Supabase)
  This is the Knowledge Brain

STEP 5 — RETRIEVE (at paper request time)
  Convert student's topic into a vector
  Search Knowledge Brain for most similar vectors
  Return top 5 matching Ghanaian sources
  Pass them to Sonnet for citation in the paper
```

---

## Harvesting Sources

### Source 1: KNUST Repository (OAI-PMH)
```
Base URL: https://ir.knust.edu.gh/oai/request
Protocol: OAI-PMH v2.0
Format: oai_dc (Dublin Core)

Example harvest URL:
https://ir.knust.edu.gh/oai/request?verb=ListRecords&metadataPrefix=oai_dc

Fields to extract:
  - dc:title       → document_title
  - dc:creator     → authors
  - dc:date        → year
  - dc:description → abstract (use as chunk_text)
  - dc:identifier  → source_url (DOI or handle)
  - dc:subject     → field
```

### Source 2: UGSpace — University of Ghana (OAI-PMH)
```
Base URL: https://ugspace.ug.edu.gh/oai/request
Protocol: OAI-PMH v2.0

Example harvest URL:
https://ugspace.ug.edu.gh/oai/request?verb=ListRecords&metadataPrefix=oai_dc

Same fields as KNUST above.
```

### Source 3: AJOL — African Journals Online
```
Website: https://www.ajol.info
Ghana journals page: https://www.ajol.info/index.php/ajol/browseBy/country-ghana

Approach: Harvest metadata from AJOL's open access Ghana journals
          using their OAI endpoint or direct page parsing.

OAI Base: https://www.ajol.info/index.php/[journal_id]/oai

Key Ghana journals on AJOL:
  - Ghana Medical Journal
  - Ghana Journal of Agricultural Science
  - Journal of Science and Technology (KNUST)
  - Ghana Social Science Journal
  - Health Sciences Investigations Journal
```

### Source 4: Ghana Journal of Nursing & Midwifery (GJNMID)
```
Platform: ResearchGate / EGRC Ghana
Focus: Nursing and midwifery — directly relevant to NMTC students
Approach: Manual curation of open access articles
          + contact EGRC Ghana for data partnership
```

---

## The Harvester Code Structure

### File: `src/services/rag/harvester.service.ts`

Tell OpenCode to build this with the following logic:

```typescript
// What this service does:

// 1. OAI-PMH Harvester function
// Takes a base URL and source name
// Fetches all records using OAI-PMH ListRecords verb
// Handles resumptionToken for pagination (max 100 records per page)
// Extracts: title, authors, date, description, identifier, subject
// Returns array of HarvestRecord objects

// 2. AJOL Harvester function  
// Fetches from AJOL Ghana journals
// Parses metadata available in open access section
// Returns array of HarvestRecord objects

// 3. Main harvest() function
// Calls all harvesters
// Deduplicates records (by title + year)
// Passes new records to chunker
// Logs results to harvest_logs table
// Runs on schedule (weekly cron)

// HarvestRecord type:
interface HarvestRecord {
  source_name: string;
  source_url: string;
  document_title: string;
  authors: string;
  year: number;
  institution: string;
  field: string;
  abstract: string;  // This becomes chunk_text
}
```

---

## The Chunker

### File: `src/services/rag/chunker.service.ts`

```typescript
// What this service does:
// Takes a HarvestRecord with an abstract
// Splits the abstract into chunks of ~500 words
// Each chunk overlaps by 50 words with the previous
// (overlap helps retrieval across chunk boundaries)
// Returns array of chunks ready for embedding

// For short abstracts (< 500 words):
//   The whole abstract = one chunk

// For long abstracts or full text (> 500 words):
//   Split at sentence boundaries
//   Target 500 words per chunk
//   50 word overlap between chunks
```

---

## The Embedder

### File: `src/services/rag/embedder.service.ts`

```typescript
// What this service does:
// Takes an array of text chunks
// Calls OpenAI text-embedding-3-small API
// Returns vector array (1536 dimensions) for each chunk
// Stores in knowledge_chunks table with embedding column

// OpenAI embedding call:
// POST https://api.openai.com/v1/embeddings
// Body: { input: chunkText, model: "text-embedding-3-small" }
// Returns: { data: [{ embedding: number[] }] }

// Batch embeddings: process 100 chunks at a time
// to avoid rate limits
```

---

## The Retriever

### File: `src/services/rag/retriever.service.ts`

```typescript
// What this service does:
// Takes a student's paper topic (string)
// Embeds the topic using same OpenAI model
// Searches knowledge_chunks using pgvector cosine similarity
// Returns top 5 most relevant chunks

// Supabase pgvector query:
// SELECT *, 1 - (embedding <=> query_vector) AS similarity
// FROM knowledge_chunks
// ORDER BY embedding <=> query_vector
// LIMIT 5;

// Also apply Contextual Retrieval:
// Use BM25 keyword search alongside vector search
// Combine both results (hybrid search)
// Re-rank combined results by relevance
// Return top 5 final sources
```

---

## The Weekly Cron Job

### File: `src/jobs/harvest.job.ts`

```typescript
// Runs every Sunday at 2:00 AM Ghana time (UTC+0)
// Calls harvester.service.ts harvest() function
// Logs results to console and harvest_logs table
// Does not re-embed documents already in the database
//   (check by source_url before adding)

// Cron schedule: '0 2 * * 0'
// (minute=0, hour=2, day=*, month=*, weekday=0/Sunday)
```

---

## Integrating RAG Into The Research Service

### File: `src/services/pipeline/research.service.ts`

When building the main research service, tell OpenCode:

```
The research service must call these 4 sources in parallel:
1. OpenAlex API — search by topic keyword
2. Semantic Scholar API — search by topic keyword  
3. Perplexity Sonar API — live web search for current context
4. RAG retriever — search knowledge_chunks by topic vector

Use Promise.all() to run all 4 in parallel for speed.
Combine all results into one structured object.
Return: { globalSources, ghanaianSources, webFindings }
```

---

## Testing The RAG System

Once built, test it in this order:

```bash
# 1. Trigger a manual harvest
POST /api/rag/harvest
Body: { "source": "knust" }

# 2. Check harvest results
GET /api/rag/stats
Expected: { totalChunks: X, sources: [...] }

# 3. Test retrieval
GET /api/rag/search?q=maternal+health+Ghana
Expected: 5 relevant Ghanaian paper chunks

# 4. Run a full paper with RAG active
POST /api/papers/full
Body: { topic: "Maternal health outcomes in Ghana", ... }
Expected: Paper cites KNUST/UG/AJOL sources
```

---

## Important: Contextual Retrieval

Standard RAG loses context when splitting documents.
Anthropic's Contextual Retrieval fixes this.

Tell OpenCode when building the chunker:

```
Before embedding each chunk, prepend a context sentence:
"This chunk is from a paper titled '[TITLE]' by [AUTHORS] 
from [INSTITUTION] ([YEAR]). The paper is about [FIELD]."

This context sentence is embedded WITH the chunk text.
It dramatically improves retrieval accuracy.
This is Anthropic's recommended approach.
Reference: https://www.anthropic.com/news/contextual-retrieval
```
