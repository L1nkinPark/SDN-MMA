import { Router } from 'express';
import { merchantController } from '../controllers/merchantController.js';
import { bookingController } from '../controllers/bookingController.js';
import { requireAuth, requireMerchant } from '../middleware/auth.js';
import { asyncRoute } from '../utils/common.js';

export function merchantRouter(cfg) {
  const router = Router();
  const controller = merchantController(cfg);
  router.use(requireAuth(cfg));
  router.post('/claims', asyncRoute(controller.submitClaim));
  router.get('/claims/me', asyncRoute(controller.myClaims));
  router.get('/places', requireMerchant, asyncRoute(controller.myPlaces));
  router.patch('/places/:id', requireMerchant, asyncRoute(controller.updatePlace));
  router.post('/places/:id/visit-code', requireMerchant, asyncRoute(controller.visitCode));
  router.get('/places/:id/bookings', requireMerchant, asyncRoute(bookingController.placeBookings));
  return router;
}
