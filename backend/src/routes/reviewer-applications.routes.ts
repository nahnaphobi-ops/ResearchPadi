import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import * as applications from '../controllers/reviewer-applications.controller.js';

/** Anyone signed in can apply to become a reviewer; an admin vets the application. */
const router = Router();
router.use(authMiddleware);
router.get('/mine', applications.mine);
router.post('/', applications.apply);

export default router;
