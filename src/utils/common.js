import mongoose from 'mongoose';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const objectId = z.string().refine(mongoose.isValidObjectId, 'Invalid ID');
export const coordinates = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, result.error.issues.map(i => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '));
  return result.data;
}

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function assertId(id) { return parse(objectId, id); }

export function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function distanceMeters(a, b) {
  const toRad = n => n * Math.PI / 180;
  const [lon1, lat1] = a, [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
