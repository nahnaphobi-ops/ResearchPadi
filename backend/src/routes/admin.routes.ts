import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { requireAdmin } from '../middleware/admin.middleware.js';

const router = Router();

// Admins sign in through the normal phone login (/api/auth); see lib/admins.

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
