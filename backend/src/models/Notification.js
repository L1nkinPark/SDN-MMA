import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  resourceType: { type: String, default: null },
  resourceId: { type: Schema.Types.ObjectId, default: null },
  readAt: { type: Date, default: null },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 86400000) }
}, { timestamps: true, versionKey: false });
schema.index({ user: 1, createdAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Notification = model('Notification', schema);
