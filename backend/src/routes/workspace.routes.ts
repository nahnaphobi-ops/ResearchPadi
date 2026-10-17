import { Router } from 'express';
import * as workspaceController from '../controllers/workspace.controller.js';
import * as notebook from '../controllers/notebook.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireSubscription, enforceSessionLimit, requirePremium } from '../middleware/subscription.middleware.js';

const router = Router();

router.use(authMiddleware);

// All workspace routes require an active subscription
router.use(requireSubscription);

router.get('/sessions', workspaceController.listSessions);
router.post('/sessions', enforceSessionLimit, workspaceController.createSession);
router.post('/sessions/from-draft', workspaceController.createFromDraft);
router.get('/sessions/:id', workspaceController.getSession);
router.put('/sessions/:id', workspaceController.updateSession);
router.delete('/sessions/:id', workspaceController.deleteSession);
router.get('/sessions/:id/study-draft', workspaceController.getStudyDraft);
router.post('/sessions/:id/coach', workspaceController.coach);

router.post('/assist', workspaceController.assist);
router.post('/assist-advanced', workspaceController.assistAdvanced);
router.post('/citations', workspaceController.searchCitations);
router.get('/citation-styles', workspaceController.listCitationStyles);
router.post('/local-citations', workspaceController.searchLocalCitations);
router.post('/sources', workspaceController.findSources);

// Premium: Notion-style AI in the editor (streamed)
router.post('/inline-ai', requirePremium, workspaceController.inlineAi);

// Premium: NotebookLM-style sources and grounded chat for a document
router.get('/sessions/:id/notebook', requirePremium, notebook.list);
router.post('/sessions/:id/notebook/sources', requirePremium, notebook.notebookUpload, notebook.add);
router.patch('/sessions/:id/notebook/sources/:sourceId', requirePremium, notebook.update);
router.delete('/sessions/:id/notebook/sources/:sourceId', requirePremium, notebook.remove);
router.post('/sessions/:id/notebook/chat', requirePremium, notebook.chat);
router.post('/sessions/:id/notebook/generate', requirePremium, notebook.generate);
router.get('/sessions/:id/notebook/suggestions', requirePremium, notebook.suggestions);

export default router;
