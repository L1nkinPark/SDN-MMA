import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { io as connectSocket } from 'socket.io-client';
import SwaggerParser from '@apidevtools/swagger-parser';
import { createApp } from '../src/app.js';
import { createHttpServer } from '../src/http.js';
import { Booking, BookingSlot, Checkin, MerchantClaim, Place, Report, User, VisitProof } from '../src/models/index.js';
import { refreshExpiredStatuses } from '../src/services/statusService.js';
import { openapiSpec } from '../src/docs/spec.js';
import { seedHcmD1Places } from '../src/services/seedService.js';
import { reconcileBookingSlots } from '../src/services/bookingService.js';

let mongo;
let app;
const events = [];
const io = { to: room => ({ emit: (event, payload) => events.push({ room, event, payload }) }) };
const cfg = {
  accessSecret: 'test-access-secret-1234567890-abcdefgh',
  refreshSecret: 'test-refresh-secret-1234567890-abcdefgh',
  accessTtl: '15m', refreshDays: 30, origins: ['http://localhost:3000'],
  checkinMinutes: 120, minSamples: 2, refreshMs: 60000
};

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Place.init();
  await Report.init();
  await Booking.init();
  await BookingSlot.init();
  await MerchantClaim.init();
  await VisitProof.init();
  app = createApp(cfg, io);
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('Swagger UI and OpenAPI describe the REST endpoints', async () => {
  await SwaggerParser.validate(openapiSpec);
  const docs = await request(app).get('/api/docs/').expect(200);
  assert.match(docs.text, /StudySpot API Docs/);
  await request(app).get('/api/docs/swagger-ui-bundle.js').expect(200);
  const spec = await request(app).get('/api/openapi.json').expect(200);
  assert.equal(spec.body.openapi, '3.0.3');
  assert.ok(spec.body.paths['/api/places/{id}/checkins'].post);
  assert.ok(spec.body.paths['/api/admin/places/{id}/images'].post);
});

