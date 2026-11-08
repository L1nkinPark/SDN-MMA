import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'merchant', 'admin'], default: 'student' },
  status: { type: String, enum: ['active', 'pending_merchant', 'suspended', 'deleted'], default: 'active' },
  tokenVersion: { type: Number, default: 0 },
  adminPermissions: { type: [String], default: function () { return this.role === 'admin' ? ['*'] : []; } },
  notificationSettings: { email: { type: Boolean, default: true }, inApp: { type: Boolean, default: true } },
  favorites: [{ type: Schema.Types.ObjectId, ref: 'Place' }],
  reputation: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });

export const User = model('User', schema);
