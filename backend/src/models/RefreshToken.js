import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model('RefreshToken', schema);
