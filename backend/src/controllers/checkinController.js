import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { Checkin, Place, VisitProof } from '../models/index.js';
import { HttpError, assertId, coordinates, distanceMeters, parse } from '../utils/common.js';
import { awardReputation } from '../services/reputationService.js';
import { recalculateStatus } from '../services/statusService.js';

const checkinBody = z.object({
  crowd: z.enum(['low', 'medium', 'high']), noise: z.enum(['quiet', 'moderate', 'loud']), coordinates,
  accuracyMeters: z.number().min(0).max(10000).optional(), visitCode: z.string().max(2000).optional()
});

export function checkinController(cfg, io) {
  return {
    create: async (req, res) => {
      const placeId = assertId(req.params.id);
      const body = parse(checkinBody, req.body);
      const place = await Place.findOne({ _id: placeId, approval: 'approved' });
      if (!place) throw new HttpError(404, 'Place not found');
      if (String(place.owner) === String(req.user._id)) throw new HttpError(403, 'Owner cannot check in at own place');
      if (distanceMeters(body.coordinates, place.location.coordinates) > 250) throw new HttpError(403, 'Check-in requires location within 250 meters');
      let verificationLevel = 'gps_only';
      if (body.visitCode) {
        let payload;
        try { payload = jwt.verify(body.visitCode, cfg.accessSecret, { algorithms: ['HS256'] }); }
        catch { throw new HttpError(403, 'Invalid or expired visit code'); }
        if (payload.type !== 'visit_qr' || payload.place !== placeId || payload.owner !== String(place.owner)) {
          throw new HttpError(403, 'Visit code does not belong to this place');
        }
        if (body.accuracyMeters === undefined || body.accuracyMeters > 50 ||
          distanceMeters(body.coordinates, place.location.coordinates) > 100) {
          throw new HttpError(403, 'Verified visit requires accurate location within 100 meters');
        }
        verificationLevel = 'qr_verified';
      }
      const cooldown = new Date(Date.now() - 15 * 60000);
      const recent = await Checkin.exists({ user: req.user._id, place: placeId, createdAt: { $gt: cooldown } });
      if (recent) throw new HttpError(429, 'Wait 15 minutes before another check-in at this place');
      const checkin = await Checkin.create({ user: req.user._id, place: placeId, crowd: body.crowd, noise: body.noise,
        verificationLevel, verifiedAt: verificationLevel === 'qr_verified' ? new Date() : null,
        expiresAt: new Date(Date.now() + cfg.checkinMinutes * 60000) });
      if (verificationLevel === 'qr_verified') {
        await VisitProof.create({ user: req.user._id, place: placeId, method: 'qr', verifiedAt: checkin.verifiedAt });
      }
      await awardReputation(req.user._id, placeId, 'checkin', new Date().toISOString().slice(0, 10), 1);
      const liveStatus = await recalculateStatus(placeId, cfg, io);
      res.status(201).json({ checkin, liveStatus });
    }
  };
}
