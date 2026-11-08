import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
  checkin: { type: Schema.Types.ObjectId, ref: 'Checkin', required: true, unique: true },
  reason: { type: String, enum: ['impossible_travel'], required: true },
  detail: { type: String, required: true },
  evidence: {
    distanceMeters: { type: Number, default: null },
    elapsedMinutes: { type: Number, default: null },
    gpsAccuracyMeters: { type: Number, default: null },
    previousCheckin: { type: Schema.Types.ObjectId, ref: 'Checkin', default: null },
    previousAt: { type: Date, default: null },
    currentAt: { type: Date, default: null },
    verificationLevel: { type: String, default: null }
  },
  status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
schema.index({ status: 1, createdAt: -1 });
export const FraudFlag = model('FraudFlag', schema);