test('auth, moderation, nearby search, check-in, reviews, favorites and reports', async () => {
  const root = await request(app).get('/').expect(200);
  assert.equal(root.body.service, 'StudySpot API');
  await request(app).get('/api').expect(200);
  const register = async (name, email) => {
    const result = await request(app).post('/api/auth/register').send({ name, email, password: 'Password123!' }).expect(201);
    return result.body;
  };
  const alice = await register('Alice Student', 'alice@example.com');
  const bob = await register('Bob Student', 'bob@example.com');
  assert.equal(alice.user.role, 'student');
  const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: await bcrypt.hash('AdminPassword123!', 12), role: 'admin' });
  const adminLogin = await request(app).post('/api/auth/login').send({ email: admin.email, password: 'AdminPassword123!' }).expect(200);
  const adminAuth = { Authorization: `Bearer ${adminLogin.body.accessToken}` };
  const aliceAuth = { Authorization: `Bearer ${alice.accessToken}` };
  const bobAuth = { Authorization: `Bearer ${bob.accessToken}` };

  const created = await request(app).post('/api/places').set(aliceAuth).send({
    name: 'Quiet Library', address: '123 Campus Road', coordinates: [105.8, 21.0],
    amenities: { wifi: true, outlets: true }, minDrinkPrice: 20000
  }).expect(201);
  const placeId = created.body.place._id;
  assert.equal(created.body.place.approval, 'pending');
  await request(app).get(`/api/places/${placeId}`).expect(404);
  await request(app).get('/api/admin/analytics').set(aliceAuth).expect(403);
  await request(app).patch(`/api/admin/places/${placeId}`).set(adminAuth).send({ approval: 'approved' }).expect(200);
  await request(app).get(`/api/places/${placeId}`).expect(200);
  const forgedImage = await request(app).post(`/api/admin/places/${placeId}/images`)
    .set(adminAuth).attach('image', Buffer.from('<script>alert(1)</script>'), { filename: 'fake.png', contentType: 'image/png' }).expect(400);
  assert.match(forgedImage.body.error, /File content does not match/);
  assert.equal((await Place.findById(placeId)).images.length, 0);

  const nearby = await request(app).get('/api/places').query({ lat: 21, lng: 105.8, radius: 1000, wifi: true }).expect(200);
  assert.equal(nearby.body.total, 1);
  assert.equal(nearby.body.items[0]._id, placeId);
  await request(app).get('/api/places').query({ lat: 21 }).expect(400);
  const escapedSearch = await request(app).get('/api/places').query({ q: 'Quiet [Library]' }).expect(200);
  assert.equal(escapedSearch.body.total, 0);

  await request(app).post(`/api/places/${placeId}/checkins`).set(aliceAuth).send({ crowd: 'low', noise: 'quiet', coordinates: [106, 21] }).expect(403);
  const first = await request(app).post(`/api/places/${placeId}/checkins`).set(aliceAuth).send({ crowd: 'low', noise: 'quiet', coordinates: [105.8, 21] }).expect(201);
  assert.equal(first.body.liveStatus.crowd, 'unknown');
  await request(app).post(`/api/places/${placeId}/checkins`).set(aliceAuth).send({ crowd: 'high', noise: 'loud', coordinates: [105.8, 21] }).expect(429);
  const second = await request(app).post(`/api/places/${placeId}/checkins`).set(bobAuth).send({ crowd: 'high', noise: 'loud', coordinates: [105.8, 21] }).expect(201);
  assert.equal(second.body.liveStatus.crowd, 'medium');
  assert.equal(second.body.liveStatus.noise, 'moderate');
  assert.ok(events.some(e => e.room === `place:${placeId}` && e.payload.liveStatus.sampleCount === 2));

  await request(app).put(`/api/places/${placeId}/reviews/me`).set(aliceAuth).send({ rating: 5, text: 'Good place to study' }).expect(200);
  await request(app).put(`/api/places/${placeId}/reviews/me`).set(bobAuth).send({ rating: 3, text: 'Somewhat noisy today' }).expect(200);
  const reviewed = await request(app).get(`/api/places/${placeId}`).expect(200);
  assert.equal(reviewed.body.place.ratingAverage, 4);
  assert.equal(reviewed.body.place.ratingCount, 2);
  const alicePoints = (await User.findById(alice.user.id)).reputation;
  await request(app).delete(`/api/places/${placeId}/reviews/me`).set(aliceAuth).expect(204);
  await request(app).put(`/api/places/${placeId}/reviews/me`).set(aliceAuth).send({ rating: 5, text: 'Still good for studying' }).expect(200);
  assert.equal((await User.findById(alice.user.id)).reputation, alicePoints);
  const leaderboard = await request(app).get('/api/reputation/leaderboard').expect(200);
  assert.equal(leaderboard.body.items[0].reputation, alicePoints);
  const aliceReview = (await request(app).get(`/api/places/${placeId}/reviews`).expect(200)).body.items.find(r => r.user._id === alice.user.id);
  const reviewQueue = await request(app).get('/api/admin/reviews').set(adminAuth).query({ hidden: false }).expect(200);
  assert.equal(reviewQueue.body.total, 2);
  await request(app).patch(`/api/admin/reviews/${aliceReview._id}`).set(adminAuth).send({ hidden: true }).expect(200);
  await request(app).put(`/api/places/${placeId}/reviews/me`).set(aliceAuth).send({ rating: 5, text: 'Trying to unhide this' }).expect(403);
  assert.equal((await Place.findById(placeId)).ratingAverage, 3);
  await request(app).patch(`/api/admin/reviews/${aliceReview._id}`).set(adminAuth).send({ hidden: false }).expect(200);
  await request(app).put(`/api/favorites/${placeId}`).set(aliceAuth).expect(200);
  const favorites = await request(app).get('/api/favorites').set(aliceAuth).expect(200);
  assert.equal(favorites.body.items.length, 1);
  await request(app).delete(`/api/favorites/${placeId}`).set(aliceAuth).expect(204);

  const report = await request(app).post('/api/reports').set(aliceAuth).send({ placeId, reason: 'incorrect_info', detail: 'The listed Wi-Fi is unavailable today' }).expect(201);
  await request(app).post('/api/reports').set(aliceAuth).send({ placeId, reason: 'other', detail: 'Another pending report' }).expect(409);
  await request(app).patch(`/api/admin/reports/${report.body.report._id}`).set(adminAuth).send({ status: 'resolved' }).expect(200);
  const concurrent = await Promise.all([
    request(app).post('/api/reports').set(bobAuth).send({ placeId, reason: 'other', detail: 'First concurrent report' }),
    request(app).post('/api/reports').set(bobAuth).send({ placeId, reason: 'closed', detail: 'Second concurrent report' })
  ]);
  assert.deepEqual(concurrent.map(result => result.status).sort(), [201, 409]);
  await request(app).patch(`/api/admin/reports/${concurrent.find(result => result.status === 201).body.report._id}`).set(adminAuth).send({ status: 'dismissed' }).expect(200);
  const analytics = await request(app).get('/api/admin/analytics').set(adminAuth).expect(200);
  assert.equal(analytics.body.approvedPlaces, 1);
  assert.equal(analytics.body.pendingReports, 0);

  const rotated = await request(app).post('/api/auth/refresh').send({ refreshToken: alice.refreshToken }).expect(200);
  const wrongAlgorithm = jwt.sign({ sub: alice.user.id, type: 'refresh' }, cfg.refreshSecret, { algorithm: 'HS512' });
  await request(app).post('/api/auth/refresh').send({ refreshToken: wrongAlgorithm }).expect(401);
  await request(app).post('/api/auth/refresh').send({ refreshToken: alice.refreshToken }).expect(401);
  await request(app).post('/api/auth/logout').send({ refreshToken: rotated.body.refreshToken }).expect(204);
  await request(app).post('/api/auth/refresh').send({ refreshToken: rotated.body.refreshToken }).expect(401);

  await Place.updateOne({ _id: placeId }, { $set: { 'liveStatus.validUntil': new Date(Date.now() - 1000) } });
  await refreshExpiredStatuses(cfg, io);
  assert.equal((await Place.findById(placeId)).liveStatus.sampleCount, 2);
});

