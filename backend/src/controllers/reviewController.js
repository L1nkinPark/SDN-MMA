import { z } from 'zod';
import { Place, Review, VisitProof } from '../models/index.js';
import { HttpError, assertId, pageQuery, parse } from '../utils/common.js';
import { updateRating } from '../services/ratingService.js';
import { awardReputation } from '../services/reputationService.js';

const reviewBody = z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().min(3).max(1000) });

export const reviewController = {
  mine: async (req, res) => {
    const placeId = assertId(req.params.id);
    const review = await Review.findOne({ place: placeId, user: req.user._id }).lean();
    res.set('Cache-Control', 'no-store').json({ review });
  },
  list: async (req, res) => {
    const placeId = assertId(req.params.id);
    const place = await Place.findOne({ _id: placeId, approval: 'approved' }).select('_id');
    if (!place) throw new HttpError(404, 'Place not found');
    const { page, limit } = parse(pageQuery, req.query);
    const query = { place: placeId, hidden: false, verifiedVisit: { $type: 'objectId' } };
    const [items, total] = await Promise.all([
      Review.find(query).populate('user', 'name reputation').populate('verifiedVisit', 'method')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Review.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  upsertMine: async (req, res) => {
    const placeId = assertId(req.params.id);
    const body = parse(reviewBody, req.body);
    const place = await Place.findOne({ _id: placeId, approval: 'approved' }).select('owner');
    if (!place) throw new HttpError(404, 'Place not found');
    if (String(place.owner) === String(req.user._id)) throw new HttpError(403, 'Owner cannot review own place');
    const previous = await Review.findOne({ user: req.user._id, place: placeId });
    if (previous?.hidden) throw new HttpError(403, 'This review was hidden by moderation');
    const proof = await VisitProof.findOne({ user: req.user._id, place: placeId,
      verifiedAt: { $gte: new Date(Date.now() - 14 * 86400000) } }).sort({ verifiedAt: -1 });
    if (!proof) throw new HttpError(403, 'Verified visit required to review');
    const review = await Review.findOneAndUpdate({ user: req.user._id, place: placeId },
      { $set: { ...body, verifiedVisit: proof._id }, $setOnInsert: { hidden: false } },
      { upsert: true, new: true });
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
