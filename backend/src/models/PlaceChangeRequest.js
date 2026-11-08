import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
  merchant: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  changes: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  decisionNote: { type: String, default: null },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
schema.index({ place: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
schema.index({ merchant: 1, createdAt: -1 });
export const PlaceChangeRequest = model('PlaceChangeRequest', schema);
