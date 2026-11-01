import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Checkin, Place, ReputationEvent, Review, User } from '../../src/models/index.js';
import { recalculateStatus, refreshExpiredStatuses } from '../../src/services/statusService.js';
import { updateRating } from '../../src/services/ratingService.js';
import { awardReputation } from '../../src/services/reputationService.js';

const placeId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const future = minutes => new Date(Date.now() + minutes * 60_000);

test('status uses each user’s latest active check-in and emits after saving', async t => {
  const checkins = [
    { user: 'a', crowd: 'low', noise: 'quiet', expiresAt: future(30) },
    { user: 'b', crowd: 'high', noise: 'loud', expiresAt: future(20) },
    { user: 'a', crowd: 'high', noise: 'loud', expiresAt: future(10) }
  ];
  t.mock.method(Checkin, 'find', query => {
    assert.equal(String(query.place), String(placeId));
    assert.ok(query.expiresAt.$gt instanceof Date);
    return { sort: order => {
      assert.deepEqual(order, { createdAt: -1 });
      return { lean: async () => checkins };
    } };
  });
  const sequence = [];
  t.mock.method(Place, 'findByIdAndUpdate', async (_id, update, options) => {
    assert.equal(String(_id), String(placeId));
    assert.deepEqual(options, { new: true });
    sequence.push('save');
    assert.equal(update.$set.liveStatus.sampleCount, 2);
    return { approval: 'approved' };
  });
  const io = { to: room => {
    assert.equal(room, `place:${placeId}`);
    return { emit: (name, payload) => {
      assert.equal(name, 'place:status');
      assert.equal(payload.liveStatus.crowd, 'medium');
      sequence.push('emit');
    } };
  } };
  const status = await recalculateStatus(placeId, { minSamples: 2 }, io);
  assert.equal(status.crowd, 'medium');
  assert.equal(status.noise, 'moderate');
  assert.equal(status.validUntil.getTime(), checkins[1].expiresAt.getTime());
  assert.deepEqual(sequence, ['save', 'emit']);
});

test('status is unknown below sample threshold and rejected places do not emit', async t => {
  t.mock.method(Checkin, 'find', () => ({ sort: () => ({ lean: async () => [
    { user: 'a', crowd: 'high', noise: 'loud', expiresAt: future(20) }
  ] }) }));
  t.mock.method(Place, 'findByIdAndUpdate', async () => ({ approval: 'rejected' }));
  const io = { to: () => { throw new Error('Rejected place must not emit'); } };
  const status = await recalculateStatus(placeId, { minSamples: 2 }, io);
  assert.equal(status.crowd, 'unknown');
  assert.equal(status.noise, 'unknown');
  assert.equal(status.sampleCount, 1);
});

test('concurrent status recalculations serialize writes for the same place', async t => {
  const order = [];
  let reads = 0;
  t.mock.method(Checkin, 'find', () => ({ sort: () => ({ lean: async () => {
    reads++;
    order.push(`read${reads}`);
    return [];
  } }) }));
  t.mock.method(Place, 'findByIdAndUpdate', async () => {
    order.push('write');
    await new Promise(resolve => setTimeout(resolve, 5));
    return null;
  });
  await Promise.all([
    recalculateStatus(placeId, { minSamples: 2 }),
    recalculateStatus(placeId, { minSamples: 2 })
  ]);
  assert.deepEqual(order, ['read1', 'write', 'read2', 'write']);
});

test('expiry refresh only recalculates selected expired places', async t => {
  t.mock.method(Place, 'find', query => {
    assert.ok(query['liveStatus.validUntil'].$lte instanceof Date);
    return { select: field => {
      assert.equal(field, '_id');
      return { lean: async () => [{ _id: placeId }] };
    } };
  });
  t.mock.method(Checkin, 'find', () => ({ sort: () => ({ lean: async () => [] }) }));
  const saved = t.mock.method(Place, 'findByIdAndUpdate', async (_id, update) => {
    assert.equal(String(_id), String(placeId));
    assert.equal(update.$set.liveStatus.validUntil, null);
    return { approval: 'approved' };
  });
  await refreshExpiredStatuses({ minSamples: 2 });
  assert.equal(saved.mock.callCount(), 1);
});

test('rating includes visible reviews and resets after the last review', async t => {
  const aggregate = t.mock.method(Review, 'aggregate', async pipeline => {
    assert.equal(String(pipeline[0].$match.place), String(placeId));
    assert.equal(pipeline[0].$match.hidden, false);
    return [{ ratingAverage: 4, ratingCount: 2 }];
  });
  const writes = [];
  t.mock.method(Place, 'updateOne', async (_filter, update) => { writes.push(update.$set); });
  await updateRating(placeId);
  aggregate.mock.mockImplementation(async () => []);
  await updateRating(placeId);
  assert.deepEqual(writes, [
    { ratingAverage: 4, ratingCount: 2 },
    { ratingAverage: 0, ratingCount: 0 }
  ]);
});

test('reputation increments only for a new event and propagates unexpected errors', async t => {
  const create = t.mock.method(ReputationEvent, 'create', async () => ({}));
  const increment = t.mock.method(User, 'updateOne', async (filter, update) => {
    assert.equal(String(filter._id), String(userId));
    assert.deepEqual(update, { $inc: { reputation: 2 } });
  });
  await awardReputation(userId, placeId, 'review', '2026-11-01', 2);
  assert.equal(increment.mock.callCount(), 1);
  create.mock.mockImplementation(async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); });
  await awardReputation(userId, placeId, 'review', '2026-11-01', 2);
  assert.equal(increment.mock.callCount(), 1);
  create.mock.mockImplementation(async () => { throw new Error('database unavailable'); });
  await assert.rejects(awardReputation(userId, placeId, 'review', '2026-11-01', 2), /database unavailable/);
});
