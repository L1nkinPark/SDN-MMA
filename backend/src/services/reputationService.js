import { ReputationEvent, User } from '../models/index.js';

export async function awardReputation(userId, placeId, kind, day, points) {
  try {
    await ReputationEvent.create({ user: userId, place: placeId, kind, day });
  } catch (err) {
    if (err.code === 11000) return;
    throw err;
  }
  await User.updateOne({ _id: userId }, { $inc: { reputation: points } });
}
