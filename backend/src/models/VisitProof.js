import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
  method: { type: String, enum: ['qr', 'staff_booking', 'admin_dispute'], required: true },
  booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
  verifiedAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });
schema.index({ user: 1, place: 1, verifiedAt: -1 });
schema.index({ booking: 1 }, { unique: true, partialFilterExpression: { booking: { $type: 'objectId' } } });
export const VisitProof = model('VisitProof', schema);
