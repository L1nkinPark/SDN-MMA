import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User, RefreshToken } from '../models/index.js';
import { HttpError, parse } from '../utils/common.js';
import { accessToken, refreshToken, tokenHash } from '../services/tokenService.js';
import { publicUser } from '../views/userView.js';

const credentials = z.object({ email: z.email().toLowerCase(), password: z.string().min(8).max(128) });

export function authController(cfg) {
  async function issue(user, res) {
    const refresh = refreshToken(user, cfg);
    await RefreshToken.create({ user: user._id, tokenHash: tokenHash(refresh), expiresAt: new Date(Date.now() + cfg.refreshDays * 86400000) });
    res.json({ user: publicUser(user), accessToken: accessToken(user, cfg), refreshToken: refresh });
  }

  return {
    register: async (req, res) => {
      const body = parse(credentials.extend({ name: z.string().trim().min(2).max(80) }), req.body);
      const user = await User.create({ name: body.name, email: body.email, passwordHash: await bcrypt.hash(body.password, 12) });
      res.status(201);
      await issue(user, res);
    },
    login: async (req, res) => {
      const body = parse(credentials, req.body);
      const user = await User.findOne({ email: body.email }).select('+passwordHash');
      if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new HttpError(401, 'Invalid email or password');
      await issue(user, res);
    },
    refresh: async (req, res) => {
      const { refreshToken: token } = parse(z.object({ refreshToken: z.string() }), req.body);
      let payload;
      try { payload = jwt.verify(token, cfg.refreshSecret); } catch { throw new HttpError(401, 'Invalid or expired refresh token'); }
      if (payload.type !== 'refresh') throw new HttpError(401, 'Invalid refresh token');
      const stored = await RefreshToken.findOneAndUpdate(
        { tokenHash: tokenHash(token), user: payload.sub, revokedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { revokedAt: new Date() } }, { new: true }
      );
      if (!stored) throw new HttpError(401, 'Refresh token already used or revoked');
      const user = await User.findById(payload.sub);
      if (!user) throw new HttpError(401, 'User no longer exists');
      await issue(user, res);
    },
    logout: async (req, res) => {
      const { refreshToken: token } = parse(z.object({ refreshToken: z.string() }), req.body);
      await RefreshToken.updateOne({ tokenHash: tokenHash(token) }, { $set: { revokedAt: new Date() } });
      res.status(204).end();
    },
    me: async (req, res) => res.json({ user: publicUser(req.user) })
  };
}
