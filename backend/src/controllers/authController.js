import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User, RefreshToken, PasswordReset, Booking, Checkin, EmailOutbox, FraudFlag, MerchantClaim,
  Notification, Place, PlaceChangeRequest, Report, ReputationEvent, Review, VisitProof } from '../models/index.js';
import { HttpError, parse } from '../utils/common.js';
import { accessToken, refreshToken, tokenHash } from '../services/tokenService.js';
import { publicUser } from '../views/userView.js';
import { queueEmail } from '../services/notificationService.js';
import { releaseSlot } from '../services/bookingService.js';
import { updateRating } from '../services/ratingService.js';
import { recalculateStatus } from '../services/statusService.js';

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
      if (user.status !== 'active') throw new HttpError(403, 'Account unavailable');
      await issue(user, res);
    },
    refresh: async (req, res) => {
      const { refreshToken: token } = parse(z.object({ refreshToken: z.string() }), req.body);
      let payload;
      try { payload = jwt.verify(token, cfg.refreshSecret, { algorithms: ['HS256'] }); } catch { throw new HttpError(401, 'Invalid or expired refresh token'); }
      if (payload.type !== 'refresh') throw new HttpError(401, 'Invalid refresh token');
      const stored = await RefreshToken.findOneAndUpdate(
        { tokenHash: tokenHash(token), user: payload.sub, revokedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { revokedAt: new Date() } }, { new: true }
      );
      if (!stored) throw new HttpError(401, 'Refresh token already used or revoked');
      const user = await User.findById(payload.sub);
      if (!user) throw new HttpError(401, 'User no longer exists');
      if (user.status !== 'active') throw new HttpError(403, 'Account unavailable');
      await issue(user, res);
    },
    logout: async (req, res) => {
      const { refreshToken: token } = parse(z.object({ refreshToken: z.string() }), req.body);
      await RefreshToken.updateOne({ tokenHash: tokenHash(token) }, { $set: { revokedAt: new Date() } });
      res.status(204).end();
    },
    me: async (req, res) => res.json({ user: publicUser(req.user) }),
    updateMe: async (req, res) => {
      const body = parse(z.object({ name: z.string().trim().min(2).max(80).optional(),
        notificationSettings: z.object({ email: z.boolean().optional(), inApp: z.boolean().optional() }).optional() }), req.body);
      if (!Object.keys(body).length) throw new HttpError(400, 'No changes supplied');
      if (body.name !== undefined) req.user.name = body.name;
      if (body.notificationSettings) {
        for (const [key, value] of Object.entries(body.notificationSettings)) req.user.notificationSettings[key] = value;
      }
      await req.user.save();
      res.json({ user: publicUser(req.user) });
    },
    changePassword: async (req, res) => {
      const { currentPassword, newPassword } = parse(z.object({
        currentPassword: z.string().min(8), newPassword: z.string().min(8).max(128)
      }), req.body);
      const user = await User.findById(req.user._id).select('+passwordHash');
      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(403, 'Current password incorrect');
      if (currentPassword === newPassword) throw new HttpError(400, 'New password must differ');
      user.passwordHash = await bcrypt.hash(newPassword, 12);
      user.tokenVersion += 1;
      await user.save();
      await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
      res.status(204).end();
    },
    forgotPassword: async (req, res) => {
      const { email } = parse(z.object({ email: z.email().toLowerCase() }), req.body);
      if (!cfg.smtp) throw new HttpError(503, 'Email delivery is not configured');
      const user = await User.findOne({ email, status: 'active' });
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        await EmailOutbox.deleteMany({ to: user.email, subject: '[StudySpot] Đặt lại mật khẩu', status: 'pending' });
        await PasswordReset.findOneAndUpdate({ user: user._id },
          { $set: { tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 30 * 60000) } },
          { upsert: true, new: true });
        await queueEmail(cfg, { to: user.email, subject: '[StudySpot] Đặt lại mật khẩu',
          text: `Mã đặt lại mật khẩu của bạn: ${token}\nMã có hiệu lực 30 phút. Nếu không yêu cầu, bạn có thể bỏ qua email này.`,
          expiresAt: new Date(Date.now() + 30 * 60000) });
      }
      res.status(202).json({ message: 'If this account exists, a reset email has been sent' });
    },
    resetPassword: async (req, res) => {
      const { token, newPassword } = parse(z.object({ token: z.string().min(32).max(256),
        newPassword: z.string().min(8).max(128) }), req.body);
      const reset = await PasswordReset.findOneAndDelete({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
      if (!reset) throw new HttpError(400, 'Invalid or expired reset token');
      const user = await User.findById(reset.user).select('+passwordHash');
      if (!user || user.status !== 'active') throw new HttpError(400, 'Invalid or expired reset token');
      user.passwordHash = await bcrypt.hash(newPassword, 12);
      user.tokenVersion += 1;
      await user.save();
      await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
      await EmailOutbox.deleteMany({ to: user.email, subject: '[StudySpot] Đặt lại mật khẩu', status: 'pending' });
      res.status(204).end();
    },
    exportMe: async (req, res) => {
      const userId = req.user._id;
      const [reviews, checkins, reports, bookings, claims, visits, places] = await Promise.all([
        Review.find({ user: userId }).lean(), Checkin.find({ user: userId }).lean(),
        Report.find({ user: userId }).lean(), Booking.find({ user: userId }).lean(),
        MerchantClaim.find({ applicant: userId }).lean(), VisitProof.find({ user: userId }).lean(),
        Place.find({ $or: [{ submittedBy: userId }, { owner: userId }] }).lean()
      ]);
      res.set('Cache-Control', 'no-store').json({ generatedAt: new Date().toISOString(),
        user: publicUser(req.user), reviews, checkins, reports, bookings, claims, visits, places });
    },
    deleteMe: async (req, res) => {
      const { password } = parse(z.object({ password: z.string().min(8) }), req.body);
      if (req.user.role === 'admin') throw new HttpError(403, 'Admin account cannot self-delete');
      const user = await User.findById(req.user._id).select('+passwordHash');
      if (!(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(403, 'Password incorrect');
      const userId = user._id;
      const activeBookings = await Booking.find({ user: userId, status: { $in: ['pending', 'confirmed'] }, startsAt: { $gt: new Date() } });
      for (const booking of activeBookings) {
        const updated = await Booking.findOneAndUpdate({ _id: booking._id, status: { $in: ['pending', 'confirmed'] } },
          { $set: { status: 'cancelled', cancelledBy: userId } }, { new: true });
        if (updated) await releaseSlot(updated);
      }
      const [reviews, checkins] = await Promise.all([
        Review.find({ user: userId }).select('place').lean(), Checkin.find({ user: userId }).select('place').lean()
      ]);
      await Promise.all([
        Review.deleteMany({ user: userId }), Checkin.deleteMany({ user: userId }), Booking.deleteMany({ user: userId }),
        Report.deleteMany({ user: userId }), VisitProof.deleteMany({ user: userId }),
        FraudFlag.deleteMany({ user: userId }), MerchantClaim.deleteMany({ applicant: userId }),
        PlaceChangeRequest.deleteMany({ merchant: userId }), Notification.deleteMany({ user: userId }),
        EmailOutbox.deleteMany({ to: user.email }),
        ReputationEvent.deleteMany({ user: userId }), PasswordReset.deleteMany({ user: userId }),
        RefreshToken.deleteMany({ user: userId }), Place.updateMany({ owner: userId }, { $set: { owner: null } })
      ]);
      for (const placeId of new Set(reviews.map(item => String(item.place)))) await updateRating(placeId);
      for (const placeId of new Set(checkins.map(item => String(item.place)))) {
        await recalculateStatus(placeId, cfg, req.app.locals.io);
      }
      user.name = 'Đã xóa';
      user.email = `deleted-${user._id}@studyspot.invalid`;
      user.passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      user.status = 'deleted';
      user.role = 'student';
      user.tokenVersion += 1;
      user.favorites = [];
      user.notificationSettings = { email: false, inApp: false };
      await user.save();
      res.status(204).end();
    }
  };
}
