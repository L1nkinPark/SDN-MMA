import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  partySize: { type: Number, required: true, min: 1, max: 20 },
  status: { type: String, enum: ['confirmed', 'cancelled', 'completed', 'no_show'], default: 'confirmed' },
  note: { type: String, default: '' },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  arrivedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
schema.index({ user: 1, startsAt: -1 });
schema.index({ place: 1, startsAt: 1, status: 1 });
schema.index({ user: 1, place: 1, startsAt: 1 }, { unique: true, partialFilterExpression: { status: 'confirmed' } });
export const Booking = model('Booking', schema);
