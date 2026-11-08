import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { Checkin, FraudFlag, Place, VisitProof } from '../models/index.js';
import { HttpError, assertId, coordinates, distanceMeters, parse } from '../utils/common.js';
import { awardReputation } from '../services/reputationService.js';
import { recalculateStatus } from '../services/statusService.js';
import { notifyAdmins } from '../services/notificationService.js';
import { linkReviewToVisit } from '../services/visitReviewService.js';

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
      const previous = await Checkin.findOne({ user: req.user._id, createdAt: { $gt: new Date(Date.now() - 2 * 3600000) } })
        .sort({ createdAt: -1 }).populate('place', 'location');
      const travelMeters = previous?.place?.location?.coordinates
        ? distanceMeters(previous.place.location.coordinates, place.location.coordinates) : 0;
      const elapsedHours = previous ? Math.max((Date.now() - previous.createdAt.getTime()) / 3600000, 0.001) : 0;
      const flagged = travelMeters > 5000 && travelMeters / 1000 / elapsedHours > 150;
      const checkin = await Checkin.create({ user: req.user._id, place: placeId, crowd: body.crowd, noise: body.noise,
        verificationLevel, accuracyMeters: body.accuracyMeters ?? null,
        verifiedAt: verificationLevel === 'qr_verified' ? new Date() : null,
        flagged,
        expiresAt: new Date(Date.now() + cfg.checkinMinutes * 60000) });
      if (flagged) {
        const flag = await FraudFlag.create({ user: req.user._id, place: placeId, checkin: checkin._id,
          reason: 'impossible_travel', detail: `${Math.round(travelMeters / 1000)} km in ${Math.max(1, Math.round(elapsedHours * 60))} minutes`,
          evidence: { distanceMeters: Math.round(travelMeters), elapsedMinutes: Math.max(1, Math.round(elapsedHours * 60)),
            gpsAccuracyMeters: body.accuracyMeters ?? null, previousCheckin: previous?._id || null,
            previousAt: previous?.createdAt || null, currentAt: checkin.createdAt, verificationLevel } });
        await notifyAdmins(cfg, { kind: 'fraud_flag', title: 'Check-in cần kiểm tra',
          body: `Phát hiện di chuyển bất thường tại ${place.name}.`, resourceType: 'FraudFlag', resourceId: flag._id }).catch(console.error);
      }
      if (verificationLevel === 'qr_verified' && !flagged) {
        const proof = await VisitProof.create({ user: req.user._id, place: placeId, method: 'qr', verifiedAt: checkin.verifiedAt });
        await linkReviewToVisit(proof);
      }
      if (!flagged) await awardReputation(req.user._id, placeId, 'checkin', new Date().toISOString().slice(0, 10), 1);
      const liveStatus = await recalculateStatus(placeId, cfg, io);
      res.status(201).json({ checkin, liveStatus });
    }
  };
}
