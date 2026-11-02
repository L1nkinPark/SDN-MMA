import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { MerchantClaim, Place, PlaceChangeRequest } from '../models/index.js';
import { HttpError, assertId, pageQuery, parse } from '../utils/common.js';
import { notifyAdmins } from '../services/notificationService.js';
import { placeBody, assertNoDuplicatePlace } from './placeController.js';
import { uploadPlaceImage } from '../services/imageService.js';

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
  approvalMode: z.enum(['auto', 'manual']).optional(),
  capacityPerSlot: z.number().int().min(1).max(10000).nullable().optional(),
  wifi: z.boolean().nullable().optional(), outlets: z.boolean().nullable().optional(),
  minDrinkPrice: z.number().min(0).nullable().optional()
});
const newPlaceBody = placeBody.extend({
  contactPhone: z.string().trim().min(8).max(20),
  evidenceUrls: z.array(z.url().startsWith('https://')).min(1).max(5)
});
const changeBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().min(5).max(300).optional(),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).optional()
});

export function merchantController(cfg) {
  return {
    createPlace: async (req, res) => {
      const body = parse(newPlaceBody, req.body);
      if (await Place.countDocuments({ owner: req.user._id, approval: 'pending' }) >= 3) {
        throw new HttpError(409, 'Maximum 3 pending place submissions');
      }
      await assertNoDuplicatePlace(body);
      const { contactPhone, evidenceUrls, ...fields } = body;
      const place = await Place.create({ ...fields, location: { type: 'Point', coordinates: body.coordinates },
        submittedBy: req.user._id, owner: req.user._id, approval: 'pending',
        business: { phone: contactPhone }, onboardingEvidenceUrls: evidenceUrls });
      await notifyAdmins(cfg, { kind: 'merchant_place', title: 'Quán mới chờ duyệt',
        body: `${req.user.name} gửi hồ sơ quán ${place.name}.`, resourceType: 'Place', resourceId: place._id }).catch(console.error);
      res.status(201).json({ place });
    },
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
      await notifyAdmins(cfg, { kind: 'merchant_claim', title: 'Hồ sơ chủ quán mới',
        body: `${req.user.name} gửi yêu cầu quản lý ${place.name}.`,
        resourceType: 'MerchantClaim', resourceId: claim._id }).catch(console.error);
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
    myChangeRequests: async (req, res) => {
      const { page, limit } = parse(pageQuery, req.query);
      const query = { merchant: req.user._id };
      const [items, total] = await Promise.all([
        PlaceChangeRequest.find(query).populate('place', 'name address').sort({ createdAt: -1 })
          .skip((page - 1) * limit).limit(limit).lean(), PlaceChangeRequest.countDocuments(query)
      ]);
      res.json({ items, page, limit, total });
    },
    submitChange: async (req, res) => {
      const placeId = assertId(req.params.id);
      const changes = parse(changeBody, req.body);
      if (!Object.keys(changes).length) throw new HttpError(400, 'No changes supplied');
      const place = await Place.findOne({ _id: placeId, owner: req.user._id, approval: 'approved' });
      if (!place) throw new HttpError(404, 'Owned place not found');
      if (changes.name || changes.coordinates) await assertNoDuplicatePlace({
        name: changes.name || place.name, coordinates: changes.coordinates || place.location.coordinates
      }, placeId);
      const change = await PlaceChangeRequest.create({ place: placeId, merchant: req.user._id, changes });
      await notifyAdmins(cfg, { kind: 'place_change', title: 'Thay đổi quán chờ duyệt',
        body: `${req.user.name} đề nghị sửa ${place.name}.`, resourceType: 'PlaceChangeRequest', resourceId: change._id }).catch(console.error);
      res.status(201).json({ change });
    },
    submitImage: async (req, res) => {
      const placeId = assertId(req.params.id);
      const place = await Place.findOne({ _id: placeId, owner: req.user._id, approval: 'approved' });
      if (!place) throw new HttpError(404, 'Owned place not found');
      if (!req.file) throw new HttpError(400, 'JPEG, PNG, or WebP image required (max 5 MB)');
      if (await PlaceChangeRequest.exists({ place: placeId, status: 'pending' })) throw new HttpError(409, 'Pending change already exists');
      const imageUrl = await uploadPlaceImage(req.file);
      const change = await PlaceChangeRequest.create({ place: placeId, merchant: req.user._id,
        changes: { imagesToAdd: [imageUrl] } });
      await notifyAdmins(cfg, { kind: 'place_image', title: 'Ảnh quán chờ duyệt',
        body: `${req.user.name} gửi ảnh cho ${place.name}.`, resourceType: 'PlaceChangeRequest', resourceId: change._id }).catch(console.error);
      res.status(201).json({ change });
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
        ['approvalMode', 'booking.approvalMode'],
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
