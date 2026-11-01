import { Router } from 'express';
import { favoriteController } from '../controllers/favoriteController.js';
import { reportController } from '../controllers/reportController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../utils/common.js';

export function communityRouter(cfg) {
  const router = Router();
  router.use(requireAuth(cfg));
  router.get('/favorites', asyncRoute(favoriteController.list));
  router.put('/favorites/:placeId', asyncRoute(favoriteController.add));
  router.delete('/favorites/:placeId', asyncRoute(favoriteController.remove));
  router.post('/reports', asyncRoute(reportController.create));
  router.get('/reports/me', asyncRoute(reportController.listMine));
  return router;
}
