import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { MerchantClaim, Place } from '../models/index.js';
import { HttpError, assertId, pageQuery, parse } from '../utils/common.js';

const claimBody = z.object({
  placeId: z.string(), businessName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(8).max(20),
  evidenceUrls: z.array(z.url().startsWith('https://')).min(1).max(5)
});
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const businessBody = z.object({
  phone: z.string().trim().min(8).max(20).nullable().optional(),
  openingHours: z.array(z.object({ day: z.number().int().min(0).max(6), open: clock, close: clock }))
    .max(7).optional(),
  temporaryClosed: z.boolean().optional(), seatingCapacity: z.number().int().min(1).max(10000).nullable().optional(),
  bookingEnabled: z.boolean().optional(), slotMinutes: z.union([z.literal(30), z.literal(60), z.literal(120)]).optional(),
  capacityPerSlot: z.number().int().min(1).max(10000).nullable().optional(),
  wifi: z.boolean().nullable().optional(), outlets: z.boolean().nullable().optional(),
  minDrinkPrice: z.number().min(0).nullable().optional()
});

export function merchantController(cfg) {
  return {
    submitClaim: async (req, res) => {
      const body = parse(claimBody, req.body);
      const placeId = assertId(body.placeId);
      const place = await Place.findOne({ _id: placeId, approval: 'approved' });
      if (!place) throw new HttpError(404, 'Approved place not found');
      if (place.owner) throw new HttpError(409, 'Place already has an owner');
      if (await MerchantClaim.exists({ applicant: req.user._id, place: placeId, status: 'pending' })) {
        throw new HttpError(409, 'Pending claim already exists');
      }
      const claim = await MerchantClaim.create({
        applicant: req.user._id, place: placeId, businessName: body.businessName,
        contactPhone: body.contactPhone, evidenceUrls: body.evidenceUrls
      });
      res.status(201).json({ claim });
    },
    myClaims: async (req, res) => {
      const { page, limit } = parse(pageQuery, req.query);
      const query = { applicant: req.user._id };
      const [items, total] = await Promise.all([
        MerchantClaim.find(query).populate('place', 'name address approval').sort({ createdAt: -1 })
          .skip((page - 1) * limit).limit(limit).lean(), MerchantClaim.countDocuments(query)
      ]);
      res.json({ items, page, limit, total });
    },
    myPlaces: async (req, res) => {
      const items = await Place.find({ owner: req.user._id }).sort({ createdAt: -1 }).lean();
      res.json({ items });
    },
    updatePlace: async (req, res) => {
      const id = assertId(req.params.id);
      const body = parse(businessBody, req.body);
      if (!Object.keys(body).length) throw new HttpError(400, 'No changes supplied');
      if (body.openingHours) {
        if (new Set(body.openingHours.map(h => h.day)).size !== body.openingHours.length ||
          body.openingHours.some(h => h.open >= h.close)) throw new HttpError(400, 'Invalid opening hours');
      }
      const changes = {};
      for (const key of ['phone', 'openingHours', 'temporaryClosed', 'seatingCapacity']) {
        if (body[key] !== undefined) changes[`business.${key}`] = body[key];
      }
      for (const [from, to] of [['bookingEnabled', 'booking.enabled'], ['slotMinutes', 'booking.slotMinutes'],
        ['capacityPerSlot', 'booking.capacityPerSlot'], ['wifi', 'amenities.wifi'], ['outlets', 'amenities.outlets'],
        ['minDrinkPrice', 'minDrinkPrice']]) {
        if (body[from] !== undefined) changes[to] = body[from];
      }
      const place = await Place.findOneAndUpdate({ _id: id, owner: req.user._id, approval: 'approved' },
        { $set: changes }, { new: true, runValidators: true });
      if (!place) throw new HttpError(404, 'Owned place not found');
      res.json({ place });
    },
    visitCode: async (req, res) => {
      const id = assertId(req.params.id);
      const place = await Place.findOne({ _id: id, owner: req.user._id, approval: 'approved' }).select('_id business.temporaryClosed');
      if (!place) throw new HttpError(404, 'Owned place not found');
      if (place.business?.temporaryClosed) throw new HttpError(409, 'Place is temporarily closed');
      const code = jwt.sign({ type: 'visit_qr', place: id, owner: String(req.user._id) }, cfg.accessSecret,
        { algorithm: 'HS256', expiresIn: '90s' });
      res.json({ code, expiresInSeconds: 90 });
    }
  };
}
