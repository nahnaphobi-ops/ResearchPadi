# ResearchPadi — System Architecture
# Version 2.0 — Full Updated Blueprint
# AbusuaITLabs, Kumasi, Ghana

---

## 1. Product Overview

Ghana's first AI-powered academic writing platform.
Built for every Ghanaian tertiary student.

### Target Users
| Institution Type | Examples | Students |
|---|---|---|
| Public Universities | UG, KNUST, UCC, UDS, UEW, UHAS | ~265,000 |
| Private Universities | UPSA, Ashesi, Central, Valley View | ~65,000 |
| NMTCs | NMTC Kumasi, Korle-Bu, Teshie, Agogo | ~40,000 |
| Technical Universities | ATU, Sunyani TU, Ho TU | ~55,000 |
| Colleges of Education | UEW-affiliated CoEs (46 total) | ~47,000 |
| **TOTAL MARKET** | **205 institutions** | **~472,000** |

### Two Services
| Service | What It Does | Price |
|---|---|---|
| Full Paper | AI writes complete 10,000–15,000 word paper | GHS 250 |
| Assisted Workspace Standard | Student writes with AI help | GHS 120/month |
| Assisted Workspace Premium | Standard + Assignment Assistant | GHS 200/month |

---

## 2. The AI Pipeline

### Full Paper Pipeline
```
STUDENT SUBMITS:
Topic, Course, Institution, Programme,
Institution Type, Supervisor Name (optional)
         │
         ▼
STEP 1 — PARALLEL RESEARCH
├── Perplexity Sonar API    → live web facts & current data
├── OpenAlex API            → 250M+ global papers (free)
├── Semantic Scholar API    → 200M+ papers + AI summaries (free)
└── RAG Knowledge Brain     → real Ghanaian university research
         │
         ▼
STEP 2 — RESEARCH SYNTHESIS
Claude Sonnet 4.6 structures all sources
into a research brief for the drafter
         │
         ▼
STEP 3 — CHUNKED DRAFTING (Sonnet 4.6)
Chapter 1: Introduction         (~1,500 words)
Chapter 2: Literature Review    (~3,500 words)
Chapter 3: Methodology          (~2,000 words)
Chapter 4: Results & Discussion (~4,500 words)
Chapter 5: Conclusion           (~1,500 words)
Each chapter = separate API call
         │
         ▼
STEP 4 — ASSEMBLY
All chapters joined into one document
Abstract generated from full paper
Reference list generated in APA 7th
Cover page and Declaration page added
         │
         ▼
STEP 5 — HUMAN VOICE SUPERVISION (Opus 4.8)
Pass 1: Structural review
Pass 2: Citation accuracy check
Pass 3: Human voice edit
  → Remove all AI marker words
  → Vary sentence length and rhythm
  → Add Ghanaian context where missing
  → Ensure researcher voice in Ch.4
  → Polish language to student quality
         │
         ▼
STEP 6 — DELIVERY
Student downloads .docx + .pdf
```

### AI Fallback Routing
```
DRAFTING LAYER
  Primary  → Claude Sonnet 4.6  ($3/$15 per M tokens)
  Fallback → GPT-5.4            ($2.50/$15 per M tokens)

SUPERVISION LAYER
  Primary  → Claude Opus 4.8   ($5/$25 per M tokens)
  Fallback → GPT-5.5           ($5/$30 per M tokens)
```

### Cost Per Paper (15,000 words)
| Step | Cost (USD) |
|---|---|
| Research (Perplexity) | ~$0.02 |
| Drafting — Sonnet 4.6 | ~$0.30 |
| Supervision — Opus 4.8 | ~$0.60 |
| RAG retrieval | $0.00 |
| **Total per paper** | **~$0.92 (~GHS 14)** |

---

## 3. The RAG — Ghanaian Knowledge Brain

### What It Is
A private vector database of Ghanaian academic content.
Gives ResearchPadi knowledge no competitor has.

### Knowledge Sources
| Source | Content | Access |
|---|---|---|
| KNUST Repository | Theses, dissertations, papers | OAI-PMH |
| UGSpace (Univ. of Ghana) | Theses, dissertations | OAI-PMH |
| UCC Repository | Education, sciences | OAI-PMH |
| UEW Repository | Teacher education | OAI-PMH |
| UDS Repository | Dev. studies, health | OAI-PMH |
| UHAS Repository | Health sciences | OAI-PMH |
| UG Journals Portal | Peer-reviewed journals | OJS API |
| AJOL Ghana journals | 500+ African journals | Metadata |
| Ghana Journal of Nursing | Nursing/midwifery | Full text |
| Afribary | African student papers | Partnership |
| GES/NaCCA documents | Education policy | Direct |

