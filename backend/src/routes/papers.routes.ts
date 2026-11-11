import { Router } from 'express';
import * as papersController from '../controllers/papers.controller.js';
import * as aiReview from '../controllers/ai-review.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/refine-topic', papersController.refineTopic);
router.post('/generate-questions', papersController.generateResearchQuestions);
router.post('/full', papersController.submitFullPaper);
router.get('/', papersController.listPapers);
router.get('/:id', papersController.getPaperDetails);
router.get('/:id/status', papersController.getJobStatus);
router.post('/:id/supervise', papersController.superviseCompletedPaper);
router.post('/:id/accept-review', papersController.acceptSupervision);
router.get('/:id/download', papersController.downloadPaper);
// AI review suggestions (suggest only; the student accepts or rejects each one)
router.get('/:id/ai-review', aiReview.getForPaper);
router.post('/:id/ai-review/suggestions/:suggestionId/accept', aiReview.accept);
router.post('/:id/ai-review/suggestions/:suggestionId/reject', aiReview.reject);
router.delete('/:id', papersController.deletePaper);

export default router;
