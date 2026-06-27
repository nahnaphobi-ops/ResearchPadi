import { Request, Response } from 'express';
import { getUsageStats, getRemainingBudget } from '../services/ai/gateway.service';

export async function getUsage(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const days = parseInt(req.query.days as string) || 30;
    const stats = await getUsageStats(userId, days);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getBudget(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const budget = getRemainingBudget(userId);
  res.json(budget);
}
