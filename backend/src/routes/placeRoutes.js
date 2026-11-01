import { Router } from 'express';
import { placeController } from '../controllers/placeController.js';
import { reviewController } from '../controllers/reviewController.js';
import { checkinController } from '../controllers/checkinController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../utils/common.js';

export function placesRouter(cfg, io) {
  const router = Router();
  const auth = requireAuth(cfg);
  const checkins = checkinController(cfg, io);
  router.get('/', asyncRoute(placeController.list));
  router.post('/', auth, asyncRoute(placeController.create));
  router.get('/:id', asyncRoute(placeController.get));
  router.get('/:id/reviews', asyncRoute(reviewController.list));
  router.put('/:id/reviews/me', auth, asyncRoute(reviewController.upsertMine));
  router.delete('/:id/reviews/me', auth, asyncRoute(reviewController.deleteMine));
  router.post('/:id/checkins', auth, asyncRoute(checkins.create));
  return router;
}
