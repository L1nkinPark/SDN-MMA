import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  detail: { type: String, default: '' }
}, { timestamps: true, versionKey: false });
schema.index({ createdAt: -1 });
schema.index({ targetType: 1, targetId: 1, createdAt: -1 });
export const AuditEvent = model('AuditEvent', schema);
