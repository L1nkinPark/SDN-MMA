import 'dotenv/config';
import mongoose from 'mongoose';
import { Place } from '../src/models/index.js';
import { updateRating } from '../src/services/ratingService.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
await mongoose.connect(process.env.MONGODB_URI);
try {
  let count = 0;
  for await (const place of Place.find().select('_id').cursor()) {
    await updateRating(place._id);
    count += 1;
  }
  console.log(`Recalculated verified review ratings for ${count} places`);
} finally {
  await mongoose.disconnect();
}
