import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase';
import { CONFIG } from '../config';
import { childLogger } from '../lib/logger';

const log = childLogger('auth');

export const requestOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // TODO: Implement Hubtel SMS OTP sending logic
  log.info({ phone }, 'Sending OTP');
  
  res.json({ message: 'OTP sent successfully (simulated)' });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  // Simulated OTP verification for now
  if (otp !== '123456') {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  // Find user in Supabase
  let { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }

  let isNewUser = false;
  let userId = user?.id;

  if (!user) {
    isNewUser = true;
  }

  const token = jwt.sign(
    { id: userId, phone },
    CONFIG.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: user || { phone },
    isNewUser
  });
};

export const getProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(user);
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const updates = req.body;

  // If userId is missing (new user registration), it will be handled by upsert or we might need to be careful
  // In our flow, new users get a token without a userId initially.
  // Let's refine this to handle registration properly.
  
  const phone = (req as any).user?.phone;

  if (!userId) {
    // New user registration
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({ ...updates, phone })
      .select()
      .single();
    
    if (createError) return res.status(500).json({ error: createError.message });
    
    // Generate a new token WITH the userId
    const newToken = jwt.sign(
      { id: newUser.id, phone },
      CONFIG.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ user: newUser, token: newToken });
  }

  const { data: user, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(user);
};
