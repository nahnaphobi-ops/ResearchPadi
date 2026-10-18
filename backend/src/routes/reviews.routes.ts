import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import type { NextFunction, Request, Response } from 'express';
import { requirePremium, requireSubscription } from '../middleware/subscription.middleware.js';
import * as reviews from '../controllers/reviews.controller.js';

/**
 * Reviewing a workspace document stays a Premium feature. Papers and care
 * studies are bought from the wallet without a subscription, so reviewing them
 * only needs the review fee.
 */
const premiumForWorkspace = (req: Request, res: Response, next: NextFunction) => {
  const type = req.body?.sourceType;
  if (type && type !== 'workspace') return next();
  return requireSubscription(req, res, () => requirePremium(req, res, next));
};

/** Students: request and read human supervisor reviews (requesting is Premium). */
export const reviewsRouter = Router();
reviewsRouter.use(authMiddleware);
reviewsRouter.get('/pricing', reviews.pricing);
reviewsRouter.get('/', reviews.listMine);
reviewsRouter.get('/source-options', reviews.sourceOptions);
reviewsRouter.post('/', premiumForWorkspace, reviews.create);
reviewsRouter.get('/:id', reviews.getMine);
reviewsRouter.post('/:id/cancel', reviews.cancelMine);
reviewsRouter.patch('/:id/comments/:commentId', reviews.setCommentStatus);

/** Approved reviewers: queue, claim, comment, return. */
export const reviewDeskRouter = Router();
reviewDeskRouter.use(authMiddleware, reviews.requireReviewer);
reviewDeskRouter.get('/', reviews.queue);
reviewDeskRouter.get('/:id', reviews.getForReviewer);
reviewDeskRouter.post('/:id/claim', reviews.claim);
reviewDeskRouter.post('/:id/release', reviews.release);
reviewDeskRouter.post('/:id/comments', reviews.addComment);
reviewDeskRouter.delete('/:id/comments/:commentId', reviews.deleteComment);
reviewDeskRouter.post('/:id/return', reviews.returnReview);
