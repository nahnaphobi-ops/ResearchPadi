import { Router } from 'express';
import * as workspaceController from '../controllers/workspace.controller.js';
import * as notebook from '../controllers/notebook.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { attachPlan, enforceSessionLimit, requirePaidPlan, requirePremium } from '../middleware/subscription.middleware.js';

const router = Router();

router.use(authMiddleware);

// Everyone can use the Workspace: without a subscription the plan is Free (see lib/workspace-plans.ts).
// Free limits on documents, sources, quick edits, checks and autocompletes are enforced per route.
router.use(attachPlan);

router.get('/sessions', workspaceController.listSessions);
router.post('/sessions', enforceSessionLimit, workspaceController.createSession);
router.post('/sessions/from-draft', workspaceController.createFromDraft);
router.get('/sessions/:id', workspaceController.getSession);
router.put('/sessions/:id', workspaceController.updateSession);
router.delete('/sessions/:id', workspaceController.deleteSession);
router.get('/sessions/:id/study-draft', workspaceController.getStudyDraft);
// Every plan: the coach only works on a study draft the student bought (prepaid).
router.post('/sessions/:id/coach', workspaceController.coach);

router.post('/assist', workspaceController.assist);
router.post('/assist-advanced', workspaceController.assistAdvanced);
// Standard and Premium: cited sentences checked against the document's own sources.
router.post('/sessions/:id/claim-check', requirePaidPlan, workspaceController.claimCheck);
router.post('/autocomplete', workspaceController.autocomplete);
router.post('/citations', workspaceController.searchCitations);
router.get('/citation-styles', workspaceController.listCitationStyles);
router.post('/local-citations', workspaceController.searchLocalCitations);
router.post('/sources', workspaceController.findSources);

// Premium: Notion-style AI in the editor (streamed)
router.post('/inline-ai', requirePremium, workspaceController.inlineAi);

// The document's own sources: every plan, up to its limit. Premium adds grounded chat and outputs.
router.get('/sessions/:id/notebook', notebook.list);
router.post('/sessions/:id/notebook/sources', notebook.notebookUpload, notebook.add);
router.patch('/sessions/:id/notebook/sources/:sourceId', notebook.update);
router.delete('/sessions/:id/notebook/sources/:sourceId', notebook.remove);
router.post('/sessions/:id/notebook/chat', requirePremium, notebook.chat);
router.post('/sessions/:id/notebook/generate', requirePremium, notebook.generate);
router.get('/sessions/:id/notebook/suggestions', requirePremium, notebook.suggestions);

export default router;
