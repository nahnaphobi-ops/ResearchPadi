# OpenCode Working Guide â€” ResearchPadi
**For your developer. Read this before touching any code.**

---

## What OpenCode Is

OpenCode is a terminal AI coding agent. You open your project
folder in the terminal, run `opencode`, and the AI agent reads
your files, writes code, runs commands, and builds features â€”
all from your terminal. No IDE plugin needed.

Think of it as having a senior developer sitting next to you
in the terminal, who can read every file in your project and
write code on your behalf.

---

## How We Work Together

The workflow is:

```
1. Reverend (product owner) defines WHAT to build
2. Architecture doc says HOW it should be structured
3. You open OpenCode in the relevant folder
4. You give OpenCode a precise task from this guide
5. OpenCode writes the code
6. You review, test, and confirm
7. Move to next task
```

Never give OpenCode vague instructions like "build the app."
Always give it one specific, scoped task at a time.

---

## Setting Up The Project (Do This First)

Open Windows Terminal or PowerShell. Run these commands
one by one:

```bash
# 1. Create the project folder
mkdir researchpadi
cd researchpadi

# 2. Create frontend
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install axios zustand @tiptap/react @tiptap/starter-kit
npm install @tiptap/extension-placeholder react-router-dom
cd ..

# 3. Create backend
mkdir backend
cd backend
npm init -y
npm install express cors dotenv helmet express-rate-limit
npm install @supabase/supabase-js @anthropic-ai/sdk
npm install axios node-cron docx pdfmake
npm install -D typescript ts-node nodemon @types/express
npm install -D @types/cors @types/node @types/node-cron
npx tsc --init
cd ..

# 4. Create .gitignore at root
echo "node_modules/
.env
dist/
.env.local" > .gitignore

# 5. Initialise git
git init
git add .
git commit -m "Initial project scaffold"
```

---

## Supabase Setup (Do This Before Backend)

1. Go to supabase.com â€” open your project
2. Go to SQL Editor
3. Run this SQL to enable pgvector and create all tables:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  institution TEXT,
  programme TEXT,
  level TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  balance_ghs DECIMAL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount_ghs DECIMAL NOT NULL,
  reference TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Papers
CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  topic TEXT NOT NULL,
  paper_type TEXT NOT NULL CHECK (paper_type IN ('full_paper', 'workspace')),
  course TEXT,
  institution TEXT,
  word_count INTEGER,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  sections JSONB DEFAULT '{}',
  final_content TEXT,
  sources_used JSONB DEFAULT '[]',
  file_url_docx TEXT,
  file_url_pdf TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- RAG Knowledge Chunks
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vector similarity search index
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
  harvested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users see only their own data)
CREATE POLICY "Users see own profile"
  ON users FOR ALL USING (auth.uid()::text = id::text);

CREATE POLICY "Users see own wallet"
  ON wallets FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE id::text = auth.uid()::text)
  );

CREATE POLICY "Users see own papers"
  ON papers FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE id::text = auth.uid()::text)
  );
```

4. Go to Storage â†’ Create a bucket called `papers` (set to private)

---

## How To Use OpenCode â€” Task By Task

### Starting OpenCode
```bash
# Navigate to the folder you're working in
cd researchpadi/backend

# Start OpenCode
opencode
```

### Example Task Instructions For OpenCode

**Task: Build the auth routes**
```
Read the ARCHITECTURE.md file in docs/ first.
Then build the auth routes in src/routes/auth.routes.ts
and src/controllers/auth.controller.ts.

The auth system works as follows:
- User submits phone number â†’ backend sends SMS OTP via Paystack
- User submits OTP â†’ backend verifies â†’ returns JWT token
- All protected routes check JWT in Authorization header

Use the Supabase client from src/db/supabase.ts.
Use TypeScript throughout. Handle all errors properly.
```

**Task: Build the research service**
```
Read ARCHITECTURE.md and PROMPTS.md in docs/ first.
Build src/services/pipeline/research.service.ts

