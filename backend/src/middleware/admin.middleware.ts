import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config/index.js';

export interface AdminRequest extends Request {
  admin?: { id: string; email: string };
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as { id: string; email: string; isAdmin?: boolean };
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }
    req.admin = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
