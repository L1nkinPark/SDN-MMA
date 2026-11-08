import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  email: { type: String, required: true, lowercase: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true, versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const EmailChange = model('EmailChange', schema);
