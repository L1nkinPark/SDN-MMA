import { z } from 'zod';
import { Checkin, Place, Report, Review, User } from '../models/index.js';
import { HttpError, assertId, coordinates, pageQuery, parse } from '../utils/common.js';
import { updateRating } from '../services/ratingService.js';
import { uploadPlaceImage } from '../services/imageService.js';

export const adminController = {
  listPlaces: async (req, res) => {
    const { page, limit, approval } = parse(pageQuery.extend({ approval: z.enum(['pending', 'approved', 'rejected']).optional() }), req.query);
    const query = approval ? { approval } : {};
    const [items, total] = await Promise.all([
      Place.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Place.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  updatePlace: async (req, res) => {
    const id = assertId(req.params.id);
    const body = parse(z.object({
      name: z.string().trim().min(2).max(120).optional(), description: z.string().trim().max(2000).optional(),
      address: z.string().trim().min(5).max(300).optional(), coordinates: coordinates.optional(),
      amenities: z.object({ wifi: z.boolean().nullable().optional(), outlets: z.boolean().nullable().optional() }).optional(),
      minDrinkPrice: z.number().min(0).nullable().optional(),
      approval: z.enum(['pending', 'approved', 'rejected']).optional()
    }), req.body);
    if (!Object.keys(body).length) throw new HttpError(400, 'No changes supplied');
    const changes = { ...body };
    if (body.coordinates) { changes.location = { type: 'Point', coordinates: body.coordinates }; delete changes.coordinates; }
    if (body.amenities) {
      delete changes.amenities;
      for (const [key, value] of Object.entries(body.amenities)) changes[`amenities.${key}`] = value;
    }
    const place = await Place.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true });
    if (!place) throw new HttpError(404, 'Place not found');
    res.json({ place });
  },
  listReports: async (req, res) => {
    const { page, limit, status } = parse(pageQuery.extend({ status: z.enum(['pending', 'resolved', 'dismissed']).optional() }), req.query);
    const query = status ? { status } : {};
    const [items, total] = await Promise.all([
      Report.find(query).populate('user', 'name email').populate('place', 'name address').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Report.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  updateReport: async (req, res) => {
    const id = assertId(req.params.id);
    const { status } = parse(z.object({ status: z.enum(['resolved', 'dismissed']) }), req.body);
    const report = await Report.findByIdAndUpdate(id, { $set: { status, resolvedBy: req.user._id } }, { new: true });
    if (!report) throw new HttpError(404, 'Report not found');
    res.json({ report });
  },
  listReviews: async (req, res) => {
    const { page, limit, hidden } = parse(pageQuery.extend({ hidden: z.enum(['true', 'false']).optional() }), req.query);
    const query = hidden === undefined ? {} : { hidden: hidden === 'true' };
    const [items, total] = await Promise.all([
      Review.find(query).populate('user', 'name email').populate('place', 'name address')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Review.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  updateReview: async (req, res) => {
    const id = assertId(req.params.id);
    const { hidden } = parse(z.object({ hidden: z.boolean() }), req.body);
    const review = await Review.findByIdAndUpdate(id, { $set: { hidden } }, { new: true });
    if (!review) throw new HttpError(404, 'Review not found');
    await updateRating(review.place);
    res.json({ review });
  },
  uploadImage: async (req, res) => {
    const id = assertId(req.params.id);
    if (!req.file) throw new HttpError(400, 'JPEG, PNG, or WebP image required (max 5 MB)');
    if (!(await Place.exists({ _id: id }))) throw new HttpError(404, 'Place not found');
    const imageUrl = await uploadPlaceImage(req.file);
    const place = await Place.findByIdAndUpdate(id, { $push: { images: imageUrl } }, { new: true });
    res.status(201).json({ imageUrl, place });
  },
  analytics: async (_req, res) => {
    const [users, approvedPlaces, pendingPlaces, pendingReports, reviews, activeCheckins] = await Promise.all([
      User.countDocuments(), Place.countDocuments({ approval: 'approved' }), Place.countDocuments({ approval: 'pending' }),
      Report.countDocuments({ status: 'pending' }), Review.countDocuments({ hidden: false }), Checkin.countDocuments({ expiresAt: { $gt: new Date() } })
    ]);
    res.json({ users, approvedPlaces, pendingPlaces, pendingReports, reviews, activeCheckins });
  }
};
