import { z } from 'zod';
import { Place } from '../models/index.js';
import { HttpError, assertId, coordinates, escapeRegex, pageQuery, parse } from '../utils/common.js';
import { notifyAdmins } from '../services/notificationService.js';

export const placeBody = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  address: z.string().trim().min(5).max(300),
  coordinates,
  amenities: z.object({ wifi: z.boolean().nullable().default(null), outlets: z.boolean().nullable().default(null) }).default({ wifi: null, outlets: null }),
  minDrinkPrice: z.number().min(0).nullable().default(null)
});
const searchQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(100).max(50000).default(5000),
  wifi: z.enum(['true', 'false']).optional(),
  outlets: z.enum(['true', 'false']).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  crowd: z.enum(['unknown', 'low', 'medium', 'high']).optional(),
  noise: z.enum(['unknown', 'quiet', 'moderate', 'loud']).optional()
});

export const placeController = {
  list: async (req, res) => {
    const input = parse(searchQuery, req.query);
    if ((input.lat === undefined) !== (input.lng === undefined)) throw new HttpError(400, 'lat and lng must be supplied together');
    const query = { approval: 'approved' };
    if (input.q) { const pattern = new RegExp(escapeRegex(input.q), 'i'); query.$or = [{ name: pattern }, { address: pattern }]; }
    if (input.wifi) query['amenities.wifi'] = input.wifi === 'true';
    if (input.outlets) query['amenities.outlets'] = input.outlets === 'true';
    if (input.maxPrice !== undefined) query.minDrinkPrice = { $lte: input.maxPrice };
    if (input.crowd) query['liveStatus.crowd'] = input.crowd;
    if (input.noise) query['liveStatus.noise'] = input.noise;
    if (input.lat !== undefined) query.location = { $near: { $geometry: { type: 'Point', coordinates: [input.lng, input.lat] }, $maxDistance: input.radius } };
    const [items, total] = await Promise.all([
      Place.find(query).sort(input.lat === undefined ? { createdAt: -1 } : undefined).skip((input.page - 1) * input.limit).limit(input.limit).lean(),
      Place.countDocuments(input.lat === undefined ? query : { ...query, location: { $geoWithin: { $centerSphere: [[input.lng, input.lat], input.radius / 6371000] } } })
    ]);
    res.json({ items, page: input.page, limit: input.limit, total });
  },
  create: async (req, res) => {
    const body = parse(placeBody, req.body);
    await assertNoDuplicatePlace(body);
    const place = await Place.create({ ...body, location: { type: 'Point', coordinates: body.coordinates }, submittedBy: req.user._id, approval: req.user.role === 'admin' ? 'approved' : 'pending' });
    if (place.approval === 'pending') await notifyAdmins(req.app.locals.cfg, { kind: 'place_submitted',
      title: 'Địa điểm mới chờ duyệt', body: `${req.user.name} đề xuất ${place.name}.`,
      resourceType: 'Place', resourceId: place._id }).catch(console.error);
    res.status(201).json({ place });
  },
  get: async (req, res) => {
    const place = await Place.findById(assertId(req.params.id)).lean();
    if (!place || place.approval !== 'approved') throw new HttpError(404, 'Place not found');
    res.json({ place });
  }
};

export async function assertNoDuplicatePlace(body, excludeId = null) {
  const duplicate = await Place.findOne({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    name: new RegExp(`^${escapeRegex(body.name)}$`, 'i'),
    approval: { $ne: 'rejected' },
    location: { $near: { $geometry: { type: 'Point', coordinates: body.coordinates }, $maxDistance: 100 } }
  }).select('_id name address');
  if (duplicate) throw new HttpError(409, `Possible duplicate place: ${duplicate._id}`);
}
