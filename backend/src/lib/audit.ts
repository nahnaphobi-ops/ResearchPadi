import { supabase } from '../db/supabase.js';
import { childLogger } from '../lib/logger.js';

const log = childLogger('audit');

export type AuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'OTP_SENT'
  | 'OTP_VERIFIED'
  | 'OTP_FAILED'
  | 'LOGOUT'
  | 'TOKEN_REFRESHED'
  | 'PAPER_CREATED'
  | 'PAPER_COMPLETED'
  | 'PAPER_FAILED'
  | 'PAPER_DELETED'
  | 'SUBSCRIPTION_CHANGED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'CONTENT_APPROVED'
  | 'CONTENT_REJECTED'
  | 'USER_SUSPENDED'
  | 'SETTINGS_CHANGED'
  | 'ADMIN_ACTION';

interface AuditEntry {
  event: AuditEvent;
  actorId?: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

/**
 * Persist an audit event to the database.
 * Fire-and-forget: logs error but never throws.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      event: entry.event,
      actor_id: entry.actorId || null,
      actor_email: entry.actorEmail || null,
      target_type: entry.targetType || null,
      target_id: entry.targetId || null,
      metadata: entry.metadata || {},
      ip: entry.ip || null,
      user_agent: entry.userAgent || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      log.debug({ err: error.message, event: entry.event }, 'Audit log insert failed');
    }
  } catch (err: any) {
    log.debug({ err: err.message, event: entry.event }, 'Audit log failed');
  }
}

/**
 * Query audit logs with filters.
 */
export async function queryAuditLogs(filters: {
  event?: string;
  actorId?: string;
  targetType?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.event) query = query.eq('event', filters.event);
  if (filters.actorId) query = query.eq('actor_id', filters.actorId);
  if (filters.targetType) query = query.eq('target_type', filters.targetType);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    logs: data || [],
    total: count || 0,
    limit,
    offset,
  };
}
