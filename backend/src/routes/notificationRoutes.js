import { Router } from 'express';
import { notificationController } from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../utils/common.js';

export function notificationRouter(cfg) {
  const router = Router();
  router.use(requireAuth(cfg));
  router.get('/', asyncRoute(notificationController.list));
  router.patch('/:id/read', asyncRoute(notificationController.read));
  router.post('/read-all', asyncRoute(notificationController.readAll));
  return router;
}