### RAG Tech
- Vector Database: pgvector (Supabase extension — free)
- Embedding Model: OpenAI text-embedding-3-small
- Chunk Size: 500 words with 50-word overlap
- Context Prefix: Added to every chunk before embedding
  (Anthropic Contextual Retrieval method — 49% better accuracy)
- Retrieval: Hybrid search (vector + BM25 keyword)
- Top K: Return 5 most relevant chunks per query
- Refresh: Weekly cron job every Sunday 2:00 AM GMT

---

## 4. Writing Quality System

### The Human Voice Principles
Based on research into what makes writing detectable as AI:

```
WHAT AI WRITING DOES (and we avoid):
Low perplexity   → always picks the predictable word
Low burstiness   → all sentences same length/complexity
Uniform style    → no voice variation across paragraphs
Generic context  → could be from any country anywhere
Marker words     → furthermore, moreover, delve into etc.

WHAT RESEARCHPADI PRODUCES:
High perplexity  → varied, deliberate word choices
High burstiness  → short sentences follow long ones
Student voice    → researcher emerges in discussion
Ghana context    → unmistakably Ghanaian content
Natural language → banned AI words replaced throughout
```

### Banned AI Marker Words (enforced in all prompts)
```
Transitional:  furthermore, moreover, additionally,
               it is worth noting, it is important to note,
               notably, in conclusion (as opener)

Vocabulary:    delve into, underscore, pivotal, paramount,
               multifaceted, nuanced, shed light on,
               in the realm of, leverage, embark on,
               robust (for research), groundbreaking,
               cutting-edge, landscape (as metaphor)
```

### Ghana Paper Blueprint
```
FORMATTING STANDARD:
Font:         Times New Roman 12pt
Spacing:      1.5 lines (body)
Margins:      Left 1.5" / Right 1" / Top & Bottom 1"
Alignment:    Justified throughout
Page numbers: Roman (i,ii,iii) prelim / Arabic (1,2,3) Ch.1+

DOCUMENT STRUCTURE:
Title Page → Declaration → Dedication (optional)
→ Acknowledgements → Abstract (250–350 words)
→ Table of Contents → List of Tables → List of Figures
→ Chapter 1 → Chapter 2 → Chapter 3 → Chapter 4
→ Chapter 5 → References → Appendices

CITATION: APA 7th Edition (universal default)
          Harvard (some Technical University departments)

LANGUAGE:
- Third person: "The researcher found..."
- Past tense for methodology and findings
- Present tense for discussing literature
- No contractions ever
- Numbers below 10 spelled out
```

---

## 5. Tech Stack

### Frontend
| Component | Technology |
|---|---|
| Framework | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Editor | TipTap (Assisted Workspace) |
| State | Zustand |
| HTTP | Axios |
| Hosting | Vercel |

### Backend
| Component | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express.js |
| Database | Supabase (PostgreSQL) |
| Vector Store | pgvector (Supabase extension) |
| Auth | Supabase Auth (Phone OTP) |
| File Output | docx + pdfmake |
| Jobs | node-cron (weekly RAG harvest) |
| Hosting | Render |

### AI & Research
| Service | Role | Cost |
|---|---|---|
| Claude Sonnet 4.6 | Drafting (primary) | $3/$15/M tokens |
| GPT-5.4 | Drafting (fallback) | $2.50/$15/M tokens |
| Claude Opus 4.8 | Supervision (primary) | $5/$25/M tokens |
| GPT-5.5 | Supervision (fallback) | $5/$30/M tokens |
| Perplexity Sonar | Live web research | $0.25/$2.50/M |
| OpenAlex API | Global papers | FREE |
| Semantic Scholar | AI paper summaries | FREE |
| OpenAI embeddings | RAG embeddings | ~$0.00002/1K |

### Payments
| Component | Technology |
|---|---|
| Gateway | Hubtel API |
| Methods | MTN Mobile Money + Vodafone Cash |
| Currency | GHS |

---

