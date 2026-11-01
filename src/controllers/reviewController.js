import { z } from 'zod';
import { Place, Review } from '../models/index.js';
import { HttpError, assertId, pageQuery, parse } from '../utils/common.js';
import { updateRating } from '../services/ratingService.js';
import { awardReputation } from '../services/reputationService.js';

const reviewBody = z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().min(3).max(1000) });

export const reviewController = {
  list: async (req, res) => {
    const placeId = assertId(req.params.id);
    const place = await Place.findOne({ _id: placeId, approval: 'approved' }).select('_id');
    if (!place) throw new HttpError(404, 'Place not found');
    const { page, limit } = parse(pageQuery, req.query);
    const query = { place: placeId, hidden: false };
    const [items, total] = await Promise.all([
      Review.find(query).populate('user', 'name reputation').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Review.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  upsertMine: async (req, res) => {
    const placeId = assertId(req.params.id);
    const body = parse(reviewBody, req.body);
    if (!(await Place.exists({ _id: placeId, approval: 'approved' }))) throw new HttpError(404, 'Place not found');
    const previous = await Review.findOne({ user: req.user._id, place: placeId });
    if (previous?.hidden) throw new HttpError(403, 'This review was hidden by moderation');
    const review = await Review.findOneAndUpdate({ user: req.user._id, place: placeId }, { $set: body, $setOnInsert: { hidden: false } }, { upsert: true, new: true });
    if (!previous) await awardReputation(req.user._id, placeId, 'review', 'lifetime', 2);
    await updateRating(placeId);
    res.json({ review });
  },
  deleteMine: async (req, res) => {
    const placeId = assertId(req.params.id);
    const result = await Review.deleteOne({ user: req.user._id, place: placeId });
    if (!result.deletedCount) throw new HttpError(404, 'Review not found');
    await updateRating(placeId);
    res.status(204).end();
  }
};
