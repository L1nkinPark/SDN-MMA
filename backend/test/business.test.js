import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { Booking, BookingSlot, Checkin, FraudFlag, MerchantClaim, Notification, Place, PlaceChangeRequest, User } from '../src/models/index.js';
import { processBookingDeadlines } from '../src/services/bookingJobs.js';

const cfg = {
  accessSecret: 'test-business-access-secret-1234567890',
  refreshSecret: 'test-business-refresh-secret-1234567890',
  accessTtl: '15m', refreshDays: 30, origins: ['http://localhost:3000'],
  checkinMinutes: 120, minSamples: 2, refreshMs: 60000, smtp: null
};
const io = { to: () => ({ emit: () => {} }) };
let mongo;
let app;
const auth = token => ({ Authorization: `Bearer ${token}` });
const register = async (name, email) => (await request(app).post('/api/auth/register')
  .send({ name, email, password: 'Password123!' }).expect(201)).body;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([Place.init(), Booking.init(), BookingSlot.init(), MerchantClaim.init(),
    PlaceChangeRequest.init(), FraudFlag.init(), Notification.init()]);
  app = createApp(cfg, io);
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('profile, password revocation, notifications and privacy export/delete', async () => {
  const member = await register('Privacy Student', 'privacy@example.com');
  const memberAuth = auth(member.accessToken);
  const profile = await request(app).patch('/api/auth/me').set(memberAuth)
    .send({ name: 'Updated Student', notificationSettings: { email: false } }).expect(200);
  assert.equal(profile.body.user.name, 'Updated Student');
  assert.equal(profile.body.user.notificationSettings.email, false);
  await request(app).post('/api/auth/forgot-password').send({ email: 'privacy@example.com' }).expect(503);
  await request(app).post('/api/auth/change-password').set(memberAuth)
    .send({ currentPassword: 'WrongPassword!', newPassword: 'AnotherPassword123!' }).expect(403);
  await request(app).post('/api/auth/change-password').set(memberAuth)
    .send({ currentPassword: 'Password123!', newPassword: 'AnotherPassword123!' }).expect(204);
  await request(app).get('/api/auth/me').set(memberAuth).expect(401);
  await request(app).post('/api/auth/refresh').send({ refreshToken: member.refreshToken }).expect(401);
  await request(app).post('/api/auth/login')
    .send({ email: 'privacy@example.com', password: 'Password123!' }).expect(401);
  const login = await request(app).post('/api/auth/login')
    .send({ email: 'privacy@example.com', password: 'AnotherPassword123!' }).expect(200);
  const currentAuth = auth(login.body.accessToken);
  const exportResult = await request(app).get('/api/auth/me/export').set(currentAuth).expect(200);
  assert.equal(exportResult.body.user.email, 'privacy@example.com');
  assert.equal(exportResult.headers['cache-control'], 'no-store');
  await request(app).delete('/api/auth/me').set(currentAuth).send({ password: 'WrongPassword!' }).expect(403);
  await request(app).delete('/api/auth/me').set(currentAuth).send({ password: 'AnotherPassword123!' }).expect(204);
  const deleted = await User.findById(member.user.id);
  assert.equal(deleted.status, 'deleted');
  assert.match(deleted.email, /@studyspot\.invalid$/);
  await request(app).post('/api/auth/login')
    .send({ email: 'privacy@example.com', password: 'AnotherPassword123!' }).expect(401);
});

