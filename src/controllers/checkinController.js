import { z } from 'zod';
import { Checkin, Place } from '../models/index.js';
import { HttpError, assertId, coordinates, distanceMeters, parse } from '../utils/common.js';
import { awardReputation } from '../services/reputationService.js';
import { recalculateStatus } from '../services/statusService.js';

const checkinBody = z.object({
  crowd: z.enum(['low', 'medium', 'high']), noise: z.enum(['quiet', 'moderate', 'loud']), coordinates
});

export function checkinController(cfg, io) {
  return {
    create: async (req, res) => {
      const placeId = assertId(req.params.id);
      const body = parse(checkinBody, req.body);
      const place = await Place.findOne({ _id: placeId, approval: 'approved' });
      if (!place) throw new HttpError(404, 'Place not found');
      if (distanceMeters(body.coordinates, place.location.coordinates) > 250) throw new HttpError(403, 'Check-in requires location within 250 meters');
      const cooldown = new Date(Date.now() - 15 * 60000);
      const recent = await Checkin.exists({ user: req.user._id, place: placeId, createdAt: { $gt: cooldown } });
      if (recent) throw new HttpError(429, 'Wait 15 minutes before another check-in at this place');
      const checkin = await Checkin.create({ user: req.user._id, place: placeId, crowd: body.crowd, noise: body.noise, expiresAt: new Date(Date.now() + cfg.checkinMinutes * 60000) });
      await awardReputation(req.user._id, placeId, 'checkin', new Date().toISOString().slice(0, 10), 1);
      const liveStatus = await recalculateStatus(placeId, cfg, io);
      res.status(201).json({ checkin, liveStatus });
    }
  };
}
