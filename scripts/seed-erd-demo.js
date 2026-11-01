import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Checkin, Place, RefreshToken, Report, ReputationEvent, Review, User } from '../src/models/index.js';

const uri = new URL(process.env.MONGODB_URI || '');
if (uri.pathname !== '/studyspot') {
  throw new Error('ERD demo requires MONGODB_URI to point to the studyspot database');
}
uri.pathname = '/studyspot_erd_demo';

await mongoose.connect(uri.toString());
try {
  if (mongoose.connection.db.databaseName !== 'studyspot_erd_demo') {
    throw new Error('Refusing to write outside studyspot_erd_demo');
  }
  await Promise.all([User.init(), Place.init(), Checkin.init(), Review.init(), Report.init(), RefreshToken.init(), ReputationEvent.init()]);

  const passwordHash = await bcrypt.hash('ERD-demo-only-no-login', 10);
  const admin = await User.findOneAndUpdate(
    { email: 'erd-admin@studyspot.invalid' },
    { $set: { name: 'ERD Demo Admin', passwordHash, role: 'admin', reputation: 0 } },
    { new: true, upsert: true, runValidators: true }
  );
  const student = await User.findOneAndUpdate(
    { email: 'erd-student@studyspot.invalid' },
    { $set: { name: 'ERD Demo Student', passwordHash, role: 'student', reputation: 3 } },
    { new: true, upsert: true, runValidators: true }
  );
  const place = await Place.findOneAndUpdate(
    { seedKey: 'erd-demo-place' },
    { $set: {
      name: 'StudySpot ERD Demo', description: 'Illustrative data model only',
      address: 'Lô E2a-7, đường D1, TP. Hồ Chí Minh',
      location: { type: 'Point', coordinates: [106.809666, 10.841] },
      amenities: { wifi: true, outlets: true }, minDrinkPrice: 25000,
      source: { url: 'https://example.invalid/erd-demo', retrievedAt: new Date(), locationAccuracy: 'campus_approximate', note: 'Demo record' },
      images: ['https://example.invalid/studyspot-demo.png'], approval: 'approved',
      submittedBy: admin._id, ratingAverage: 5, ratingCount: 1,
      liveStatus: { crowd: 'medium', noise: 'moderate', sampleCount: 1, updatedAt: new Date(), validUntil: new Date(Date.now() + 60 * 60_000) }
    } },
    { new: true, upsert: true, runValidators: true }
  );
  await User.updateOne({ _id: student._id }, { $set: { favorites: [place._id] } });

  await Promise.all([
    Checkin.findOneAndUpdate(
      { user: student._id, place: place._id },
      { $set: { crowd: 'medium', noise: 'moderate', expiresAt: new Date(Date.now() + 120 * 60_000) } },
      { upsert: true, runValidators: true }
    ),
    Review.findOneAndUpdate(
      { user: student._id, place: place._id },
      { $set: { rating: 5, text: 'ERD demo review', hidden: false } },
      { upsert: true, runValidators: true }
    ),
    Report.findOneAndUpdate(
      { user: student._id, place: place._id },
      { $set: { reason: 'incorrect_info', detail: 'ERD demo report only', status: 'resolved', resolvedBy: admin._id } },
      { upsert: true, runValidators: true }
    ),
    ReputationEvent.findOneAndUpdate(
      { user: student._id, place: place._id, kind: 'review', day: new Date().toISOString().slice(0, 10) },
      { $set: { kind: 'review' } },
      { upsert: true, runValidators: true }
    ),
    RefreshToken.findOneAndUpdate(
      { tokenHash: crypto.createHash('sha256').update('studyspot-erd-demo-only').digest('hex') },
      { $set: { user: student._id, expiresAt: new Date(Date.now() + 30 * 86400_000), revokedAt: null } },
      { upsert: true, runValidators: true }
    )
  ]);

  // Compass can infer references more reliably when the referenced fields are indexed.
  // These supplemental indexes exist only in the isolated visualization database.
  await Promise.all([
    User.collection.createIndex({ favorites: 1 }),
    Place.collection.createIndex({ submittedBy: 1 }),
    RefreshToken.collection.createIndex({ user: 1 }),
    Report.collection.createIndex({ resolvedBy: 1 })
  ]);

  const names = ['users', 'places', 'checkins', 'reviews', 'reports', 'refreshtokens', 'reputationevents'];
  const counts = await Promise.all(names.map(async name => `${name}:${await mongoose.connection.db.collection(name).countDocuments()}`));
  console.log('Created isolated ERD sample database: studyspot_erd_demo');
  console.log(counts.join(', '));
} finally {
  await mongoose.disconnect();
}