This service receives a paper topic and returns sources from:
1. OpenAlex API (https://api.openalex.org/works?search=TOPIC)
2. Semantic Scholar API (https://api.semanticscholar.org/graph/v1/paper/search?query=TOPIC)
3. Perplexity Sonar API (live web search)
4. pgvector RAG search (search knowledge_chunks table by embedding similarity)

Return a structured object with all sources combined.
Use the API keys from environment variables.
Handle rate limits and errors gracefully.
```

---

## Golden Rules For OpenCode Sessions

1. **Always start by telling OpenCode to read ARCHITECTURE.md**
   This keeps it oriented to the overall system design.

2. **One service at a time**
   Don't ask OpenCode to build the whole backend at once.
   Build one service, test it, then move to the next.

3. **Always create .env files first**
   OpenCode needs to know the env variable names
   before it writes service files.

4. **Review every file OpenCode creates**
   Read through it. If something looks wrong, tell OpenCode
   specifically what to fix.

5. **Commit after each working feature**
   ```bash
   git add .
   git commit -m "feat: add research service"
   ```

6. **Test each API route with a tool like Bruno or Postman**
   Before moving to the next feature, confirm the current
   one actually works.

---

## Build Order (Follow This Exactly)

### Week 1 â€” Foundation
- [ ] Project scaffolded (done from setup above)
- [ ] Supabase tables created (done from SQL above)
- [ ] Backend: Supabase client setup (src/db/supabase.ts)
- [ ] Backend: Config file (src/config/index.ts)
- [ ] Backend: Express app setup (src/app.ts)
- [ ] Backend: Auth routes + controller
- [ ] Backend: Error middleware
- [ ] Frontend: Tailwind config
- [ ] Frontend: Router setup (react-router-dom)
- [ ] Frontend: Login page (phone + OTP)
- [ ] Frontend: Register page

### Week 2 â€” Paper Pipeline
- [ ] Backend: OpenAlex service
- [ ] Backend: Semantic Scholar service
- [ ] Backend: Perplexity service
- [ ] Backend: Research service (combines all 3)
- [ ] Backend: Sonnet drafting service (chunked)
- [ ] Backend: Fable 5 supervision service
- [ ] Backend: Assembly service
- [ ] Backend: Papers routes + controller
- [ ] Frontend: Full Paper form
- [ ] Frontend: Paper processing page (live status)
- [ ] Frontend: Paper complete + download

### Week 3 â€” Payments & Dashboard
- [ ] Backend: Paystack payment service
- [ ] Backend: Payment routes + webhook
- [ ] Backend: Wallet system
- [ ] Frontend: Dashboard
- [ ] Frontend: Wallet + top-up page
- [ ] Frontend: Payment flow pages

### Week 4 â€” RAG System
- [ ] Supabase: Enable pgvector (done in SQL above)
- [ ] Backend: Document chunker
- [ ] Backend: OpenAI embedder
- [ ] Backend: KNUST OAI-PMH harvester
- [ ] Backend: UGSpace OAI-PMH harvester
- [ ] Backend: AJOL harvester
- [ ] Backend: GJNMID harvester
- [ ] Backend: Contextual retriever
- [ ] Backend: Weekly cron job
- [ ] Integrate RAG into research service

### Week 5 â€” Assisted Workspace
- [ ] Frontend: TipTap editor setup
- [ ] Backend: Workspace routes
- [ ] Frontend + Backend: AI suggestions
- [ ] Frontend + Backend: Find citation
- [ ] Frontend + Backend: Expand section
- [ ] Frontend + Backend: Improve paragraph

### Week 6 â€” Deployment
- [ ] Frontend: Deploy to Vercel
- [ ] Backend: Deploy to Render
- [ ] Environment variables: Set in both platforms
- [ ] End-to-end test: Full paper â†’ payment â†’ download
- [ ] Fix any bugs found in testing

