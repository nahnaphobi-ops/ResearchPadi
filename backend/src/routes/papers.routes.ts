import { Router } from 'express';
import * as papersController from '../controllers/papers.controller';
import { authMiddleware } from '../middleware/auth.middleware';

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
router.delete('/:id', papersController.deletePaper);

export default router;
