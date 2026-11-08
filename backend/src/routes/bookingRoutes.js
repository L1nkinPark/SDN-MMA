import { Router } from 'express';
import { bookingController } from '../controllers/bookingController.js';
import { requireAuth, requireMerchant } from '../middleware/auth.js';
import { asyncRoute } from '../utils/common.js';

export function bookingRouter(cfg) {
  const router = Router();
  const auth = requireAuth(cfg);
  router.post('/', auth, asyncRoute(bookingController.create));
  router.get('/me', auth, asyncRoute(bookingController.mine));
  router.post('/:id/cancel', auth, asyncRoute(bookingController.cancelMine));
  router.patch('/:id/merchant-decision', auth, requireMerchant, asyncRoute(bookingController.merchantDecision));
  return router;
}
