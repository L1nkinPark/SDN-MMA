import { Router } from 'express';
import { caseController } from '../controllers/caseController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../utils/common.js';

export function caseRouter(cfg) {
  const router = Router();
  router.use(requireAuth(cfg));
  router.post('/', asyncRoute(caseController.create));
  router.get('/me', asyncRoute(caseController.mine));
  return router;
}
