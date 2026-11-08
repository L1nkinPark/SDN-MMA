import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  applicant: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
  businessName: { type: String, required: true, trim: true },
  contactPhone: { type: String, required: true, trim: true },
  evidenceUrls: [{ type: String, required: true }],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  decisionNote: { type: String, default: null },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
schema.index({ applicant: 1, place: 1, status: 1 });
schema.index({ applicant: 1, place: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
schema.index({ place: 1, status: 1 });
export const MerchantClaim = model('MerchantClaim', schema);
