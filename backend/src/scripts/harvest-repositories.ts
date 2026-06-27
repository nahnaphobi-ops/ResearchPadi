import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { harvestAll, RepositoryConfig, clearResumeState, OaiRecord } from '../services/rag/oai-harvester.service';
import { ingestDocument, downloadPdf, extractPdfText } from '../services/rag/document-ingester.service';
import { generateEmbedding } from '../services/rag/embedder.service';
import { chunkText } from '../services/rag/chunker.service';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const REPOSITORIES: RepositoryConfig[] = [
  {
    name: 'KNUSTSpace',
    oaiBaseUrl: 'http://dspace.knust.edu.gh:8080/oai/request',
    oaiSet: 'knust',
    institution: 'Kwame Nkrumah University of Science and Technology',
    institutionType: 'university',
    dspaceVersion: 6,
  },
  {
    name: 'UGSpace',
    oaiBaseUrl: 'https://ugspace.ug.edu.gh/server/oai/request',
    oaiSet: 'ug',
    institution: 'University of Ghana',
    institutionType: 'university',
    dspaceVersion: 7,
  },
  {
    name: 'UCCSpace',
    oaiBaseUrl: 'https://ir.ucc.edu.gh/oai/request',
    oaiSet: 'ucc',
    institution: 'University of Cape Coast',
    institutionType: 'university',
    dspaceVersion: 6,
  },
  {
    name: 'UEW_IR',
    oaiBaseUrl: 'http://ir.uew.edu.gh/oai/request',
    oaiSet: 'uew',
    institution: 'University of Education, Winneba',
    institutionType: 'college_of_education',
    dspaceVersion: 6,
  },
  {
    name: 'HF_NMTC_Berekum',
    oaiBaseUrl: 'https://ir.nmtcberekum.edu.gh/server/oai/request',
    oaiSet: 'midwifery',
    institution: 'Holy Family Nursing and Midwifery Training College, Berekum',
    institutionType: 'nmtc',
    dspaceVersion: 7,
  },
  {
    name: 'Ashesi_AIR',
    oaiBaseUrl: 'https://air.ashesi.edu.gh/server/oai/request',
    oaiSet: 'ashesi',
    institution: 'Ashesi University',
    institutionType: 'university',
    dspaceVersion: 7,
  },
];

function isCareStudy(record: OaiRecord): boolean {
  const text = `${record.title} ${record.description}`.toLowerCase();
  return (
    text.includes('care study') ||
    text.includes('maternity care') ||
    text.includes('client/family') ||
    text.includes('client and family') ||
    text.includes('family centered') ||
    text.includes('family-centred') ||
    text.includes('midwifery') ||
    text.includes('nursing care')
  );
}

function detectDocumentType(record: OaiRecord, repo: RepositoryConfig): string {
  if (repo.institutionType === 'nmtc' && isCareStudy(record)) return 'care_study';
  const text = `${record.title} ${record.description}`.toLowerCase();
  if (text.includes('thesis') || text.includes('dissertation')) return 'thesis';
  if (text.includes('journal article') || text.includes('published')) return 'journal_article';
  if (text.includes('project report') || text.includes('project work')) return 'project_report';
  return 'other';
}

function buildPdfUrl(record: OaiRecord, repo: RepositoryConfig): string[] {
  const handleId = record.identifier.split(':').pop();
  if (!handleId) return [];

  const baseUrl = repo.oaiBaseUrl.replace(/\/server\/oai\/request$/, '').replace(/\/oai\/request$/, '');
  return [
    `${baseUrl}/bitstream/${handleId}/1/full_text.pdf`,
    `${baseUrl}/bitstream/${handleId}/1`,
    `${baseUrl}/rest/bitstreams/${handleId}/retrieval`,
  ];
}

