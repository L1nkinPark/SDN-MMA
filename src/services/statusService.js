import { Checkin, Place } from '../models/index.js';

const crowdValues = ['low', 'medium', 'high'];
const noiseValues = ['quiet', 'moderate', 'loud'];
const pendingUpdates = new Map();

function averageLabel(values, labels) {
  const average = values.reduce((sum, value) => sum + labels.indexOf(value), 0) / values.length;
  return labels[Math.round(average)];
}

async function calculateAndStore(placeId, cfg, io) {
  const now = new Date();
  const checkins = await Checkin.find({ place: placeId, expiresAt: { $gt: now } }).sort({ createdAt: -1 }).lean();
  const byUser = new Map();
  for (const checkin of checkins) {
    const key = String(checkin.user);
    if (!byUser.has(key)) byUser.set(key, checkin);
  }
  const latest = [...byUser.values()];
  const enough = latest.length >= cfg.minSamples;
  const liveStatus = {
    crowd: enough ? averageLabel(latest.map(c => c.crowd), crowdValues) : 'unknown',
    noise: enough ? averageLabel(latest.map(c => c.noise), noiseValues) : 'unknown',
    sampleCount: latest.length,
    updatedAt: now,
    validUntil: latest.length ? new Date(Math.min(...latest.map(c => new Date(c.expiresAt).getTime()))) : null
  };
  const place = await Place.findByIdAndUpdate(placeId, { $set: { liveStatus } }, { new: true });
  if (place && place.approval === 'approved') io?.to(`place:${placeId}`).emit('place:status', { placeId: String(placeId), liveStatus });
  return liveStatus;
}

export function recalculateStatus(placeId, cfg, io) {
  const key = String(placeId);
  const previous = pendingUpdates.get(key) || Promise.resolve();
  const work = previous.catch(() => {}).then(() => calculateAndStore(placeId, cfg, io));
  pendingUpdates.set(key, work);
  const cleanup = () => { if (pendingUpdates.get(key) === work) pendingUpdates.delete(key); };
  work.then(cleanup, cleanup);
  return work;
}

export async function refreshExpiredStatuses(cfg, io) {
  const places = await Place.find({ 'liveStatus.validUntil': { $lte: new Date() } }).select('_id').lean();
  for (const place of places) await recalculateStatus(place._id, cfg, io);
}