## 6. Database Schema

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  institution_type TEXT NOT NULL
    CHECK (institution_type IN (
      'university', 'nmtc',
      'technical_university', 'college_of_education'
    )),
  institution_name TEXT NOT NULL,
  programme TEXT,
  level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  balance_ghs DECIMAL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions (Workspace plans)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('standard', 'premium')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount_ghs DECIMAL NOT NULL,
  product TEXT,
  reference TEXT,
  hubtel_reference TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Papers
CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  topic TEXT NOT NULL,
  course TEXT,
  institution_type TEXT,
  institution_name TEXT,
  programme TEXT,
  supervisor_name TEXT,
  target_word_count INTEGER DEFAULT 12000,
  actual_word_count INTEGER,
  status TEXT DEFAULT 'processing'
    CHECK (status IN (
      'processing', 'researching', 'drafting',
      'supervising', 'completed', 'failed'
    )),
  progress_step TEXT,
  chapters JSONB DEFAULT '{}',
  final_content TEXT,
  abstract TEXT,
  sources_used JSONB DEFAULT '[]',
  file_url_docx TEXT,
  file_url_pdf TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Workspace Sessions
CREATE TABLE workspace_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT DEFAULT '',
  course TEXT,
  institution_type TEXT,
  uploaded_materials JSONB DEFAULT '[]',
  sources_used JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignment Sessions
CREATE TABLE assignment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notebook_name TEXT NOT NULL,
  course TEXT NOT NULL,
  institution_type TEXT,
  uploaded_materials JSONB DEFAULT '[]',
  sessions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RAG Knowledge Base
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  source_url TEXT,
  document_title TEXT NOT NULL,
  authors TEXT,
  year INTEGER,
  institution TEXT,
  field TEXT,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector index
CREATE INDEX ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Harvest Logs
CREATE TABLE harvest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  records_fetched INTEGER DEFAULT 0,
  records_added INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  harvested_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Own data only" ON users
  FOR ALL USING (auth.uid()::text = id::text);

CREATE POLICY "Own wallet only" ON wallets
  FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Own papers only" ON papers
  FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Own workspace only" ON workspace_sessions
  FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY "Own assignments only" ON assignment_sessions
  FOR ALL USING (user_id::text = auth.uid()::text);
```

---

## 7. API Routes

### Auth
```
POST  /api/auth/request-otp      send SMS OTP
POST  /api/auth/verify-otp       verify + return JWT
GET   /api/auth/profile           get user profile
PUT   /api/auth/profile           update profile
```

### Papers (Full Paper Service)
```
POST  /api/papers/full            submit paper request
GET   /api/papers                 list user papers
GET   /api/papers/:id             paper details + status
GET   /api/papers/:id/download    download .docx or .pdf
DELETE /api/papers/:id            delete paper
```

### AI Pipeline (internal)
```
POST  /api/pipeline/research      fetch all sources
POST  /api/pipeline/draft         draft chapter (chunked)
POST  /api/pipeline/supervise     Opus 4.8 review
POST  /api/pipeline/assemble      join + format full paper
```

### Workspace
```
POST  /api/workspace/sessions     create new session
GET   /api/workspace/sessions     list sessions
GET   /api/workspace/sessions/:id get session
PUT   /api/workspace/sessions/:id save session
POST  /api/workspace/suggest      AI sentence suggestion
POST  /api/workspace/expand       expand a section
POST  /api/workspace/improve      improve a paragraph
POST  /api/workspace/citation     find citation for claim
POST  /api/workspace/upload       upload course materials
```

### Assignment Assistant
```
POST  /api/assignment/notebooks         create notebook
GET   /api/assignment/notebooks         list notebooks
GET   /api/assignment/notebooks/:id     get notebook
POST  /api/assignment/notebooks/:id/ask       Ask Anything
POST  /api/assignment/notebooks/:id/build     Assignment Builder
POST  /api/assignment/notebooks/:id/notes     Study Notes
POST  /api/assignment/notebooks/:id/quiz      Practice Quiz
POST  /api/assignment/notebooks/:id/improve   Improve My Answer
POST  /api/assignment/notebooks/:id/citation  Citation Finder
```

### Payments
```
POST  /api/payments/initiate      start Hubtel MoMo payment
POST  /api/payments/callback      Hubtel webhook
GET   /api/payments/wallet        wallet balance
GET   /api/payments/history       transaction history
```

### RAG Admin (internal)
```
POST  /api/rag/harvest            trigger manual harvest
GET   /api/rag/stats              knowledge base stats
GET   /api/rag/search?q=          test RAG search
```

---

## 8. Frontend Pages

```
/                           Landing page
/login                      Phone + OTP login
/register                   Phone + profile setup
/dashboard                  Home: papers, subscription, wallet
/new-paper                  Choose service
/new-paper/full             Full Paper intake form
/new-paper/full/processing  Live progress tracker
/new-paper/full/complete    Preview + download
/workspace                  List of workspace sessions
/workspace/:id              TipTap editor + AI sidebar
/assignment                 List of course notebooks
/assignment/:id             Assignment Assistant interface
/wallet                     Balance + top-up + history
/payment/topup              MoMo payment flow
/payment/success            Payment confirmed
/payment/failed             Payment failed
/settings                   Profile + institution details
```

---

## 9. Registration Flow

```
STEP 1: Phone number entry
STEP 2: OTP verification
STEP 3: Profile setup
  - Full name
  - Institution type (University / NMTC /
    Technical University / College of Education)
  - Institution name (searchable dropdown by type)
  - Programme (free text)
  - Level/Year (100L / 200L / 300L / Final Year /
    Year 1 / Year 2 / Year 3 / Diploma Year 1/2/3)