test('new merchant place, moderated change, manual booking, notifications and fraud queue', async () => {
  const owner = await register('Cafe Owner', 'cafe-owner@example.com');
  const guest = await register('Cafe Guest', 'cafe-guest@example.com');
  const reviewer = await register('Staff Reviewer', 'staff-reviewer@example.com');
  const admin = await User.create({ name: 'Root Admin', email: 'root@example.com',
    passwordHash: await bcrypt.hash('AdminPassword123!', 12), role: 'admin' });
  const adminLogin = await request(app).post('/api/auth/login')
    .send({ email: admin.email, password: 'AdminPassword123!' }).expect(200);
  const adminAuth = auth(adminLogin.body.accessToken);
  const ownerAuth = auth(owner.accessToken);
  const guestAuth = auth(guest.accessToken);
  const created = await request(app).post('/api/merchant/places').set(ownerAuth).send({
    name: 'New Study Cafe', address: '22 Campus Road', coordinates: [105.82, 21.02],
    contactPhone: '0901234567', evidenceUrls: ['https://example.com/storefront.jpg']
  }).expect(201);
  const placeId = created.body.place._id;
  assert.equal(created.body.place.approval, 'pending');
  await request(app).get(`/api/places/${placeId}`).expect(404);
  await request(app).post('/api/merchant/places').set(ownerAuth).send({
    name: 'New Study Cafe', address: '22 Campus Road', coordinates: [105.82, 21.02],
    contactPhone: '0901234567', evidenceUrls: ['https://example.com/storefront.jpg']
  }).expect(409);
  const queue = await request(app).get('/api/admin/places').set(adminAuth)
    .query({ approval: 'pending' }).expect(200);
  assert.equal(queue.body.items[0].onboardingEvidenceUrls.length, 1);
  await request(app).patch(`/api/admin/places/${placeId}`).set(adminAuth)
    .send({ approval: 'approved' }).expect(200);
  assert.equal((await User.findById(owner.user.id)).role, 'merchant');
  const change = await request(app).post(`/api/merchant/places/${placeId}/change-requests`).set(ownerAuth)
    .send({ name: 'New Study Cafe Plus' }).expect(201);
  await request(app).patch(`/api/admin/place-changes/${change.body.change._id}`).set(adminAuth)
    .send({ status: 'approved', decisionNote: 'Signage verified at shop' }).expect(200);
  assert.equal((await Place.findById(placeId)).name, 'New Study Cafe Plus');
  const hours = Array.from({ length: 7 }, (_, day) => ({ day, open: '08:00', close: '22:00' }));
  await request(app).patch(`/api/merchant/places/${placeId}`).set(ownerAuth).send({
    openingHours: hours, bookingEnabled: true, approvalMode: 'manual', capacityPerSlot: 1
  }).expect(200);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 2);
  start.setUTCHours(3, 0, 0, 0);
  const booked = await request(app).post('/api/bookings').set(guestAuth)
    .send({ placeId, startsAt: start.toISOString(), partySize: 1 }).expect(201);
  assert.equal(booked.body.booking.status, 'pending');
  await request(app).post('/api/bookings').set(auth(reviewer.accessToken))
    .send({ placeId, startsAt: start.toISOString(), partySize: 1 }).expect(409);
  const bookingId = booked.body.booking._id;
  await request(app).patch(`/api/bookings/${bookingId}/merchant-decision`).set(ownerAuth)
    .send({ action: 'approve' }).expect(200);
  assert.equal((await Booking.findById(bookingId)).status, 'confirmed');
  const notifications = await request(app).get('/api/notifications').set(guestAuth).expect(200);
  assert.ok(notifications.body.unreadCount >= 2);
  const firstNotification = notifications.body.items[0]._id;
  await request(app).patch(`/api/notifications/${firstNotification}/read`).set(guestAuth).expect(200);
  await request(app).post('/api/notifications/read-all').set(guestAuth).expect(200);
  const afterRead = await request(app).get('/api/notifications').set(guestAuth).expect(200);
  assert.equal(afterRead.body.unreadCount, 0);
  const farPlace = await request(app).post('/api/places').set(adminAuth).send({
    name: 'Far Study Hall', address: '200 Far Road', coordinates: [106.82, 21.02]
  }).expect(201);
  await request(app).post(`/api/places/${placeId}/checkins`).set(guestAuth).send({
    crowd: 'low', noise: 'quiet', coordinates: [105.82, 21.02]
  }).expect(201);
  const suspicious = await request(app).post(`/api/places/${farPlace.body.place._id}/checkins`).set(guestAuth).send({
    crowd: 'high', noise: 'loud', coordinates: [106.82, 21.02]
  }).expect(201);
  assert.equal(suspicious.body.checkin.flagged, true);
  const pointsBeforeDismissal = (await User.findById(guest.user.id)).reputation;
  const flags = await request(app).get('/api/admin/fraud-flags').set(adminAuth).expect(200);
  assert.equal(flags.body.total, 1);
  await request(app).patch(`/api/admin/fraud-flags/${flags.body.items[0]._id}`).set(adminAuth)
    .send({ status: 'dismissed' }).expect(200);
  assert.equal((await FraudFlag.findById(flags.body.items[0]._id)).status, 'dismissed');
  assert.equal((await Checkin.findById(suspicious.body.checkin._id)).flagged, false);
  assert.equal((await User.findById(guest.user.id)).reputation, pointsBeforeDismissal + 1);
  const limited = await request(app).post('/api/admin/admins').set(adminAuth)
    .send({ userId: reviewer.user.id, permissions: ['places'] }).expect(200);
  assert.deepEqual(limited.body.user.adminPermissions, ['places']);
  const reviewerLogin = await request(app).post('/api/auth/login')
    .send({ email: 'staff-reviewer@example.com', password: 'Password123!' }).expect(200);
  await request(app).get('/api/admin/places').set(auth(reviewerLogin.body.accessToken)).expect(200);
  await request(app).get('/api/admin/users').set(auth(reviewerLogin.body.accessToken)).expect(403);
  await request(app).get('/api/admin/audit').set(adminAuth).expect(200);
});

test('booking deadline worker releases pending seats and records no-show', async () => {
  const place = await Place.findOne({ name: 'New Study Cafe Plus' });
  const user = await register('Deadline Guest', 'deadline@example.com');
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 3);
  start.setUTCHours(3, 0, 0, 0);
  const booked = await request(app).post('/api/bookings').set(auth(user.accessToken))
    .send({ placeId: String(place._id), startsAt: start.toISOString(), partySize: 1 }).expect(201);
  const result = await processBookingDeadlines(cfg, new Date(start.getTime() - 30 * 60000));
  assert.equal(result.expiredPending, 1);
  assert.equal((await Booking.findById(booked.body.booking._id)).status, 'cancelled');
  const slot = await BookingSlot.findOne({ place: place._id, startsAt: start });
  assert.equal(slot.reserved, 0);
  await Place.updateOne({ _id: place._id }, { $set: { 'booking.approvalMode': 'auto' } });
  const auto = await request(app).post('/api/bookings').set(auth(user.accessToken))
    .send({ placeId: String(place._id), startsAt: start.toISOString(), partySize: 1 }).expect(201);
  const afterStart = await processBookingDeadlines(cfg, new Date(start.getTime() + 16 * 60000));
  assert.equal(afterStart.noShows, 1);
  assert.equal((await Booking.findById(auto.body.booking._id)).status, 'no_show');
});
