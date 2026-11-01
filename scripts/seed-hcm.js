import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/index.js';
import { seedHcmD1Places } from '../src/services/seedService.js';

const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
if (!process.env.MONGODB_URI || !email) {
  console.error('Set MONGODB_URI and pass an admin email: npm run seed:hcm -- admin@example.com');
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI);
try {
  const admin = await User.findOne({ email, role: 'admin' });
  if (!admin) throw new Error('Admin account not found; run npm run create-admin first');
  const results = await seedHcmD1Places(admin._id);
  console.log(`HCM D1 study places ready: ${results.filter(item => item.inserted).length} new, ${results.length} total`);
} finally {
  await mongoose.disconnect();
}
