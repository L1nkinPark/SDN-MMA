import { Place } from '../models/index.js';
import { hcmD1Places } from '../data/hcmD1Places.js';

export async function seedHcmD1Places(adminId) {
  await Place.updateMany(
    { seedKey: { $in: hcmD1Places.map(entry => entry.seedKey) }, 'source.locationAccuracy': 'exact' },
    { $set: { 'source.locationAccuracy': 'listed_point' } }
  );
  const results = [];
  for (const entry of hcmD1Places) {
    const { coordinates, source, ...fields } = entry;
    const result = await Place.updateOne(
      { seedKey: entry.seedKey },
      { $setOnInsert: {
        ...fields,
        location: { type: 'Point', coordinates },
        amenities: { wifi: null, outlets: null },
        minDrinkPrice: null,
        source: { ...source, retrievedAt: new Date() },
        approval: 'approved',
        submittedBy: adminId
      } },
      { upsert: true }
    );
    results.push({ name: entry.name, inserted: result.upsertedCount === 1 });
  }
  return results;
}
