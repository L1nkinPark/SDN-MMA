import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/index.js';
import { HttpError, asyncRoute } from '../utils/common.js';

export function requireAuth(cfg) {
  return asyncRoute(async (req, _res, next) => {
    const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!match) throw new HttpError(401, 'Bearer access token required');
    let payload;
    try { payload = jwt.verify(match[1], cfg.accessSecret, { algorithms: ['HS256'] }); } catch { throw new HttpError(401, 'Invalid or expired access token'); }
    if (payload.type !== 'access' || !mongoose.isValidObjectId(payload.sub)) throw new HttpError(401, 'Invalid access token');
    const user = await User.findById(payload.sub);
    if (!user) throw new HttpError(401, 'User no longer exists');
    if (user.status && user.status !== 'active') throw new HttpError(403, 'Account unavailable');
    if ((payload.ver ?? 0) !== (user.tokenVersion || 0)) throw new HttpError(401, 'Access token revoked');
    req.user = user;
    next();
  });
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Admin access required'));
  next();
}

export function requirePermission(permission) {
  return (req, _res, next) => {
    const permissions = req.user?.adminPermissions;
    if (req.user?.role === 'admin' && (!Array.isArray(permissions) || permissions.includes('*') || permissions.includes(permission))) return next();
    next(new HttpError(403, `Admin permission required: ${permission}`));
  };
}

export const requireSuperAdmin = requirePermission('*');

export function requireMerchant(req, _res, next) {
  if (!['merchant', 'admin'].includes(req.user?.role)) return next(new HttpError(403, 'Merchant access required'));
  next();
}
