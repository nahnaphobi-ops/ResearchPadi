import { Router } from 'express';
import * as sharing from '../controllers/sharing.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

/** For people opening a share link: no account needed, except to edit. */
const router = Router();

router.get('/:token', sharing.openShared);
router.post('/:token/comments', sharing.commentShared);
router.put('/:token/content', authMiddleware, sharing.saveShared);

export default router;
