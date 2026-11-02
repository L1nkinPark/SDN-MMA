import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  text: { type: String, required: true, trim: true },
  hidden: { type: Boolean, default: false },
  moderationNote: { type: String, default: null },
  verifiedVisit: { type: Schema.Types.ObjectId, ref: 'VisitProof', default: null }
}, { timestamps: true, versionKey: false });
schema.index({ user: 1, place: 1 }, { unique: true });
schema.index({ place: 1, hidden: 1, createdAt: -1 });

export const Review = model('Review', schema);
