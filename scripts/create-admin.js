import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/index.js';

const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error('Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in .env');
  process.exit(1);
}
await mongoose.connect(MONGODB_URI);
const email = ADMIN_EMAIL.trim().toLowerCase();
await User.findOneAndUpdate(
  { email },
  { $set: { name: ADMIN_NAME || 'StudySpot Admin', role: 'admin', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12) } },
  { upsert: true, new: true }
);
console.log(`Admin account ready: ${email}`);
await mongoose.disconnect();
