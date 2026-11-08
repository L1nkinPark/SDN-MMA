import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  partySize: { type: Number, required: true, min: 1, max: 20 },
  idempotencyKey: { type: String, default: null },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'], default: 'confirmed' },
  holdUntil: { type: Date, default: null },
  note: { type: String, default: '' },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledAt: { type: Date, default: null },
  cancellationReason: { type: String, default: null },
  cancellationKind: { type: String, enum: ['user', 'merchant', 'admin', 'declined', 'expired', null], default: null },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null },
  arrivedAt: { type: Date, default: null },
  noShowAt: { type: Date, default: null },
  remindedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
schema.index({ user: 1, startsAt: -1 });
schema.index({ place: 1, startsAt: 1, status: 1 });
schema.index({ user: 1, place: 1, startsAt: 1 }, { unique: true, name: 'unique_active_booking_v2',
  partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } });
schema.index({ user: 1, idempotencyKey: 1 }, { unique: true,
  partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
export const Booking = model('Booking', schema);
