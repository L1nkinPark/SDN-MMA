import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { authRouter } from './routes/authRoutes.js';
import { placesRouter } from './routes/placeRoutes.js';
import { communityRouter } from './routes/communityRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { reputationRouter } from './routes/reputationRoutes.js';
import { merchantRouter } from './routes/merchantRoutes.js';
import { bookingRouter } from './routes/bookingRoutes.js';
import { notificationRouter } from './routes/notificationRoutes.js';
import { errorHandler } from './middleware/error.js';
import { openapiSpec } from './docs/spec.js';

export function createApp(cfg, io) {
  const app = express();
  app.locals.cfg = cfg;
  app.locals.io = io;
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: cfg.origins }));
  app.use(express.json({ limit: '1mb' }));
  app.get(['/', '/api'], (_req, res) => res.json({
    service: 'StudySpot API',
    status: 'running',
    health: '/health',
    places: '/api/places',
    docs: '/api/docs'
  }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { explorer: true, customSiteTitle: 'StudySpot API Docs' }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }), authRouter(cfg));
  app.use('/api/places', placesRouter(cfg, io));
  app.use('/api/reputation', reputationRouter());
  app.use('/api/merchant', merchantRouter(cfg));
  app.use('/api/bookings', bookingRouter(cfg));
  app.use('/api/notifications', notificationRouter(cfg));
  app.use('/api/admin', adminRouter(cfg));
  app.use('/api', communityRouter(cfg));
  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use(errorHandler);
  return app;
}
