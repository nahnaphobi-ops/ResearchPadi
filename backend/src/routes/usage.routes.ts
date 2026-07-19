import { Router } from 'express';
import * as usageController from '../controllers/usage.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', usageController.getUsage);
router.get('/budget', usageController.getBudget);

export default router;
