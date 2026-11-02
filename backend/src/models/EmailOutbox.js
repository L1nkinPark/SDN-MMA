import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  to: { type: String, required: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  status: { type: String, enum: ['pending', 'sending', 'sent', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  lockedUntil: { type: Date, default: null },
  sentAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 86400000) }
}, { timestamps: true, versionKey: false });
schema.index({ status: 1, nextAttemptAt: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const EmailOutbox = model('EmailOutbox', schema);
