import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['review_appeal', 'booking_dispute'], required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  decisionNote: { type: String, default: null },
  evidenceSource: { type: String, enum: ['receipt', 'qr_log', 'staff_confirmation', 'other', null], default: null },
  evidenceSummary: { type: String, default: null },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
schema.index({ user: 1, kind: 1, targetId: 1 }, { unique: true });
schema.index({ kind: 1, status: 1, createdAt: -1 });
export const SupportCase = model('SupportCase', schema);
