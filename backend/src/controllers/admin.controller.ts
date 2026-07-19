import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { supabase } from '../db/supabase.js';
import { CONFIG } from '../config/index.js';
import { childLogger } from '../lib/logger.js';
import { auditLog, queryAuditLogs } from '../lib/audit.js';
import { getUsageStats } from '../services/ai/gateway.service.js';
import type { AdminRequest } from '../middleware/admin.middleware.js';

const log = childLogger('admin');

const ADMIN_ACCESS_TOKEN_EXPIRES_IN = '1h';
const ADMIN_REFRESH_TOKEN_EXPIRES_IN = '7d';
const OTP_EXPIRY_MINUTES = 5;

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function logAdminEvent(event: string, details: Record<string, unknown>) {
  log.info({ event, ...details }, `[ADMIN_AUDIT] ${event}`);
  // Persist to DB (fire-and-forget)
  auditLog({
    event: event as any,
    actorEmail: details.email as string,
    metadata: details,
    ip: details.ip as string,
  }).catch(() => {});
}

export async function login(req: AdminRequest, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, email, password_hash, full_name, mfa_enabled')
      .eq('email', email)
      .single();

    if (error || !admin) {
      logAdminEvent('LOGIN_FAILED', { email, reason: 'user_not_found', ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      logAdminEvent('LOGIN_FAILED', { email, reason: 'wrong_password', ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logAdminEvent('PASSWORD_VERIFIED', { email, ip: req.ip });

    if (admin.mfa_enabled) {
      const otp = generateOtp();
      const otpHash = await bcrypt.hash(otp, 10);
      const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

      await supabase
        .from('admin_users')
        .update({ otp_hash: otpHash, otp_expires: otpExpires })
        .eq('id', admin.id);

      logAdminEvent('OTP_SENT', { email, ip: req.ip });

      return res.json({
        mfa_required: true,
        message: 'OTP sent to your email',
        admin_id: admin.id,
        otp_hint: `OTP: ${otp}`,
      });
    }

    const accessToken = jwt.sign(
      { id: admin.id, email: admin.email, isAdmin: true },
      CONFIG.JWT_SECRET,
      { expiresIn: ADMIN_ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { id: admin.id, email: admin.email, isAdmin: true, type: 'refresh' },
      CONFIG.JWT_SECRET,
      { expiresIn: ADMIN_REFRESH_TOKEN_EXPIRES_IN }
    );

    const refreshHash = await bcrypt.hash(refreshToken, 10);
    await supabase
      .from('admin_users')
      .update({ refresh_token: refreshHash })
      .eq('id', admin.id);

    logAdminEvent('LOGIN_SUCCESS', { email, ip: req.ip });

    res.json({
      token: accessToken,
      refreshToken,
      admin: { id: admin.id, email: admin.email, full_name: admin.full_name },
    });
  } catch (err: any) {
    logAdminEvent('LOGIN_ERROR', { email, error: err.message, ip: req.ip });
    res.status(500).json({ error: err.message || 'Login failed' });
  }
}

export async function verifyOtp(req: AdminRequest, res: Response) {
  const { admin_id, otp } = req.body;

  if (!admin_id || !otp) {
    return res.status(400).json({ error: 'Admin ID and OTP required' });
  }

  try {
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, email, full_name, otp_hash, otp_expires')
      .eq('id', admin_id)
      .single();

    if (error || !admin) {
      logAdminEvent('OTP_VERIFY_FAILED', { admin_id, reason: 'user_not_found', ip: req.ip });
      return res.status(401).json({ error: 'Invalid request' });
    }

    if (!admin.otp_hash || !admin.otp_expires) {
      logAdminEvent('OTP_VERIFY_FAILED', { admin_id, reason: 'no_otp_pending', ip: req.ip });
      return res.status(400).json({ error: 'No OTP pending. Please login again.' });
    }

    if (new Date(admin.otp_expires) < new Date()) {
      await supabase
        .from('admin_users')
        .update({ otp_hash: null, otp_expires: null })
        .eq('id', admin.id);

      logAdminEvent('OTP_VERIFY_FAILED', { admin_id: admin.email, reason: 'otp_expired', ip: req.ip });
      return res.status(401).json({ error: 'OTP has expired. Please login again.' });
    }

    const otpValid = await bcrypt.compare(otp, admin.otp_hash);
    if (!otpValid) {
      logAdminEvent('OTP_VERIFY_FAILED', { admin_id: admin.email, reason: 'wrong_otp', ip: req.ip });
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    await supabase
      .from('admin_users')
      .update({ otp_hash: null, otp_expires: null })
      .eq('id', admin.id);

    const accessToken = jwt.sign(
      { id: admin.id, email: admin.email, isAdmin: true },
      CONFIG.JWT_SECRET,
      { expiresIn: ADMIN_ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { id: admin.id, email: admin.email, isAdmin: true, type: 'refresh' },
      CONFIG.JWT_SECRET,
      { expiresIn: ADMIN_REFRESH_TOKEN_EXPIRES_IN }
    );

    const refreshHash = await bcrypt.hash(refreshToken, 10);
    await supabase
      .from('admin_users')
      .update({ refresh_token: refreshHash })
      .eq('id', admin.id);

    logAdminEvent('OTP_VERIFIED_LOGIN_SUCCESS', { email: admin.email, ip: req.ip });

    res.json({
      token: accessToken,
      refreshToken,
      admin: { id: admin.id, email: admin.email, full_name: admin.full_name },
    });
  } catch (err: any) {
    logAdminEvent('OTP_VERIFY_ERROR', { admin_id, error: err.message, ip: req.ip });
    res.status(500).json({ error: err.message || 'OTP verification failed' });
  }
}

export async function refreshToken(req: AdminRequest, res: Response) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, CONFIG.JWT_SECRET) as {
      id: string;
      email: string;
      isAdmin?: boolean;
      type?: string;
    };

    if (decoded.type !== 'refresh' || !decoded.isAdmin) {
      logAdminEvent('REFRESH_FAILED', { reason: 'invalid_token_type', ip: req.ip });
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, email, full_name, refresh_token')
      .eq('id', decoded.id)
      .single();

    if (error || !admin || !admin.refresh_token) {
      logAdminEvent('REFRESH_FAILED', { email: decoded.email, reason: 'no_stored_token', ip: req.ip });
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokenValid = await bcrypt.compare(refreshToken, admin.refresh_token);
    if (!tokenValid) {
      logAdminEvent('REFRESH_FAILED', { email: decoded.email, reason: 'token_mismatch', ip: req.ip });
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const newAccessToken = jwt.sign(
      { id: admin.id, email: admin.email, isAdmin: true },
      CONFIG.JWT_SECRET,
      { expiresIn: ADMIN_ACCESS_TOKEN_EXPIRES_IN }
    );

    const newRefreshToken = jwt.sign(
      { id: admin.id, email: admin.email, isAdmin: true, type: 'refresh' },
      CONFIG.JWT_SECRET,
      { expiresIn: ADMIN_REFRESH_TOKEN_EXPIRES_IN }
    );

    const refreshHash = await bcrypt.hash(newRefreshToken, 10);
    await supabase
      .from('admin_users')
      .update({ refresh_token: refreshHash })
      .eq('id', admin.id);

    logAdminEvent('TOKEN_REFRESHED', { email: admin.email, ip: req.ip });

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err: any) {
    logAdminEvent('REFRESH_ERROR', { error: err.message, ip: req.ip });
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

export async function logout(req: AdminRequest, res: Response) {
  try {
    if (req.admin) {
      await supabase
        .from('admin_users')
        .update({ refresh_token: null })
        .eq('id', req.admin.id);

      logAdminEvent('LOGOUT', { email: req.admin.email, ip: req.ip });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Logout failed' });
  }
}

export async function getOverview(req: AdminRequest, res: Response) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    // Use server-side aggregation instead of loading all rows into memory
    const [usersResult, activeSubsResult, activeStandardResult, activePremiumResult,
      totalPapersResult, completedPapersResult, processingPapersResult,
      todayRevenueResult, totalRevenueResult, failedTxnsResult] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('plan', 'standard'),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('plan', 'premium'),
      supabase.from('papers').select('*', { count: 'exact', head: true }),
      supabase.from('papers').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('papers').select('*', { count: 'exact', head: true }).in('status', ['processing', 'researching', 'drafting', 'supervising']),
      supabase.from('transactions').select('amount_ghs').eq('status', 'success').eq('type', 'credit').gte('created_at', todayStr),
      supabase.from('transactions').select('amount_ghs').eq('status', 'success').eq('type', 'credit'),
      supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    ]);

    const todayRevenue = todayRevenueResult.data?.reduce((sum, t) => sum + (t.amount_ghs || 0), 0) || 0;
    const totalRevenue = totalRevenueResult.data?.reduce((sum, t) => sum + (t.amount_ghs || 0), 0) || 0;

    res.json({
      totalUsers: usersResult.count || 0,
      totalRevenue,
      todayRevenue,
      activeSubscriptions: activeSubsResult.count || 0,
      activeStandard: activeStandardResult.count || 0,
      activePremium: activePremiumResult.count || 0,
      totalPapers: totalPapersResult.count || 0,
      completedPapers: completedPapersResult.count || 0,
      processingPapers: processingPapersResult.count || 0,
      failedTransactions: failedTxnsResult.count || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch overview' });
  }
}

export async function getUsers(req: AdminRequest, res: Response) {
  const { search, institution_type, page = '1', limit = '20' } = req.query as Record<string, string | undefined>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

  try {
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,institution_name.ilike.%${search}%`);
    }
    if (institution_type) {
      query = query.eq('institution_type', institution_type);
    }

    const { data, error, count } = await query.range(from, to).order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      users: data,
      total: count || 0,
      page: pageNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch users' });
  }
}

export async function getUserDetail(req: AdminRequest, res: Response) {
  const { id } = req.params;

  try {
    const [userResult, papersResult, subsResult, txnsResult, walletResult] = await Promise.all([
      supabase.from('users').select('*').eq('id', id).single(),
      supabase.from('papers').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').eq('user_id', id).order('started_at', { ascending: false }),
      supabase.from('transactions').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      supabase.from('wallets').select('*').eq('user_id', id).single()
    ]);

    if (userResult.error || !userResult.data) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: userResult.data,
      papers: papersResult.data || [],
      subscriptions: subsResult.data || [],
      transactions: txnsResult.data || [],
      wallet: walletResult.data
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user' });
  }
}

export async function getTransactions(req: AdminRequest, res: Response) {
  const { status, type, page = '1', limit = '20' } = req.query as Record<string, string | undefined>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

  try {
    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error, count } = await query.range(from, to).order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      transactions: data || [],
      total: count || 0,
      page: pageNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch transactions' });
  }
}

export async function getSubscriptions(req: AdminRequest, res: Response) {
  const { page = '1', limit = '50' } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

  try {
    const { data, error, count } = await supabase
      .from('subscriptions')
      .select('*, users(full_name, email, phone)', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(from, to);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      subscriptions: data || [],
      total: count || 0,
      page: pageNum,
      totalPages: Math.ceil((count || 0) / limitNum),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch subscriptions' });
  }
}

export async function getPapers(req: AdminRequest, res: Response) {
  const { status, page = '1', limit = '20' } = req.query as Record<string, string | undefined>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

  try {
    let query = supabase
      .from('papers')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query.range(from, to).order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      papers: data || [],
      total: count || 0,
      page: pageNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch papers' });
  }
}

export async function getWorkspaces(req: AdminRequest, res: Response) {
  try {
    const { data, error } = await supabase
      .from('workspace_sessions')
      .select('*, users(full_name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ sessions: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch workspaces' });
  }
}

export async function getKnowledgeBase(req: AdminRequest, res: Response) {
  try {
    // Use raw SQL aggregation for efficiency instead of loading all rows
    const countResult = await supabase.from('knowledge_chunks').select('*', { count: 'exact', head: true });

    // Aggregate field counts server-side
    let fieldData: any, sourceData: any;
    try { fieldData = (await supabase.rpc('get_knowledge_field_counts' as any)).data; } catch { fieldData = null; }
    try { sourceData = (await supabase.rpc('get_knowledge_source_counts' as any)).data; } catch { sourceData = null; }

    let byField: Record<string, number> = {};
    let bySource: Record<string, number> = {};

    if (fieldData) {
      for (const row of fieldData as any[]) {
        byField[row.field] = parseInt(row.count, 10);
      }
    } else {
      // Fallback: fetch distinct counts instead of all rows
      const { data: fields } = await supabase.from('knowledge_chunks').select('field');
      const { data: sources } = await supabase.from('knowledge_chunks').select('source_name');
      fields?.forEach(r => { byField[r.field] = (byField[r.field] || 0) + 1; });
      sources?.forEach(r => { bySource[r.source_name] = (bySource[r.source_name] || 0) + 1; });
    }

    if (sourceData) {
      for (const row of sourceData as any[]) {
        bySource[row.source_name] = parseInt(row.count, 10);
      }
    }

    res.json({
      totalChunks: countResult.count || 0,
      byField,
      bySource,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch knowledge base stats' });
  }
}

// --- Audit Logs ---

export async function getAuditLogs(req: AdminRequest, res: Response) {
  try {
    const { event, actor_id, target_type, from, to, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const result = await queryAuditLogs({
      event: event as string,
      actorId: actor_id as string,
      targetType: target_type as string,
      from: from as string,
      to: to as string,
      limit: limitNum,
      offset,
    });

    res.json({
      ...result,
      page: pageNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch audit logs' });
  }
}

// --- AI Usage (Admin) ---

export async function getAiUsage(req: AdminRequest, res: Response) {
  try {
    const days = parseInt(req.query.days as string) || 30;
    // Admin sees global usage (no userId filter)
    const stats = await getUsageStats(undefined, days);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch AI usage' });
  }
}

// --- System Metrics ---

export async function getSystemMetrics(req: AdminRequest, res: Response) {
  try {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    // Database stats
    const [usersCount, papersCount, chunksCount, subsCount] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('papers').select('*', { count: 'exact', head: true }),
      supabase.from('knowledge_chunks').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
    ]);

    res.json({
      server: {
        uptime: Math.floor(uptime),
        memoryMb: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
        nodeVersion: process.version,
        env: CONFIG.NODE_ENV,
      },
      database: {
        users: usersCount.count || 0,
        papers: papersCount.count || 0,
        knowledgeChunks: chunksCount.count || 0,
        subscriptions: subsCount.count || 0,
      },
      aiProviders: {
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
        perplexity: !!process.env.PERPLEXITY_API_KEY,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch system metrics' });
  }
}

// --- Paper Approval ---

export async function approvePaper(req: AdminRequest, res: Response) {
  const { id } = req.params;
  const { action } = req.body; // 'approve' | 'reject'
  const { notes } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve or reject' });
  }

  try {
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { error } = await supabase
      .from('papers')
      .update({
        status: newStatus,
        admin_notes: notes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.admin?.id,
      })
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    logAdminEvent(`PAPER_${newStatus.toUpperCase()}`, {
      paperId: id,
      adminEmail: req.admin?.email,
      notes,
    });

    res.json({ message: `Paper ${action}d successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to approve/reject paper' });
  }
}
