import { Router } from 'express';
import * as careStudy from '../controllers/care-study.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/templates', careStudy.templates);
router.get('/', careStudy.list);
router.post('/', careStudy.create);
router.get('/:id', careStudy.get);
router.put('/:id/sections/:key', careStudy.saveSection);
router.post('/:id/sections/:key/draft', careStudy.draft);
router.put('/:id/sections/:key/draft', careStudy.editDraft);
router.get('/:id/versions', careStudy.versions);
router.post('/:id/check', careStudy.check);
router.post('/:id/help', careStudy.askHelp);
router.get('/:id/export', careStudy.exportDocx);

export default router;
