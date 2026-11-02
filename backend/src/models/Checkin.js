import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
  crowd: { type: String, enum: ['low', 'medium', 'high'], required: true },
  noise: { type: String, enum: ['quiet', 'moderate', 'loud'], required: true },
  verificationLevel: { type: String, enum: ['gps_only', 'qr_verified', 'staff_verified'], default: 'gps_only' },
  verifiedAt: { type: Date, default: null },
  booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
  flagged: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true }
}, { timestamps: true, versionKey: false });
schema.index({ place: 1, expiresAt: 1 });
schema.index({ user: 1, place: 1, expiresAt: 1 });
schema.index({ user: 1, createdAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export const Checkin = model('Checkin', schema);
