import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';
import { requireAdmin, requireAuth, requirePermission, requireSuperAdmin } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import { asyncRoute } from '../utils/common.js';

export function adminRouter(cfg) {
  const router = Router();
  router.use(requireAuth(cfg), requireAdmin);
  router.get('/users', requirePermission('users'), asyncRoute(adminController.listUsers));
  router.patch('/users/:id', requirePermission('users'), asyncRoute(adminController.updateUser));
  router.patch('/admins/:id/permissions', requireSuperAdmin, asyncRoute(adminController.updateAdminPermissions));
  router.post('/admins', requireSuperAdmin, asyncRoute(adminController.promoteAdmin));
  router.delete('/admins/:id', requireSuperAdmin, asyncRoute(adminController.demoteAdmin));
  router.get('/merchant-claims', requirePermission('places'), asyncRoute(adminController.listClaims));
  router.patch('/merchant-claims/:id', requirePermission('places'), asyncRoute(adminController.decideClaim));
  router.get('/bookings', requirePermission('bookings'), asyncRoute(adminController.listBookings));
  router.post('/bookings/:id/cancel', requirePermission('bookings'), asyncRoute(adminController.cancelBooking));
  router.get('/audit', requirePermission('audit'), asyncRoute(adminController.listAudit));
  router.get('/place-changes', requirePermission('places'), asyncRoute(adminController.listPlaceChanges));
  router.patch('/place-changes/:id', requirePermission('places'), asyncRoute(adminController.decidePlaceChange));
  router.get('/fraud-flags', requirePermission('fraud'), asyncRoute(adminController.listFraudFlags));
  router.patch('/fraud-flags/:id', requirePermission('fraud'), asyncRoute(adminController.decideFraudFlag));
  router.get('/places', requirePermission('places'), asyncRoute(adminController.listPlaces));
  router.patch('/places/:id', requirePermission('places'), asyncRoute(adminController.updatePlace));
  router.patch('/places/:id/owner', requirePermission('places'), asyncRoute(adminController.transferPlaceOwner));
  router.post('/places/:id/images', requirePermission('places'), imageUpload, asyncRoute(adminController.uploadImage));
  router.get('/reports', requirePermission('moderation'), asyncRoute(adminController.listReports));
  router.patch('/reports/:id', requirePermission('moderation'), asyncRoute(adminController.updateReport));
  router.get('/reviews', requirePermission('moderation'), asyncRoute(adminController.listReviews));
  router.patch('/reviews/:id', requirePermission('moderation'), asyncRoute(adminController.updateReview));
  router.get('/analytics', requirePermission('analytics'), asyncRoute(adminController.analytics));
  return router;
}
