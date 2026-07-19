import axios from 'axios';
import { supabase } from '../../db/supabase.js';
import { chunkText } from './chunker.service.js';
import { generateEmbedding } from './embedder.service.js';
import { CONFIG } from '../../config/index.js';

interface HarvestRecord {
  source_name: string;
  source_url: string;
  document_title: string;
  authors: string;
  year: number;
  institution: string;
  field: string;
  abstract: string;
}

/**
 * Fetch records from an OAI-PMH repository using ListRecords verb.
 * Handles resumptionToken pagination automatically.
 */
const fetchOaiPmhRecords = async (
  baseUrl: string,
  sourceName: string,
  institution: string
): Promise<HarvestRecord[]> => {
  const records: HarvestRecord[] = [];
  let url = `${baseUrl}?verb=ListRecords&metadataPrefix=oai_dc`;
  let page = 0;
  const maxPages = 10;

  while (url && page < maxPages) {
    try {
      const response = await axios.get(url, { timeout: 30000 });
      const xml = response.data;

      // Parse records from OAI-PMH XML response
      const recordBlocks = xml.split('<record>').slice(1);

      for (const block of recordBlocks) {
        if (!block.includes('<header>')) continue;
        if (block.includes('<status>deleted</status>')) continue;

        const title = extractXmlTag(block, 'title');
        const creators = extractXmlTag(block, 'creator');
        const date = extractXmlTag(block, 'date');
        const description = extractXmlTag(block, 'description');
        const identifier = extractXmlTag(block, 'identifier');
        const subject = extractXmlTag(block, 'subject');

        if (!title || !description) continue;

        const year = date ? parseInt(date.substring(0, 4)) : new Date().getFullYear();

        records.push({
          source_name: sourceName,
          source_url: identifier || baseUrl,
          document_title: title.trim(),
          authors: creators || 'Unknown',
          year: isNaN(year) ? new Date().getFullYear() : year,
          institution,
          field: subject || 'General',
          abstract: description.trim()
        });
      }

      // Check for resumptionToken
      const tokenMatch = xml.match(/<resumptionToken[^>]*>([^<]+)<\/resumptionToken>/);
      if (tokenMatch && tokenMatch[1].trim()) {
        url = `${baseUrl}?verb=ListRecords&resumptionToken=${tokenMatch[1].trim()}`;
        page++;
      } else {
        break;
      }
    } catch (err) {
      console.error(`OAI-PMH fetch error for ${sourceName}:`, (err as Error).message);
      break;
    }
  }

  return records;
};

/**
 * Extract content from an XML tag (simple parser, no dependencies).
 */
const extractXmlTag = (xml: string, tag: string): string => {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
};

/**
 * Check if a record already exists in the knowledge_chunks table by source_url.
 */
const recordExists = async (sourceUrl: string): Promise<boolean> => {
  const { data } = await supabase
    .from('knowledge_chunks')
    .select('id')
    .eq('source_url', sourceUrl)
    .limit(1);
  return !!(data && data.length > 0);
};

/**
 * Store a harvest record: chunk the abstract, embed, and insert into knowledge_chunks.
 */
const storeRecord = async (record: HarvestRecord): Promise<number> => {
  const chunks = chunkText(
    record.abstract,
    CONFIG.RAG.CHUNK_SIZE,
    CONFIG.RAG.CHUNK_OVERLAP
  );

  let stored = 0;
  for (let i = 0; i < chunks.length; i++) {
    const contextPrefix = `This chunk is from a paper titled '${record.document_title}' by ${record.authors} from ${record.institution} (${record.year}). The paper is about ${record.field}. `;
    const textToEmbed = contextPrefix + chunks[i];

    const embedding = await generateEmbedding(textToEmbed);
    if (!embedding) continue;

    const { error } = await supabase.from('knowledge_chunks').insert({
      source_name: record.source_name,
      source_url: record.source_url,
      document_title: record.document_title,
      authors: record.authors,
      year: record.year,
      institution: record.institution,
      field: record.field,
      chunk_text: chunks[i],
      chunk_index: i,
      embedding
    });

    if (!error) stored++;
  }
  return stored;
};

/**
 * Log harvest results to the harvest_logs table.
 */
const logHarvest = async (
  source: string,
  fetched: number,
  added: number,
  status: string,
  errorMessage?: string
) => {
  await supabase.from('harvest_logs').insert({
    source,
    records_fetched: fetched,
    records_added: added,
    status,
    error_message: errorMessage || null
  });
};

/**
 * Harvest from KNUST institutional repository via OAI-PMH.
 */
export const harvestKNUST = async () => {
  console.log('Harvesting KNUST repository...');
  const baseUrl = 'https://ir.knust.edu.gh/oai/request';

  try {
    const records = await fetchOaiPmhRecords(baseUrl, 'KNUST', 'Kwame Nkrumah University of Science and Technology');
    let added = 0;

    for (const record of records) {
      const exists = await recordExists(record.source_url);
      if (!exists) {
        added += await storeRecord(record);
      }
    }

    await logHarvest('KNUST', records.length, added, 'success');
    console.log(`KNUST harvest complete: ${records.length} fetched, ${added} chunks added`);
  } catch (err) {
    const message = (err as Error).message;
    await logHarvest('KNUST', 0, 0, 'error', message);
    console.error('KNUST harvest failed:', message);
  }
};

/**
 * Harvest from UGSpace (University of Ghana) via OAI-PMH.
 */
export const harvestUGSpace = async () => {
  console.log('Harvesting UGSpace repository...');
  const baseUrl = 'https://ugspace.ug.edu.gh/oai/request';

  try {
    const records = await fetchOaiPmhRecords(baseUrl, 'UGSpace', 'University of Ghana');
    let added = 0;

    for (const record of records) {
      const exists = await recordExists(record.source_url);
      if (!exists) {
        added += await storeRecord(record);
      }
    }

    await logHarvest('UGSpace', records.length, added, 'success');
    console.log(`UGSpace harvest complete: ${records.length} fetched, ${added} chunks added`);
  } catch (err) {
    const message = (err as Error).message;
    await logHarvest('UGSpace', 0, 0, 'error', message);
    console.error('UGSpace harvest failed:', message);
  }
};

/**
 * Run the full harvest across all Ghanaian sources.
 */
export const runFullHarvest = async () => {
  console.log('Starting full RAG harvest...');
  await harvestKNUST();
  await harvestUGSpace();
  console.log('Full RAG harvest complete.');
};
