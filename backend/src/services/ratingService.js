import mongoose from 'mongoose';
import { Place, Review } from '../models/index.js';

export async function updateRating(placeId) {
  const placeObjectId = new mongoose.Types.ObjectId(String(placeId));
  const summary = await Review.aggregate([
    { $match: { place: placeObjectId, hidden: false, verifiedVisit: { $type: 'objectId' } } },
    { $group: { _id: null, ratingAverage: { $avg: '$rating' }, ratingCount: { $sum: 1 } } }
  ]);
  await Place.updateOne({ _id: placeId }, { $set: { ratingAverage: summary[0]?.ratingAverage || 0, ratingCount: summary[0]?.ratingCount || 0 } });
}
