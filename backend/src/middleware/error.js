import mongoose from 'mongoose';
import multer from 'multer';
import { HttpError } from '../utils/common.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  if (err?.code === 11000) return res.status(409).json({ error: 'Resource already exists' });
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ error: 'Invalid ID' });
  const status = err.status || 500;
  if (status >= 500 && !(err instanceof HttpError)) console.error(err);
  res.status(status).json({ error: err instanceof HttpError || status < 500 ? err.message : 'Internal server error' });
}
