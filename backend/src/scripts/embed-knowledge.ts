/**
 * Backfill embeddings for knowledge-base chunks that don't have one yet, so the
 * vector half of hybrid search kicks in. Needs OPENAI_API_KEY (or an OpenRouter key).
 *   npx tsx src/scripts/embed-knowledge.ts [--limit=500]
 * Cost guide: text-embedding-3-small is ~US$0.02 per million tokens; the current
 * ~2,700 chunks are roughly 300k tokens (well under one US cent).
 */
import 'dotenv/config';
import { supabase } from '../db/supabase.js';
import { generateEmbeddings } from '../services/rag/embedder.service.js';

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const PAGE = 200;

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set — nothing to do. Hybrid search keeps working on keywords alone.');
  process.exit(1);
}

let done = 0;
while (done < limit) {
  const { data, error } = await supabase
    .from('knowledge_chunks')
    .select('id, document_title, chunk_text')
    .is('embedding', null)
    .limit(Math.min(PAGE, limit - done));
  if (error) { console.error(error.message); process.exit(1); }
  if (!data?.length) break;

  const vectors = await generateEmbeddings(data.map((r) => `${r.document_title}. ${r.chunk_text}`));
  if (vectors.every((v) => v === null)) { console.error('Embedding provider failed; stopping.'); process.exit(1); }

  for (let i = 0; i < data.length; i++) {
    if (!vectors[i]) continue;
    const { error: upErr } = await supabase.from('knowledge_chunks').update({ embedding: vectors[i] }).eq('id', data[i].id);
    if (upErr) console.warn(`Chunk ${data[i].id}: ${upErr.message}`);
  }
  done += data.length;
  console.log(`Embedded ${done} chunks…`);
}
console.log(`Done. ${done} chunks embedded.`);
process.exit(0);
