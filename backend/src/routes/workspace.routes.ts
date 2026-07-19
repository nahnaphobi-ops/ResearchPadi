import { Router } from 'express';
import * as workspaceController from '../controllers/workspace.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireSubscription, enforceSessionLimit } from '../middleware/subscription.middleware.js';

const router = Router();

router.use(authMiddleware);

// All workspace routes require an active subscription
router.use(requireSubscription);

router.get('/sessions', workspaceController.listSessions);
router.post('/sessions', enforceSessionLimit, workspaceController.createSession);
router.get('/sessions/:id', workspaceController.getSession);
router.put('/sessions/:id', workspaceController.updateSession);
router.delete('/sessions/:id', workspaceController.deleteSession);

router.post('/assist', workspaceController.assist);
router.post('/assist-advanced', workspaceController.assistAdvanced);
router.post('/citations', workspaceController.searchCitations);
router.get('/citation-styles', workspaceController.listCitationStyles);
router.post('/local-citations', workspaceController.searchLocalCitations);

export default router;
