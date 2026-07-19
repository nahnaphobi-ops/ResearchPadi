import { Router } from 'express';
import * as subscriptionsController from '../controllers/subscriptions.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/subscribe', subscriptionsController.subscribe);
router.get('/active', subscriptionsController.getActiveSubscription);
router.post('/cancel', subscriptionsController.cancelSubscription);

export default router;
