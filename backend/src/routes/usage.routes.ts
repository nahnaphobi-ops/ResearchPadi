import { Router } from 'express';
import * as usageController from '../controllers/usage.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', usageController.getUsage);
router.get('/budget', usageController.getBudget);

export default router;
