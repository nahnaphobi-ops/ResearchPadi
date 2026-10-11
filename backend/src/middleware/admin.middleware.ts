import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config/index.js';
import { isAdminPhone } from '../lib/admins.js';

export interface AdminRequest extends Request {
  admin?: { id: string; phone: string };
}

/** Accepts a normal user token whose phone is on the admin list (see lib/admins). */
export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  let decoded: { id?: string; phone?: string };
  try {
    decoded = jwt.verify(token, CONFIG.JWT_SECRET, { algorithms: ['HS256'] }) as { id?: string; phone?: string };
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (!decoded.id || !isAdminPhone(decoded.phone)) {
    return res.status(403).json({ error: 'Not authorized as admin' });
  }

  req.admin = { id: decoded.id, phone: decoded.phone as string };
  next();
}
