import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export function tokenHash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

export function accessToken(user, cfg) {
  return jwt.sign({ sub: String(user._id), role: user.role, type: 'access' }, cfg.accessSecret,
    { algorithm: 'HS256', expiresIn: cfg.accessTtl });
}

export function refreshToken(user, cfg) {
  return jwt.sign({ sub: String(user._id), type: 'refresh', jti: crypto.randomUUID() }, cfg.refreshSecret,
    { algorithm: 'HS256', expiresIn: `${cfg.refreshDays}d` });
}
