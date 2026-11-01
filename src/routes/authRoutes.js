import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../utils/common.js';

export function authRouter(cfg) {
  const router = Router();
  const controller = authController(cfg);
  router.post('/register', asyncRoute(controller.register));
  router.post('/login', asyncRoute(controller.login));
  router.post('/refresh', asyncRoute(controller.refresh));
  router.post('/logout', asyncRoute(controller.logout));
  router.get('/me', requireAuth(cfg), asyncRoute(controller.me));
  return router;
}
