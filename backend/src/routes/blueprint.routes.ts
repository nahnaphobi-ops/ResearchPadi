import { Router, Request, Response } from 'express';
import { getBlueprint, getAllBlueprints, getChapterGuide } from '../services/ai/blueprint.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

// GET /api/blueprints — list all available blueprints
router.get('/', async (_req: Request, res: Response) => {
  try {
    const blueprints = getAllBlueprints();
    res.json({ blueprints });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load blueprints' });
  }
});

// GET /api/blueprints/:type — get a specific blueprint
router.get('/:type', async (req: Request, res: Response) => {
  const { type } = req.params;
  try {
    const blueprint = getBlueprint(type as string);
    if (!blueprint) {
      return res.status(404).json({ error: `Blueprint not found for type: ${type}` });
    }
    res.json(blueprint);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load blueprint' });
  }
});

// GET /api/blueprints/:type/chapter/:num — get chapter-specific guide
router.get('/:type/chapter/:num', async (req: Request, res: Response) => {
  const { type } = req.params;
  const num = String(req.params.num);
  const chapterNumber = parseInt(num);
  if (isNaN(chapterNumber) || chapterNumber < 1 || chapterNumber > 5) {
    return res.status(400).json({ error: 'Chapter number must be 1-5' });
  }
  try {
    const guide = getChapterGuide(type as string, chapterNumber);
    if (!guide) {
      return res.status(404).json({ error: `Chapter ${chapterNumber} not found for ${type}` });
    }
    res.json(guide);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load chapter guide' });
  }
});

export default router;
