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
  router.post('/forgot-password', asyncRoute(controller.forgotPassword));
  router.post('/reset-password', asyncRoute(controller.resetPassword));
  router.get('/me', requireAuth(cfg), asyncRoute(controller.me));
  router.patch('/me', requireAuth(cfg), asyncRoute(controller.updateMe));
  router.get('/me/export', requireAuth(cfg), asyncRoute(controller.exportMe));
  router.delete('/me', requireAuth(cfg), asyncRoute(controller.deleteMe));
  router.post('/change-password', requireAuth(cfg), asyncRoute(controller.changePassword));
  return router;
}
