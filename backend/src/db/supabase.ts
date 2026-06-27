import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { CONFIG } from '../config';
import { childLogger } from '../lib/logger';
import dotenv from 'dotenv';

dotenv.config();

const log = childLogger('db');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  log.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'researchpadi-backend',
    },
  },
});

// --- Native PG pool for direct DB access with connection pooling ---
let writePool: Pool | null = null;
let readPool: Pool | null = null;

const POOL_CONFIG = {
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500,
};

export function getWritePool(): Pool {
  if (!writePool) {
    const connectionString = CONFIG.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL not configured');
    }
    writePool = new Pool({
      connectionString,
      ...POOL_CONFIG,
    });

    writePool.on('error', (err) => log.error({ err }, 'Write pool error'));
    writePool.on('connect', () => log.debug('Write pool connected'));
    log.info({ max: POOL_CONFIG.max }, 'Database write pool created');
  }
  return writePool;
}

export function getReadPool(): Pool {
  const readUrl = process.env.DATABASE_READ_REPLICA_URL || CONFIG.DATABASE_URL;
  if (readUrl === CONFIG.DATABASE_URL) {
    return getWritePool();
  }

  if (!readPool) {
    readPool = new Pool({
      connectionString: readUrl,
      ...POOL_CONFIG,
    });
    readPool.on('error', (err) => log.error({ err }, 'Read pool error'));
    log.info({ max: POOL_CONFIG.max }, 'Database read pool created');
  }
  return readPool;
}

export async function closePools(): Promise<void> {
  const promises: Promise<void>[] = [];
  if (writePool) {
    promises.push(writePool.end().then(() => { writePool = null; }));
  }
  if (readPool) {
    promises.push(readPool.end().then(() => { readPool = null; }));
  }
  await Promise.all(promises);
}
