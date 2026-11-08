import { Review } from '../models/index.js';
import { updateRating } from './ratingService.js';

export async function linkReviewToVisit(proof) {
  const review = await Review.findOneAndUpdate({ user: proof.user, place: proof.place, verifiedVisit: null,
    createdAt: { $gte: new Date(proof.verifiedAt.getTime() - 14 * 86400000) } },
  { $set: { verifiedVisit: proof._id } }, { new: true });
  if (review && !review.hidden) await updateRating(proof.place);
}
