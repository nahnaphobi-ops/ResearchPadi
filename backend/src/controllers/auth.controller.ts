import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';
import { CONFIG } from '../config/index.js';
import { childLogger } from '../lib/logger.js';
import { generateNumericOtp, storeOtp, consumeOtp, normalizePhone, claimOtpCooldown, releaseOtpCooldown, OTP_TTL_MINUTES } from '../lib/otp-store.js';
import { toGhanaMsisdn } from '../lib/phone.js';
import { isArkeselConfigured, sendSms } from '../services/sms/arkesel.service.js';

const log = childLogger('auth');

const PROFILE_FIELDS = ['full_name', 'institution_type', 'institution_name', 'programme', 'level'] as const;
const DEMO_PHONE = process.env.DEMO_PHONE || '+233200000000';
const DEMO_OTP = process.env.DEMO_OTP || '123456';

function demoLoginAllowed(): boolean {
  if (process.env.ALLOW_DEMO_LOGIN === 'true') return true;
  if (process.env.ALLOW_DEMO_LOGIN === 'false') return false;
  return CONFIG.NODE_ENV !== 'production';
}

function pickProfileUpdates(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  for (const key of PROFILE_FIELDS) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  return updates;
}

function signUserToken(payload: { id?: string; phone: string }) {
  return jwt.sign(payload, CONFIG.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
}

export const requestOtp = async (req: Request, res: Response) => {
  const phone = normalizePhone(req.body?.phone || '');

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // The demo account signs in with DEMO_OTP; never spend SMS credit on it.
  if (demoLoginAllowed() && phone === DEMO_PHONE) {
    return res.json({ message: 'OTP sent successfully' });
  }

  const msisdn = toGhanaMsisdn(phone);
  if (!msisdn) {
    return res.status(400).json({ error: 'Enter a valid Ghanaian mobile number, e.g. 0244123456' });
  }

  const smsEnabled = isArkeselConfigured();
  if (!smsEnabled && CONFIG.NODE_ENV === 'production') {
    log.error('OTP requested but Arkesel SMS is not configured');
    return res.status(503).json({ error: 'Phone sign-in is temporarily unavailable. Please try again later.' });
  }

  if (!(await claimOtpCooldown('user', msisdn))) {
    return res.status(429).json({ error: 'A code was just sent to this number. Please wait a minute before requesting another.' });
  }

  const otp = generateNumericOtp();
  await storeOtp('user', phone, otp);

  if (smsEnabled) {
    const sent = await sendSms(
      msisdn,
      `Your ResearchPadi code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes. Do not share it with anyone.`
    );
    if (!sent) {
      await releaseOtpCooldown('user', msisdn);
      return res.status(502).json({ error: "We couldn't send your code. Please try again in a moment." });
    }
    log.info({ phone }, 'OTP sent by SMS');
  } else {
    log.info({ phone }, 'OTP generated for development login (Arkesel not configured)');
    log.debug({ phone, otp }, 'Development OTP (not returned to client)');
  }

  res.json({ message: 'OTP sent successfully' });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const phone = normalizePhone(req.body?.phone || '');
  const otp = String(req.body?.otp || '');

  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  const isDemo = demoLoginAllowed() && phone === DEMO_PHONE && otp === DEMO_OTP;
  const isDevBypass = CONFIG.NODE_ENV !== 'production' && otp === DEMO_OTP;
  const valid = isDemo || isDevBypass || await consumeOtp('user', phone, otp);

  if (!valid) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  let { data: user, error } = await supabase
    .from('users')
    .select('id, phone, full_name, institution_type, institution_name, programme, level, created_at')
    .eq('phone', phone)
    .maybeSingle();

  if (error) {
    log.error({ err: error.message }, 'Failed to look up user');
    return res.status(500).json({ error: 'Verification failed' });
  }

  const isNewUser = !user;
  const userId = user?.id;

  const token = signUserToken({ id: userId, phone });

  res.json({
    token,
    user: user || { phone },
    isNewUser,
  });
};

export const getProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { data: user, error } = await supabase
    .from('users')
    .select('id, phone, full_name, institution_type, institution_name, programme, level, created_at')
    .eq('id', userId)
    .single();

  if (error) return res.status(500).json({ error: 'Failed to load profile' });
  res.json(user);
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const phone = (req as any).user?.phone;
  const updates = pickProfileUpdates(req.body || {});

  if (!userId) {
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({ ...updates, phone })
      .select('id, phone, full_name, institution_type, institution_name, programme, level, created_at')
      .single();

    if (createError) {
      log.error({ err: createError.message }, 'Failed to create user');
      return res.status(500).json({ error: 'Failed to create profile' });
    }

    const newToken = signUserToken({ id: newUser.id, phone });
    return res.json({ user: newUser, token: newToken });
  }

  const { data: user, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id, phone, full_name, institution_type, institution_name, programme, level, created_at')
    .single();

  if (error) return res.status(500).json({ error: 'Failed to update profile' });
  res.json(user);
};
