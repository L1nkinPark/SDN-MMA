import { Router } from 'express';
import { reputationController } from '../controllers/reputationController.js';
import { asyncRoute } from '../utils/common.js';

export function reputationRouter() {
  const router = Router();
  router.get('/leaderboard', asyncRoute(reputationController.leaderboard));
  return router;
}
