import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
  kind: { type: String, enum: ['checkin', 'review'], required: true },
  day: { type: String, required: true }
}, { timestamps: true, versionKey: false });
schema.index({ user: 1, place: 1, kind: 1, day: 1 }, { unique: true });

export const ReputationEvent = model('ReputationEvent', schema);
