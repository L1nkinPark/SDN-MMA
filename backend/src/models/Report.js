import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  place: { type: Schema.Types.ObjectId, ref: 'Place', required: true },
  reason: { type: String, enum: ['closed', 'incorrect_info', 'inappropriate', 'other'], required: true },
  detail: { type: String, required: true },
  status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  resolutionNote: { type: String, default: null }
}, { timestamps: true, versionKey: false });
schema.index({ status: 1, createdAt: -1 });
schema.index({ user: 1, place: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });

export const Report = model('Report', schema);