STEP 4: Dashboard
```

---

## 10. Project Folder Structure

```
researchpadi/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── ui/               reusable UI components
│       │   ├── layout/           Header, Sidebar, Footer
│       │   ├── paper/            Full Paper components
│       │   ├── workspace/        TipTap editor components
│       │   ├── assignment/       Assignment Assistant components
│       │   └── payment/          Payment flow components
│       ├── pages/
│       │   ├── Landing.tsx
│       │   ├── Login.tsx
│       │   ├── Register.tsx
│       │   ├── Dashboard.tsx
│       │   ├── NewPaper.tsx
│       │   ├── FullPaperForm.tsx
│       │   ├── PaperProcessing.tsx
│       │   ├── PaperComplete.tsx
│       │   ├── Workspace.tsx
│       │   ├── WorkspaceEditor.tsx
│       │   ├── AssignmentList.tsx
│       │   ├── AssignmentNotebook.tsx
│       │   ├── Wallet.tsx
│       │   └── Settings.tsx
│       ├── hooks/
│       ├── store/
│       ├── services/
│       ├── types/
│       └── utils/
│
├── backend/
│   └── src/
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── papers.routes.ts
│       │   ├── workspace.routes.ts
│       │   ├── assignment.routes.ts
│       │   ├── payments.routes.ts
│       │   └── rag.routes.ts
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   ├── papers.controller.ts
│       │   ├── workspace.controller.ts
│       │   ├── assignment.controller.ts
│       │   ├── payments.controller.ts
│       │   └── rag.controller.ts
│       ├── services/
│       │   ├── pipeline/
│       │   │   ├── research.service.ts
│       │   │   ├── draft.service.ts
│       │   │   ├── supervise.service.ts
│       │   │   └── assemble.service.ts
│       │   ├── rag/
│       │   │   ├── harvester.service.ts
│       │   │   ├── embedder.service.ts
│       │   │   ├── retriever.service.ts
│       │   │   └── chunker.service.ts
│       │   ├── ai/
│       │   │   ├── router.service.ts
│       │   │   ├── sonnet.service.ts
│       │   │   ├── opus.service.ts
│       │   │   ├── gpt54.service.ts
│       │   │   └── gpt55.service.ts
│       │   ├── citations/
│       │   │   ├── openalex.service.ts
│       │   │   ├── semantic.service.ts
│       │   │   └── formatter.service.ts
│       │   ├── workspace/
│       │   │   ├── suggest.service.ts
│       │   │   ├── expand.service.ts
│       │   │   ├── improve.service.ts
│       │   │   └── citation.service.ts
│       │   ├── assignment/
│       │   │   ├── ask.service.ts
│       │   │   ├── builder.service.ts
│       │   │   ├── notes.service.ts
│       │   │   ├── quiz.service.ts
│       │   │   └── improve.service.ts
│       │   ├── documents/
│       │   │   ├── docx.service.ts
│       │   │   └── pdf.service.ts
│       │   └── payments/
│       │       └── hubtel.service.ts
│       ├── middleware/
│       │   ├── auth.middleware.ts
│       │   ├── subscription.middleware.ts
│       │   ├── rateLimit.middleware.ts
│       │   └── error.middleware.ts
│       ├── jobs/
│       │   └── harvest.job.ts
│       ├── db/
│       │   └── supabase.ts
│       ├── config/
│       │   └── index.ts
│       └── app.ts
│
└── docs/
    ├── ARCHITECTURE.md     ← this file
    ├── OPENCODE_GUIDE.md   ← developer workflow
    ├── PROMPTS.md          ← all AI prompts
    ├── RAG_SETUP.md        ← RAG system guide
    └── SESSION_STARTER.txt ← paste at start of OpenCode