test('Socket.IO join sends snapshot and subsequent check-in update', async () => {
  const place = await Place.findOne({ name: 'Quiet Library' });
  const { server, io } = createHttpServer(cfg);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const socket = connectSocket(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
  try {
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    const snapshotPromise = new Promise(resolve => socket.once('place:status', resolve));
    const ack = await new Promise(resolve => socket.emit('place:join', String(place._id), resolve));
    assert.equal(ack.ok, true);
    const snapshot = await snapshotPromise;
    assert.equal(snapshot.liveStatus.sampleCount, 2);
    const charlie = await request(server).post('/api/auth/register').send({ name: 'Charlie Student', email: 'charlie@example.com', password: 'Password123!' }).expect(201);
    const nextStatus = new Promise(resolve => socket.once('place:status', resolve));
    await request(server).post(`/api/places/${place._id}/checkins`)
      .set({ Authorization: `Bearer ${charlie.body.accessToken}` })
      .send({ crowd: 'high', noise: 'loud', coordinates: [105.8, 21] }).expect(201);
    assert.equal((await nextStatus).liveStatus.sampleCount, 3);
    await request(server).get('/health').expect(200);
  } finally {
    socket.disconnect();
    await new Promise(resolve => io.close(resolve));
  }
});

test('expired check-ins reset stored crowd and noise to unknown', async () => {
  const place = await Place.findOne({ name: 'Quiet Library' });
  await Checkin.updateMany({ place: place._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await Place.updateOne({ _id: place._id }, { $set: { 'liveStatus.validUntil': new Date(Date.now() - 1000) } });
  await refreshExpiredStatuses(cfg, io);
  const updated = await Place.findById(place._id);
  assert.equal(updated.liveStatus.crowd, 'unknown');
  assert.equal(updated.liveStatus.noise, 'unknown');
  assert.equal(updated.liveStatus.sampleCount, 0);
});

test('HCM place seed is idempotent and marks unverified amenities unknown', async () => {
  const admin = await User.findOne({ email: 'admin@example.com' });
  const first = await seedHcmD1Places(admin._id);
  const second = await seedHcmD1Places(admin._id);
  assert.equal(first.filter(item => item.inserted).length, 4);
  assert.equal(second.filter(item => item.inserted).length, 0);
  const passio = await Place.findOne({ seedKey: 'hcm-d1-passio-fpt' });
  assert.equal(passio.amenities.wifi, null);
  assert.equal(passio.amenities.outlets, null);
  assert.equal(passio.minDrinkPrice, null);
  assert.equal(passio.location.coordinates[0], 106.809666);
  assert.ok(passio.source.url);
});

test('merchant claim, managed booking, verified visit, review badge and admin user controls', async () => {
  const signUp = async (name, email) => (await request(app).post('/api/auth/register')
    .send({ name, email, password: 'Password123!' }).expect(201)).body;
  const applicant = await signUp('Shop Owner', 'owner@example.com');
  const visitor = await signUp('Visitor Student', 'visitor@example.com');
  const another = await signUp('Second Student', 'second@example.com');
  const auth = token => ({ Authorization: `Bearer ${token}` });
  const adminLogin = await request(app).post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'AdminPassword123!' }).expect(200);
  const adminAuth = auth(adminLogin.body.accessToken);
  const ownerAuth = auth(applicant.accessToken);
  const visitorAuth = auth(visitor.accessToken);
  const secondAuth = auth(another.accessToken);

  const created = await request(app).post('/api/places').set(ownerAuth).send({
    name: 'Study Cafe', address: '99 Campus Road', coordinates: [105.81, 21.01]
  }).expect(201);
  const placeId = created.body.place._id;
  await request(app).patch(`/api/admin/places/${placeId}`).set(adminAuth)
    .send({ approval: 'approved' }).expect(200);
  const claim = await request(app).post('/api/merchant/claims').set(ownerAuth).send({
    placeId, businessName: 'Study Cafe Company', contactPhone: '0901234567',
    evidenceUrls: ['https://example.com/proof.jpg']
  }).expect(201);
  await request(app).post('/api/merchant/claims').set(ownerAuth).send({
    placeId, businessName: 'Study Cafe Company', contactPhone: '0901234567',
    evidenceUrls: ['https://example.com/proof.jpg']
  }).expect(409);
  await request(app).get('/api/merchant/claims/me').set(ownerAuth).expect(200);
  await request(app).get('/api/admin/merchant-claims').set(adminAuth).query({ status: 'pending' }).expect(200);
  await request(app).patch(`/api/admin/merchant-claims/${claim.body.claim._id}`).set(adminAuth)
    .send({ status: 'approved', decisionNote: 'Ownership evidence accepted' }).expect(200);
  assert.equal((await User.findById(applicant.user.id)).role, 'merchant');
  await request(app).patch(`/api/merchant/places/${placeId}`).set(visitorAuth)
    .send({ temporaryClosed: true }).expect(403);
  const hours = Array.from({ length: 7 }, (_, day) => ({ day, open: '08:00', close: '22:00' }));
  await request(app).patch(`/api/merchant/places/${placeId}`).set(ownerAuth).send({
    openingHours: hours, seatingCapacity: 20, bookingEnabled: true, capacityPerSlot: 2, slotMinutes: 60,
    wifi: true, outlets: true, minDrinkPrice: 25000
  }).expect(200);
  await request(app).get('/api/merchant/places').set(ownerAuth).expect(200);
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 2);
  day.setUTCHours(3, 0, 0, 0);
  const startsAt = day.toISOString();
  const beforeOpening = new Date(day);
  beforeOpening.setUTCHours(0, 0, 0, 0);
  await request(app).post('/api/bookings').set(visitorAuth)
    .send({ placeId, startsAt: beforeOpening.toISOString(), partySize: 1 }).expect(409);
  const first = await request(app).post('/api/bookings').set(visitorAuth)
    .send({ placeId, startsAt, partySize: 1 }).expect(201);
  const repeat = await request(app).post('/api/bookings').set(visitorAuth)
    .send({ placeId, startsAt, partySize: 1 }).expect(200);
  assert.equal(repeat.body.alreadyExists, true);
  const second = await request(app).post('/api/bookings').set(secondAuth)
    .send({ placeId, startsAt, partySize: 1 }).expect(201);
  const third = await signUp('Third Student', 'third@example.com');
  await request(app).post('/api/bookings').set(auth(third.accessToken))
    .send({ placeId, startsAt, partySize: 1 }).expect(409);
  const slot = await BookingSlot.findOne({ place: placeId, startsAt: new Date(startsAt) });
  assert.equal(slot.reserved, 2);
  const availability = await request(app).get(`/api/places/${placeId}/availability`)
    .query({ date: startsAt.slice(0, 10) }).expect(200);
  assert.equal(availability.body.slots[0].reserved, 2);
  await request(app).post(`/api/bookings/${second.body.booking._id}/cancel`).set(secondAuth).expect(200);
  assert.equal((await BookingSlot.findById(slot._id)).reserved, 1);
  await request(app).get('/api/bookings/me').set(visitorAuth).expect(200);
  await request(app).get(`/api/merchant/places/${placeId}/bookings`).set(ownerAuth).expect(200);

  const code = await request(app).post(`/api/merchant/places/${placeId}/visit-code`).set(ownerAuth).expect(200);
  const expiredCode = jwt.sign({ type: 'visit_qr', place: placeId, owner: applicant.user.id },
    cfg.accessSecret, { expiresIn: -1 });
  await request(app).post(`/api/places/${placeId}/checkins`).set(visitorAuth).send({
    crowd: 'low', noise: 'quiet', coordinates: [105.81, 21.01], accuracyMeters: 10, visitCode: expiredCode
  }).expect(403);
  await request(app).post(`/api/places/${placeId}/checkins`).set(ownerAuth).send({
    crowd: 'low', noise: 'quiet', coordinates: [105.81, 21.01]
  }).expect(403);
  await request(app).put(`/api/places/${placeId}/reviews/me`).set(ownerAuth)
    .send({ rating: 5, text: 'Owner review must be rejected' }).expect(403);
  await request(app).post(`/api/places/${placeId}/checkins`).set(visitorAuth).send({
    crowd: 'low', noise: 'quiet', coordinates: [105.81, 21.01], accuracyMeters: 60, visitCode: code.body.code
  }).expect(403);
  const checkin = await request(app).post(`/api/places/${placeId}/checkins`).set(visitorAuth).send({
    crowd: 'low', noise: 'quiet', coordinates: [105.81, 21.01], accuracyMeters: 10, visitCode: code.body.code
  }).expect(201);
  assert.equal(checkin.body.checkin.verificationLevel, 'qr_verified');
  assert.equal(await VisitProof.countDocuments({ user: visitor.user.id, place: placeId }), 1);
  const review = await request(app).put(`/api/places/${placeId}/reviews/me`).set(visitorAuth)
    .send({ rating: 5, text: 'Verified visit review' }).expect(200);
  assert.ok(review.body.review.verifiedVisit);
  const thirdBooking = await request(app).post('/api/bookings').set(auth(third.accessToken))
    .send({ placeId, startsAt, partySize: 1 }).expect(201);
  await request(app).patch(`/api/bookings/${thirdBooking.body.booking._id}/merchant-decision`)
    .set(ownerAuth).send({ action: 'arrived' }).expect(409);
  const arrivalStart = new Date(Date.now() - 5 * 60000);
  await Booking.updateOne({ _id: thirdBooking.body.booking._id },
    { $set: { startsAt: arrivalStart, endsAt: new Date(Date.now() + 55 * 60000) } });
  const arrival = await request(app).patch(`/api/bookings/${thirdBooking.body.booking._id}/merchant-decision`)
    .set(ownerAuth).send({ action: 'arrived' }).expect(200);
  assert.equal(arrival.body.booking.status, 'completed');
  const staffReview = await request(app).put(`/api/places/${placeId}/reviews/me`).set(auth(third.accessToken))
    .send({ rating: 4, text: 'Staff confirmed my arrival' }).expect(200);
  assert.ok(staffReview.body.review.verifiedVisit);

  await request(app).patch(`/api/admin/users/${visitor.user.id}`).set(adminAuth)
    .send({ status: 'suspended' }).expect(200);
  await request(app).get('/api/auth/me').set(visitorAuth).expect(403);
  await request(app).post('/api/auth/login').send({ email: 'visitor@example.com', password: 'Password123!' }).expect(403);
  await request(app).post('/api/auth/refresh').send({ refreshToken: visitor.refreshToken }).expect(401);
  await request(app).patch(`/api/admin/users/${visitor.user.id}`).set(adminAuth)
    .send({ status: 'active' }).expect(200);
  const users = await request(app).get('/api/admin/users').set(adminAuth).query({ q: 'visitor@example.com' }).expect(200);
  assert.equal(users.body.total, 1);
  const audit = await request(app).get('/api/admin/audit').set(adminAuth).expect(200);
  assert.ok(audit.body.total >= 3);
  const bookings = await request(app).get('/api/admin/bookings').set(adminAuth).expect(200);
  assert.ok(bookings.body.total >= 2);
  await request(app).post(`/api/admin/bookings/${first.body.booking._id}/cancel`).set(adminAuth)
    .send({ reason: 'Store maintenance planned' }).expect(200);
  assert.equal((await BookingSlot.findById(slot._id)).reserved, 1);
  await BookingSlot.updateOne({ _id: slot._id }, { $set: { reserved: 99 } });
  await reconcileBookingSlots();
  assert.equal((await BookingSlot.findById(slot._id)).reserved, 0);
});
