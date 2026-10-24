import { Router } from 'express';
import * as sharing from '../controllers/sharing.controller.js';

/** For people opening a share link: no account needed. */
const router = Router();

router.get('/:token', sharing.openShared);
router.post('/:token/comments', sharing.commentShared);

export default router;
