import { Router } from 'express';
import * as paymentsController from '../controllers/payments.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Paystack webhook (no auth - called by Paystack servers)
router.post('/webhook', paymentsController.paystackWebhook);

router.use(authMiddleware);

router.post('/initiate', paymentsController.initiatePayment);
router.get('/verify/:reference', paymentsController.verifyPayment);
router.get('/wallet', paymentsController.getWalletBalance);
router.get('/history', paymentsController.getTransactionHistory);

export default router;
