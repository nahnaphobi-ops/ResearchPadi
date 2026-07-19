import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as adminController from '../controllers/admin.controller.js';
import { requireAdmin } from '../middleware/admin.middleware.js';

const router = Router();

const adminLoginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again after 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth
router.post('/login', adminLoginLimiter, adminController.login);
router.post('/verify-otp', adminLoginLimiter, adminController.verifyOtp);
router.post('/refresh-token', adminController.refreshToken);
router.post('/logout', requireAdmin, adminController.logout);

// Dashboard
router.get('/overview', requireAdmin, adminController.getOverview);
router.get('/system', requireAdmin, adminController.getSystemMetrics);

// Users
router.get('/users', requireAdmin, adminController.getUsers);
router.get('/users/:id', requireAdmin, adminController.getUserDetail);

// Financials
router.get('/transactions', requireAdmin, adminController.getTransactions);
router.get('/subscriptions', requireAdmin, adminController.getSubscriptions);

// Papers
router.get('/papers', requireAdmin, adminController.getPapers);
router.post('/papers/:id/review', requireAdmin, adminController.approvePaper);

// Content
router.get('/workspaces', requireAdmin, adminController.getWorkspaces);
router.get('/knowledge-base', requireAdmin, adminController.getKnowledgeBase);

// Monitoring
router.get('/audit-logs', requireAdmin, adminController.getAuditLogs);
router.get('/ai-usage', requireAdmin, adminController.getAiUsage);

export default router;
