import mongoose from 'mongoose';
import multer from 'multer';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  if (err?.code === 11000) return res.status(409).json({ error: 'Resource already exists' });
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ error: 'Invalid ID' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
}