```

---

## 11. Environment Variables

### Backend (.env)
```env
PORT=5000
NODE_ENV=development

SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
PERPLEXITY_API_KEY=your_perplexity_key

HUBTEL_CLIENT_ID=your_hubtel_client_id
HUBTEL_CLIENT_SECRET=your_hubtel_client_secret
HUBTEL_SENDER_ID=ResearchPadi

SUPABASE_STORAGE_BUCKET=papers
JWT_SECRET=your_jwt_secret_min_32_chars

EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
RAG_CHUNK_SIZE=500
RAG_CHUNK_OVERLAP=50
RAG_TOP_K=5
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## 12. AI Config File
# src/config/index.ts — controls model routing

```typescript
export const AI_CONFIG = {
  drafting: {
    primary: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6'
    },
    fallback: {
      provider: 'openai',
      model: 'gpt-5.4'
    }
  },
  supervision: {
    primary: {
      provider: 'anthropic',
      model: 'claude-opus-4-8'
    },
    fallback: {
      provider: 'openai',
      model: 'gpt-5.5'
    }
  }
};
```

---

## 13. Build Phases

### Phase 1 — Core (Revenue First) — Weeks 1–3
- [ ] Project scaffold (frontend + backend)
- [ ] Supabase tables + pgvector enabled
- [ ] Auth (phone OTP login + register with institution)
- [ ] AI router service (primary + fallback logic)
- [ ] Research service (OpenAlex + Semantic Scholar + Perplexity)
- [ ] Chunked drafting service (Sonnet 4.6)
- [ ] Supervision service (Opus 4.8) + human voice prompts
- [ ] Assembly service (chapters + abstract + cover + declaration)
- [ ] .docx generation
- [ ] Full Paper form + processing page + completion page
- [ ] MoMo payment (Hubtel)
- [ ] Wallet system
- [ ] Dashboard

### Phase 2 — RAG (Week 4)
- [ ] pgvector confirmed active
- [ ] Document chunker
- [ ] OpenAI embedder
- [ ] KNUST + UGSpace OAI-PMH harvesters
- [ ] UCC + UEW + UDS + UHAS harvesters
- [ ] AJOL Ghana harvester
- [ ] GJNMID nursing journal harvester
- [ ] GES/NaCCA document harvester
- [ ] Contextual retrieval (Anthropic method)
- [ ] Weekly cron job
- [ ] RAG integrated into research service

### Phase 3 — Assisted Workspace (Week 5)
- [ ] TipTap editor setup
- [ ] Workspace sessions (save + resume)
- [ ] AI sentence suggestions
- [ ] Find Citation feature
- [ ] Expand Section feature
- [ ] Improve Paragraph feature
- [ ] Subscription middleware (Standard check)
- [ ] Export workspace to .docx

### Phase 4 — Assignment Assistant (Week 6)
- [ ] Course Notebook creation
- [ ] Upload Your Materials feature (PDF + DOCX parsing)
- [ ] Ask Anything tool
- [ ] Assignment Builder tool
- [ ] Study Notes Generator
- [ ] Practice Quiz Generator
- [ ] Citation Finder
- [ ] Improve My Answer tool
- [ ] Premium subscription gate

### Phase 5 — Deployment & Launch
- [ ] Frontend → Vercel
- [ ] Backend → Render
- [ ] All env variables set in both platforms
- [ ] End-to-end test (Full Paper → payment → download)
- [ ] End-to-end test (Workspace → subscription → AI tools)
- [ ] End-to-end test (Assignment → upload → Ask Anything)
- [ ] Fix all bugs
- [ ] Launch

