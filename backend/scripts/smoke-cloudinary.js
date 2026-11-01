import 'dotenv/config';
import mongoose from 'mongoose';
import request from 'supertest';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../src/config.js';
import { createApp } from '../src/app.js';
import { Place, User } from '../src/models/index.js';
import { accessToken } from '../src/services/tokenService.js';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run smoke:cloudinary -- admin@example.com');
  process.exit(1);
}

const cfg = config();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9R3x0AAAAASUVORK5CYII=', 'base64');
const io = { to: () => ({ emit: () => {} }) };
let imageUrl;
let publicId;
let place;
await mongoose.connect(cfg.mongoUri);
try {
  const admin = await User.findOne({ email, role: 'admin' });
  if (!admin) throw new Error('Admin account not found');
  place = await Place.findOne({ seedKey: 'hcm-d1-passio-fpt' });
  if (!place) throw new Error('Seeded Passio place not found');
  const target = process.env.SMOKE_BASE_URL || createApp(cfg, io);
  const response = await request(target)
    .post(`/api/admin/places/${place._id}/images`)
    .set('Authorization', `Bearer ${accessToken(admin, cfg)}`)
    .attach('image', png, 'studyspot-upload-check.png');
  if (response.status !== 201) throw new Error(`Upload endpoint returned HTTP ${response.status}: ${response.body.error || 'unknown error'}`);
  imageUrl = response.body.imageUrl;
  const match = new URL(imageUrl).pathname.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.[^./]+$/);
  if (!match) throw new Error('Could not identify uploaded test asset for cleanup');
  publicId = match[1];
  console.log('Cloudinary upload endpoint: HTTP 201');
} finally {
  try {
    if (imageUrl && place) await Place.updateOne({ _id: place._id }, { $pull: { images: imageUrl } });
    if (publicId) {
      const removed = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      if (removed.result !== 'ok') throw new Error(`Test asset cleanup returned: ${removed.result}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}
