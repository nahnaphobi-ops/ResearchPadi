import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// OTP request: 3 per minute per IP (email costs money)
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Too many OTP requests, please wait a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP verify: 5 per minute per IP
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many verification attempts, please wait a minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/request-otp', otpLimiter, authController.requestOtp);
router.post('/verify-otp', verifyLimiter, authController.verifyOtp);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);

export default router;
