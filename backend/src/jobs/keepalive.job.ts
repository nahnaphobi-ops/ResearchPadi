import cron from 'node-cron';
import { supabase } from '../db/supabase';
import { childLogger } from '../lib/logger';

const log = childLogger('keepalive');

// Run every 3 days at 12:00 PM to prevent Supabase from pausing after 7 days of inactivity
cron.schedule('0 12 */3 * *', async () => {
  log.info('[KeepAlive] Pinging Supabase to prevent project pausing');

  try {
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (error) {
      log.error({ err: error }, '[KeepAlive] Supabase ping failed');
      return;
    }

    log.info({ count }, '[KeepAlive] Supabase ping successful');
  } catch (err: any) {
    log.error({ err: err.message }, '[KeepAlive] Supabase ping error');
  }
});
