import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  favorites: [{ type: Schema.Types.ObjectId, ref: 'Place' }],
  reputation: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });

export const User = model('User', schema);
