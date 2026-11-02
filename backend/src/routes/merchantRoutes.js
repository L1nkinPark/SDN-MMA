import { Router } from 'express';
import { merchantController } from '../controllers/merchantController.js';
import { bookingController } from '../controllers/bookingController.js';
import { requireAuth, requireMerchant } from '../middleware/auth.js';
import { asyncRoute } from '../utils/common.js';
import { imageUpload } from '../middleware/upload.js';

export function merchantRouter(cfg) {
  const router = Router();
  const controller = merchantController(cfg);
  router.use(requireAuth(cfg));
  router.post('/claims', asyncRoute(controller.submitClaim));
  router.get('/claims/me', asyncRoute(controller.myClaims));
  router.get('/places', asyncRoute(controller.myPlaces));
  router.post('/places', asyncRoute(controller.createPlace));
  router.get('/change-requests/me', asyncRoute(controller.myChangeRequests));
  router.patch('/places/:id', requireMerchant, asyncRoute(controller.updatePlace));
  router.post('/places/:id/change-requests', requireMerchant, asyncRoute(controller.submitChange));
  router.post('/places/:id/images', requireMerchant, imageUpload, asyncRoute(controller.submitImage));
  router.post('/places/:id/visit-code', requireMerchant, asyncRoute(controller.visitCode));
  router.get('/places/:id/bookings', requireMerchant, asyncRoute(bookingController.placeBookings));
  return router;
}
