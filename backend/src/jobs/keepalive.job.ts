import cron from 'node-cron';
import { supabase } from '../db/supabase.js';
import { childLogger } from '../lib/logger.js';

const log = childLogger('keepalive');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'bpmfpxkuknchflpctmbr';

async function pingSupabaseRest() {
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true });

  if (error) {
    log.error({ err: error }, '[KeepAlive] Supabase REST ping failed');
    return false;
  }

  log.info({ count }, '[KeepAlive] Supabase REST ping successful');
  return true;
}

async function ensureProjectActiveViaPat() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    log.debug('[KeepAlive] SUPABASE_ACCESS_TOKEN not set — skip Management API');
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}`, { headers });
  if (!res.ok) {
    log.error({ status: res.status }, '[KeepAlive] Failed to fetch project status');
    return;
  }

  const project = (await res.json()) as { status?: string; name?: string };
  const status = project.status || 'UNKNOWN';
  log.info({ status, name: project.name }, '[KeepAlive] ResearchPadi project status');

  const needsRestore =
    status.startsWith('INACTIVE') ||
    status.startsWith('PAUSED') ||
    status === 'GOING_DOWN';

  if (!needsRestore) return;

  log.warn({ status }, '[KeepAlive] Project paused/inactive — restoring via Management API');
  const restore = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/restore`, {
    method: 'POST',
    headers,
  });
  log.info({ httpStatus: restore.status }, '[KeepAlive] Restore requested');
}

// Every 6 hours: keep Supabase from pausing after ~7 days of inactivity
cron.schedule('0 */6 * * *', async () => {
  log.info('[KeepAlive] Pinging Supabase to prevent project pausing');

  try {
    await ensureProjectActiveViaPat();
    await pingSupabaseRest();
  } catch (err: any) {
    log.error({ err: err.message }, '[KeepAlive] Supabase ping error');
  }
});
