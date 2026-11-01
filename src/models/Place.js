import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const schema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  address: { type: String, required: true, trim: true },
  location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } },
  amenities: { wifi: { type: Boolean, default: null }, outlets: { type: Boolean, default: null } },
  minDrinkPrice: { type: Number, min: 0, default: null },
  seedKey: { type: String, unique: true, sparse: true, select: false },
  source: {
    url: { type: String, default: null },
    retrievedAt: { type: Date, default: null },
    locationAccuracy: { type: String, enum: ['listed_point', 'campus_approximate', 'unknown'], default: 'unknown' },
    note: { type: String, default: null }
  },
  images: [{ type: String }],
  approval: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  ratingAverage: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  liveStatus: {
    crowd: { type: String, enum: ['unknown', 'low', 'medium', 'high'], default: 'unknown' },
    noise: { type: String, enum: ['unknown', 'quiet', 'moderate', 'loud'], default: 'unknown' },
    sampleCount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: null },
    validUntil: { type: Date, default: null }
  }
}, { timestamps: true, versionKey: false });
schema.index({ location: '2dsphere' });
schema.index({ approval: 1, createdAt: -1 });
schema.index({ 'liveStatus.validUntil': 1 });

export const Place = model('Place', schema);
