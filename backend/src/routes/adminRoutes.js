import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import { asyncRoute } from '../utils/common.js';

export function adminRouter(cfg) {
  const router = Router();
  router.use(requireAuth(cfg), requireAdmin);
  router.get('/places', asyncRoute(adminController.listPlaces));
  router.patch('/places/:id', asyncRoute(adminController.updatePlace));
  router.post('/places/:id/images', imageUpload, asyncRoute(adminController.uploadImage));
  router.get('/reports', asyncRoute(adminController.listReports));
  router.patch('/reports/:id', asyncRoute(adminController.updateReport));
  router.get('/reviews', asyncRoute(adminController.listReviews));
  router.patch('/reviews/:id', asyncRoute(adminController.updateReview));
  router.get('/analytics', asyncRoute(adminController.analytics));
  return router;
}