async function processRecord(record: OaiRecord, repo: RepositoryConfig): Promise<number> {
  const year = record.date ? parseInt(record.date.substring(0, 4)) : null;
  if (!record.title || record.title.trim().length < 10) return 0;

  const baseUrl = repo.oaiBaseUrl.replace(/\/server\/oai\/request$/, '').replace(/\/oai\/request$/, '');
  const idParts = record.identifier.split(':');
  const handle = idParts.length >= 3 ? idParts.slice(2).join(':') : idParts[idParts.length - 1];
  const sourceUrl = `${baseUrl}/handle/${handle}`;

  const existingCheck = await supabase
    .from('knowledge_chunks')
    .select('id')
    .eq('source_url', sourceUrl)
    .limit(1);

  if (existingCheck.error) {
    console.warn(`  Supabase query error for "${record.title?.substring(0, 40)}": ${existingCheck.error.message}`);
    return 0;
  }
  if (existingCheck.data && existingCheck.data.length > 0) return 0;

  const docType = detectDocumentType(record, repo);
  let fullText = record.description || '';

  if (repo.dspaceVersion === 6 && fullText.length < 200) {
    const pdfUrls = buildPdfUrl(record, repo);
    for (const pdfUrl of pdfUrls) {
      if (fullText.length < 200) {
        const pdfBuffer = await downloadPdf(pdfUrl);
        if (pdfBuffer) {
          fullText = await extractPdfText(pdfBuffer);
          if (fullText.length > 50) break;
        }
      }
    }
  }

  if (!fullText || fullText.trim().length < 50) return 0;

  const textChunks = chunkText(fullText, 500, 50);
  let stored = 0;

  for (let i = 0; i < textChunks.length; i++) {
    const chunk = textChunks[i];
    if (chunk.trim().length < 20) continue;

    const embedding = await generateEmbedding(chunk);

    const insertData: Record<string, unknown> = {
      document_title: record.title,
      authors: record.creators.join(', '),
      year: year,
      institution: repo.institution,
      field: record.subject[0] || 'General',
      source_name: repo.name,
      source_url: sourceUrl,
      chunk_text: chunk,
      chunk_index: i,
    };

    if (embedding) {
      insertData.embedding = embedding;
    }

    const { error } = await supabase.from('knowledge_chunks').insert(insertData);
    if (error) {
      if (i === 0) console.warn(`  Insert error for "${record.title?.substring(0, 40)}": ${error.message}`);
      break;
    }
    stored++;
  }

  return stored;
}

async function main() {
  const reset = process.argv.includes('--reset');
  const repoArg = process.argv.find(a => !a.startsWith('--') && a !== process.argv[1] && a !== process.argv[0]);
  const dateArgs = process.argv.filter(a => !a.startsWith('--') && a !== process.argv[1] && a !== process.argv[0] && a !== repoArg);
  const from = dateArgs[0];
  const until = dateArgs[1];

  const repos = repoArg
    ? REPOSITORIES.filter(r => r.name.toLowerCase() === repoArg.toLowerCase())
    : REPOSITORIES;

  console.log(`\n=== Ghana Academic Repository Harvester v2 ===`);
  console.log(`Repositories: ${repos.map(r => r.name).join(', ')}`);
  console.log(`Date range: ${from || 'all'} to ${until || 'now'}`);
  console.log(`Resume: ${reset ? 'NO (fresh start)' : 'YES'}`);
  console.log(`Rate limit: 1 req/sec | Retries: 3 | Safety pages: 200\n`);

  if (reset) {
    for (const repo of repos) {
      clearResumeState(repo.name);
      console.log(`  Cleared state for ${repo.name}`);
    }
  }

  let grandTotalChunks = 0;
  let grandTotalRecords = 0;

  for (const repo of repos) {
    console.log(`\n--- Harvesting from ${repo.name} (${repo.institution}) ---`);
    console.log(`  OAI URL: ${repo.oaiBaseUrl}`);
    console.log(`  Type: ${repo.institutionType} | DSpace: v${repo.dspaceVersion}`);

    let repoChunks = 0;
    let repoRecords = 0;

    try {
      await harvestAll(repo, from, until, async (batch) => {
        for (const record of batch) {
          repoRecords++;
          grandTotalRecords++;
          const chunks = await processRecord(record, repo);
          repoChunks += chunks;
          grandTotalChunks += chunks;

          if (repoRecords % 50 === 0) {
            console.log(`  Progress: ${repoRecords} records | ${repoChunks} chunks | ${grandTotalChunks} total`);
          }
        }
      });
    } catch (err: any) {
      console.error(`  Harvesting failed for ${repo.name}:`, err.message);
    }

    console.log(`  ${repo.name} complete: ${repoRecords} records, ${repoChunks} chunks`);
  }

  console.log(`\n=== Harvest Complete ===`);
  console.log(`Total: ${grandTotalRecords} records, ${grandTotalChunks} chunks stored`);

  const { count } = await supabase
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true });
  console.log(`Knowledge base total: ${count || 0} chunks`);
}

main().catch(console.error);
