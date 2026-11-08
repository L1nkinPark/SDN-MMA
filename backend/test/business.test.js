import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { Booking, BookingSlot, BookingUserWindow, Checkin, EmailChange, EmailOutbox, FraudFlag, MerchantClaim, Notification, PasswordReset, Place, PlaceChangeRequest, Review, SupportCase, User, VisitProof } from '../src/models/index.js';
import { processBookingDeadlines } from '../src/services/bookingJobs.js';
import { localVisitTime, migrateLegacyBookingSlots, reconcileBookingUserWindows, recoverBookingReservations, reserveSlot, reserveUserWindow } from '../src/services/bookingService.js';
import { processEmailOutbox, queueEmail } from '../src/services/notificationService.js';

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
  await Promise.all([Place.init(), Booking.init(), BookingSlot.init(), BookingUserWindow.init(), MerchantClaim.init(),
    PlaceChangeRequest.init(), FraudFlag.init(), Notification.init(), EmailOutbox.init(), PasswordReset.init(), EmailChange.init(), SupportCase.init()]);
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
  await request(app).post('/api/auth/change-email').set(memberAuth)
    .send({ email: 'new-privacy@example.com', currentPassword: 'Password123!' }).expect(503);
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
  await request(app).post('/api/merchant/places').set(ownerAuth).send({
    name: 'Blocked Cafe', address: '22 Campus Road', coordinates: [105.82, 21.02],
    contactPhone: '0901234567', evidenceUrls: ['https://example.com/storefront.jpg']
  }).expect(403);
  const account = await request(app).post('/api/merchant/account-application').set(ownerAuth).send({
    businessName: 'Cafe Owner Company', contactPhone: '0901234567',
    evidenceUrls: ['https://example.com/business-proof.jpg']
  }).expect(201);
  assert.equal((await User.findById(owner.user.id)).role, 'student');
  await request(app).patch(`/api/admin/merchant-claims/${account.body.application._id}`).set(adminAuth)
    .send({ status: 'approved', decisionNote: 'Business documents checked' }).expect(200);
  assert.equal((await User.findById(owner.user.id)).role, 'merchant');
  const created = await request(app).post('/api/merchant/places').set(ownerAuth).send({
    name: 'New Study Cafe', address: '22 Campus Road', coordinates: [105.82, 21.02],
    contactPhone: '0901234567', evidenceUrls: ['https://example.com/storefront.jpg']
  }).expect(201);
  const placeId = created.body.place._id;
  assert.equal(created.body.place.approval, 'pending');
  assert.equal(created.body.place.owner, null);
  assert.equal(created.body.place.ownerApplicant, owner.user.id);
  assert.equal((await User.findById(owner.user.id)).role, 'merchant');
  const waiting = await request(app).get('/api/merchant/places').set(ownerAuth).expect(200);
  assert.ok(waiting.body.items.some(item => item._id === placeId && item.approval === 'pending'));
  await request(app).patch(`/api/merchant/places/${placeId}`).set(ownerAuth)
    .send({ bookingEnabled: true }).expect(404);
  await request(app).post(`/api/merchant/places/${placeId}/change-requests`).set(ownerAuth)
    .send({ name: 'Unapproved change' }).expect(404);
  await request(app).post(`/api/merchant/places/${placeId}/images`).set(ownerAuth).expect(400);
  await request(app).get(`/api/places/${placeId}`).expect(404);
  await request(app).post('/api/merchant/places').set(ownerAuth).send({
    name: 'New Study Cafe', address: '22 Campus Road', coordinates: [105.82, 21.02],
    contactPhone: '0901234567', evidenceUrls: ['https://example.com/storefront.jpg']
  }).expect(409);
  const queue = await request(app).get('/api/admin/places').set(adminAuth)
    .query({ approval: 'pending' }).expect(200);
  assert.equal(queue.body.items[0].onboardingEvidenceUrls.length, 1);
  assert.equal(queue.body.items[0].ownerApplicant.email, 'cafe-owner@example.com');
  const rejected = await request(app).post('/api/merchant/places').set(ownerAuth).send({
    name: 'Rejected Study Cafe', address: '88 Other Campus Road', coordinates: [105.91, 21.12],
    contactPhone: '0901234567', evidenceUrls: ['https://example.com/other-storefront.jpg']
  }).expect(201);
  await request(app).patch(`/api/admin/places/${rejected.body.place._id}`).set(adminAuth)
    .send({ approval: 'rejected', decisionNote: 'Ownership evidence not sufficient' }).expect(200);
  assert.equal((await User.findById(owner.user.id)).role, 'merchant');
  assert.equal((await Place.findById(rejected.body.place._id)).owner, null);
  await request(app).patch(`/api/admin/places/${placeId}`).set(adminAuth)
    .send({ approval: 'approved', decisionNote: 'Storefront evidence checked' }).expect(200);
  assert.equal((await User.findById(owner.user.id)).role, 'merchant');
  const approvedPlace = await Place.findById(placeId);
  assert.equal(String(approvedPlace.owner), owner.user.id);
  assert.equal(approvedPlace.ownerApplicant, null);
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
    .send({ placeId, startsAt: start.toISOString(), partySize: 1, idempotencyKey: 'guest-booking-001' }).expect(201);
  assert.equal(booked.body.booking.status, 'pending');
  assert.ok(new Date(booked.body.booking.holdUntil).getTime() <= Date.now() + 10 * 60000);
  const repeated = await request(app).post('/api/bookings').set(guestAuth)
    .send({ placeId, startsAt: start.toISOString(), partySize: 1, idempotencyKey: 'guest-booking-001' }).expect(200);
  assert.equal(repeated.body.booking._id, booked.body.booking._id);
  await request(app).post('/api/bookings').set(guestAuth)
    .send({ placeId, startsAt: start.toISOString(), partySize: 1, note: 'Changed', idempotencyKey: 'guest-booking-001' }).expect(409);
  await request(app).post('/api/bookings').set(guestAuth)
    .send({ placeId, startsAt: start.toISOString(), partySize: 1, note: 'Changed' }).expect(409);
  await request(app).post('/api/bookings').set(auth(reviewer.accessToken))
    .send({ placeId, startsAt: start.toISOString(), partySize: 1 }).expect(409);
  const bookingId = booked.body.booking._id;
  const filteredBookings = await request(app).get('/api/admin/bookings').set(adminAuth)
    .query({ q: 'New Study Cafe', date: localVisitTime(start).date, status: 'pending' }).expect(200);
  assert.ok(filteredBookings.body.items.some(item => item._id === bookingId));
  const emptyBookings = await request(app).get('/api/admin/bookings').set(adminAuth)
    .query({ q: 'No matching store', date: localVisitTime(start).date }).expect(200);
  assert.equal(emptyBookings.body.total, 0);
  await request(app).patch(`/api/bookings/${bookingId}/merchant-decision`).set(ownerAuth)
    .send({ action: 'reject' }).expect(400);
  await request(app).patch(`/api/bookings/${bookingId}/merchant-decision`).set(ownerAuth)
    .send({ action: 'approve' }).expect(200);
  assert.equal((await Booking.findById(bookingId)).status, 'confirmed');
  assert.equal(String((await Booking.findById(bookingId)).decidedBy), owner.user.id);
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
  assert.ok(flags.body.items[0].evidence.distanceMeters > 100000);
  assert.ok(flags.body.items[0].evidence.previousAt);
  await request(app).patch(`/api/admin/fraud-flags/${flags.body.items[0]._id}`).set(adminAuth)
    .send({ status: 'dismissed', reason: 'Location anomaly was explained' }).expect(200);
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
  const history = await request(app).get(`/api/admin/users/${guest.user.id}/history`).set(adminAuth).expect(200);
  assert.ok(history.body.bookings.some(item => item._id === bookingId));
  await request(app).get(`/api/admin/users/${guest.user.id}/history`).set(auth(reviewerLogin.body.accessToken)).expect(403);
  const analytics = await request(app).get('/api/admin/analytics').set(adminAuth)
    .query({ from: localVisitTime(new Date()).date, to: localVisitTime(new Date()).date }).expect(200);
  assert.ok(analytics.body.period.newBookings >= 1);
  await request(app).get('/api/admin/analytics').set(adminAuth).query({ from: '2026-11-20', to: '2026-11-01' }).expect(400);
  await request(app).get('/api/admin/audit').set(adminAuth).expect(200);
});

test('merchant signup submits an account application before merchant access', async () => {
  await request(app).post('/api/auth/register').send({ name: 'Pending Owner', email: 'pending-owner@example.com',
    password: 'Password123!', intent: 'merchant' }).expect(400);
  const signedUp = await request(app).post('/api/auth/register').send({
    name: 'Pending Owner', email: 'pending-owner@example.com', password: 'Password123!', intent: 'merchant',
    businessName: 'Pending Cafe Company', contactPhone: '0901234567',
    evidenceUrls: ['https://example.com/company-document.jpg']
  }).expect(201);
  assert.equal(signedUp.body.applicationStatus, 'pending');
  assert.equal(signedUp.body.accessToken, undefined);
  const pendingUser = await User.findOne({ email: 'pending-owner@example.com' });
  assert.equal(pendingUser.status, 'pending_merchant');
  assert.equal(pendingUser.role, 'student');
  const pending = await MerchantClaim.findOne({ applicant: pendingUser._id, kind: 'account', status: 'pending' });
  await request(app).post('/api/auth/login').send({ email: pendingUser.email, password: 'Password123!' }).expect(403);
  await request(app).post('/api/merchant/places').set(auth('invalid-token')).send({
    name: 'Pending Cafe', address: '13 Campus Road', coordinates: [105.85, 21.05],
    contactPhone: '0901234567', evidenceUrls: ['https://example.com/storefront.jpg']
  }).expect(401);
  const adminLogin = await request(app).post('/api/auth/login')
    .send({ email: 'root@example.com', password: 'AdminPassword123!' }).expect(200);
  const adminAuth = auth(adminLogin.body.accessToken);
  await request(app).patch(`/api/admin/users/${pendingUser._id}`).set(adminAuth)
    .send({ status: 'active', reason: 'Attempt to bypass merchant review' }).expect(409);
  const existingPlace = await Place.findOne({ name: 'New Study Cafe Plus' });
  await request(app).patch(`/api/admin/places/${existingPlace._id}/owner`).set(adminAuth)
    .send({ ownerId: String(pendingUser._id), reason: 'Attempt before account approval' }).expect(409);
  await request(app).patch(`/api/admin/merchant-claims/${pending._id}`).set(adminAuth)
    .send({ status: 'rejected', decisionNote: 'Document is not readable' }).expect(200);
  assert.equal((await User.findById(pendingUser._id)).status, 'active');
  assert.equal((await User.findById(pendingUser._id)).role, 'student');
  const ownerLogin = await request(app).post('/api/auth/login')
    .send({ email: pendingUser.email, password: 'Password123!' }).expect(200);
  const ownerAuth = auth(ownerLogin.body.accessToken);
  const rejected = await request(app).get('/api/merchant/account-application/me').set(ownerAuth).expect(200);
  assert.equal(rejected.body.application.status, 'rejected');
  const resubmitted = await request(app).post('/api/merchant/account-application').set(ownerAuth).send({
    businessName: 'Pending Cafe Company', contactPhone: '0901234567',
    evidenceUrls: ['https://example.com/clear-document.jpg']
  }).expect(201);
  await request(app).patch(`/api/admin/merchant-claims/${resubmitted.body.application._id}`).set(adminAuth)
    .send({ status: 'approved', decisionNote: 'Business document verified' }).expect(200);
  assert.equal((await User.findById(pendingUser._id)).role, 'merchant');
  await request(app).post('/api/merchant/account-application').set(ownerAuth).send({
    businessName: 'Pending Cafe Company', contactPhone: '0901234567',
    evidenceUrls: ['https://example.com/clear-document.jpg']
  }).expect(409);
});

test('one merchant manages multiple places and reviews require proof for each place', async () => {
  const owner = await register('Multi Shop Owner', 'multi-shop-owner@example.com');
  const visitor = await register('Multi Shop Visitor', 'multi-shop-visitor@example.com');
  const adminLogin = await request(app).post('/api/auth/login')
    .send({ email: 'root@example.com', password: 'AdminPassword123!' }).expect(200);
  const ownerAuth = auth(owner.accessToken);
  const visitorAuth = auth(visitor.accessToken);
  const adminAuth = auth(adminLogin.body.accessToken);
  const account = await request(app).post('/api/merchant/account-application').set(ownerAuth).send({
    businessName: 'Multi Shop Company', contactPhone: '0901234567',
    evidenceUrls: ['https://example.com/business-proof.jpg']
  }).expect(201);
  await request(app).patch(`/api/admin/merchant-claims/${account.body.application._id}`).set(adminAuth)
    .send({ status: 'approved', decisionNote: 'Business documents checked' }).expect(200);
  const placeIds = [];
  for (const [name, coordinates] of [
    ['East Study Cafe', [105.83, 21.03]],
    ['West Study Cafe', [105.84, 21.04]]
  ]) {
    const created = await request(app).post('/api/merchant/places').set(ownerAuth).send({
      name, address: `${name}, Campus Road`, coordinates,
      contactPhone: '0901234567', evidenceUrls: ['https://example.com/storefront.jpg']
    }).expect(201);
    const placeId = created.body.place._id;
    await request(app).patch(`/api/admin/places/${placeId}`).set(adminAuth)
      .send({ approval: 'approved', decisionNote: 'Ownership evidence checked' }).expect(200);
    placeIds.push(placeId);
  }
  const [eastId, westId] = placeIds;
  const owned = await request(app).get('/api/merchant/places').set(ownerAuth).expect(200);
  assert.deepEqual(owned.body.items.filter(item => placeIds.includes(item._id))
    .map(item => item.owner).sort(), [owner.user.id, owner.user.id]);

  const eastReview = { rating: 5, text: 'Quiet corner with outlets' };
  const westReview = { rating: 2, text: 'Too noisy for studying' };
  await request(app).put(`/api/places/${eastId}/reviews/me`).set(ownerAuth)
    .send(eastReview).expect(403);
  await request(app).put(`/api/places/${eastId}/reviews/me`).set(visitorAuth)
    .send(eastReview).expect(403);
  await VisitProof.create({ user: visitor.user.id, place: eastId, method: 'qr' });
  await request(app).put(`/api/places/${westId}/reviews/me`).set(visitorAuth)
    .send(westReview).expect(403);
  await request(app).put(`/api/places/${eastId}/reviews/me`).set(visitorAuth)
    .send(eastReview).expect(200);
  await VisitProof.create({ user: visitor.user.id, place: westId, method: 'staff_booking' });
  await request(app).put(`/api/places/${westId}/reviews/me`).set(visitorAuth)
    .send(westReview).expect(200);

  const [east, west, eastPublic, westPublic] = await Promise.all([
    Place.findById(eastId), Place.findById(westId),
    request(app).get(`/api/places/${eastId}/reviews`).expect(200),
    request(app).get(`/api/places/${westId}/reviews`).expect(200)
  ]);
  assert.equal(east.ratingAverage, 5);
  assert.equal(west.ratingAverage, 2);
  assert.equal(east.ratingCount, 1);
  assert.equal(west.ratingCount, 1);
  assert.equal(eastPublic.body.total, 1);
  assert.equal(westPublic.body.total, 1);
  assert.equal(eastPublic.body.items[0].text, eastReview.text);
  assert.equal(westPublic.body.items[0].text, westReview.text);

  const legacyUser = await register('Unverified Visitor', 'unverified-visitor@example.com');
  await Review.create({ user: legacyUser.user.id, place: eastId, rating: 1,
    text: 'Unverified legacy feedback' });
  const afterLegacy = await request(app).get(`/api/places/${eastId}/reviews`).expect(200);
  assert.equal(afterLegacy.body.total, 1);
  assert.equal((await Place.findById(eastId)).ratingCount, 1);
});

test('booking deadline worker releases pending seats and records no-show', async () => {
  const place = await Place.findOne({ name: 'New Study Cafe Plus' });
  const user = await register('Deadline Guest', 'deadline@example.com');
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 3);
  start.setUTCHours(3, 0, 0, 0);
  const booked = await request(app).post('/api/bookings').set(auth(user.accessToken))
    .send({ placeId: String(place._id), startsAt: start.toISOString(), partySize: 1 }).expect(201);
  const result = await processBookingDeadlines(cfg, new Date(new Date(booked.body.booking.holdUntil).getTime() + 1000));
  assert.ok(result.expiredPending >= 1);
  assert.equal((await Booking.findById(booked.body.booking._id)).cancellationKind, 'expired');
  const slot = await BookingSlot.findOne({ place: place._id, startsAt: start });
  assert.equal(slot.reserved, 0);
  await Place.updateOne({ _id: place._id }, { $set: { 'booking.approvalMode': 'auto' } });
  const auto = await request(app).post('/api/bookings').set(auth(user.accessToken))
    .send({ placeId: String(place._id), startsAt: start.toISOString(), partySize: 1 }).expect(201);
  const afterStart = await processBookingDeadlines(cfg, new Date(start.getTime() + 16 * 60000));
  assert.ok(afterStart.noShows >= 1);
  assert.equal((await Booking.findById(auto.body.booking._id)).status, 'no_show');
  assert.equal((await BookingSlot.findOne({ place: place._id, startsAt: start })).reserved, 0);
});

test('concurrent requests for the last seat accept only one booking and cancellation frees it', async () => {
  const first = await register('Last Seat First', 'last-seat-first@example.com');
  const second = await register('Last Seat Second', 'last-seat-second@example.com');
  const owner = await register('Last Seat Owner', 'last-seat-owner@example.com');
  const place = await Place.create({ name: 'Last Seat Cafe', address: '11 Campus Road',
    location: { type: 'Point', coordinates: [105.86, 21.06] }, submittedBy: owner.user.id,
    owner: owner.user.id, approval: 'approved', booking: { enabled: true, capacityPerSlot: 1 },
    business: { openingHours: Array.from({ length: 7 }, (_, day) => ({ day, open: '08:00', close: '22:00' })) } });
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 4);
  start.setUTCHours(3, 0, 0, 0);
  const payload = { placeId: String(place._id), startsAt: start.toISOString(), partySize: 1 };
  const attempts = await Promise.all([first, second].map(user => request(app).post('/api/bookings')
    .set(auth(user.accessToken)).send(payload)));
  assert.deepEqual(attempts.map(result => result.status).sort(), [201, 409]);
  assert.equal((await BookingSlot.findOne({ place: place._id, startsAt: start })).reserved, 1);
  assert.equal(await Booking.countDocuments({ place: place._id, startsAt: start,
    status: { $in: ['pending', 'confirmed'] } }), 1);
  const publicAvailability = await request(app).get(`/api/places/${place._id}/availability`)
    .query({ date: localVisitTime(start).date }).expect(200);
  assert.equal(publicAvailability.body.slots[0].reservations, undefined);
  const winner = attempts.findIndex(result => result.status === 201);
  await request(app).post(`/api/bookings/${attempts[winner].body.booking._id}/cancel`)
    .set(auth([first, second][winner].accessToken)).expect(200);
  assert.equal((await BookingSlot.findOne({ place: place._id, startsAt: start })).reserved, 0);
  await request(app).post('/api/bookings').set(auth([first, second][1 - winner].accessToken))
    .send(payload).expect(201);
  assert.equal((await BookingSlot.findOne({ place: place._id, startsAt: start })).reserved, 1);
});

test('one user cannot reserve overlapping times at different places, even concurrently', async () => {
  const user = await register('Overlap Guest', 'overlap-guest@example.com');
  const owner = await register('Overlap Owner', 'overlap-owner@example.com');
  const places = [];
  for (const [name, coordinates] of [['Overlap East', [105.87, 21.07]], ['Overlap West', [105.88, 21.08]]]) {
    places.push(await Place.create({ name, address: `${name} Campus Road`,
      location: { type: 'Point', coordinates }, submittedBy: owner.user.id, owner: owner.user.id,
      approval: 'approved', booking: { enabled: true, capacityPerSlot: 2,
        slotMinutes: name === 'Overlap East' ? 120 : 60 },
      business: { openingHours: Array.from({ length: 7 }, (_, day) => ({ day, open: '08:00', close: '22:00' })) } }));
  }
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 5);
  start.setUTCHours(3, 0, 0, 0);
  const firstBooking = await request(app).post('/api/bookings').set(auth(user.accessToken))
    .send({ placeId: String(places[0]._id), startsAt: start.toISOString(), partySize: 1 }).expect(201);
  await request(app).post('/api/bookings').set(auth(user.accessToken))
    .send({ placeId: String(places[1]._id), startsAt: new Date(start.getTime() + 3600000).toISOString(),
      partySize: 1 }).expect(409);
  await request(app).post(`/api/bookings/${firstBooking.body.booking._id}/cancel`)
    .set(auth(user.accessToken)).expect(200);
  const attempts = await Promise.all(places.map(place => request(app).post('/api/bookings')
    .set(auth(user.accessToken)).send({ placeId: String(place._id), startsAt: start.toISOString(), partySize: 1 })));
  assert.deepEqual(attempts.map(result => result.status).sort(), [201, 409]);
  assert.equal(await Booking.countDocuments({ user: user.user.id, status: { $in: ['pending', 'confirmed'] } }), 1);
  const winner = attempts.findIndex(result => result.status === 201);
  const otherPlace = places[1 - winner];
  await request(app).post(`/api/bookings/${attempts[winner].body.booking._id}/cancel`)
    .set(auth(user.accessToken)).expect(200);
  await request(app).post('/api/bookings').set(auth(user.accessToken))
    .send({ placeId: String(otherPlace._id), startsAt: start.toISOString(), partySize: 1 }).expect(201);
  for (const hours of [2, 4]) {
    await request(app).post('/api/bookings').set(auth(user.accessToken))
      .send({ placeId: String(places[1]._id), startsAt: new Date(start.getTime() + hours * 3600000).toISOString(),
        partySize: 1 }).expect(201);
  }
  await request(app).post('/api/bookings').set(auth(user.accessToken))
    .send({ placeId: String(places[1]._id), startsAt: new Date(start.getTime() + 6 * 3600000).toISOString(),
      partySize: 1 }).expect(409);
  assert.equal(await Booking.countDocuments({ user: user.user.id, status: { $in: ['pending', 'confirmed'] } }), 3);
  const concurrentUser = await register('Three Bookings Guest', 'three-bookings@example.com');
  const four = await Promise.all([0, 2, 4, 6].map(hours => request(app).post('/api/bookings')
    .set(auth(concurrentUser.accessToken)).send({ placeId: String(places[0]._id),
      startsAt: new Date(start.getTime() + hours * 3600000).toISOString(), partySize: 1 })));
  assert.deepEqual(four.map(result => result.status).sort(), [201, 201, 201, 409]);
});

test('recovery releases an unfinished booking and an orphaned seat while API stays online', async () => {
  const user = await register('Recovery Guest', 'recovery-guest@example.com');
  const owner = await register('Recovery Owner', 'recovery-owner@example.com');
  const place = await Place.create({ name: 'Recovery Cafe', address: '12 Campus Road',
    location: { type: 'Point', coordinates: [105.89, 21.09] }, submittedBy: owner.user.id,
    owner: owner.user.id, approval: 'approved', booking: { enabled: true, capacityPerSlot: 1 },
    business: { openingHours: Array.from({ length: 7 }, (_, day) => ({ day, open: '08:00', close: '22:00' })) } });
  const startsAt = new Date();
  startsAt.setUTCDate(startsAt.getUTCDate() + 6);
  startsAt.setUTCHours(3, 0, 0, 0);
  const booking = await Booking.create({ user: user.user.id, place: place._id, startsAt,
    endsAt: new Date(startsAt.getTime() + 3600000), partySize: 1, status: 'reserving' });
  await reserveUserWindow(booking);
  await reserveSlot(place, booking);
  await recoverBookingReservations(new Date(Date.now() + 3 * 60000));
  assert.equal(await Booking.findById(booking._id), null);
  assert.equal((await BookingSlot.findOne({ place: place._id, startsAt })).reserved, 0);
  assert.equal((await BookingUserWindow.findOne({ user: user.user.id })).reservations.length, 0);
  const orphan = await Booking.create({ user: user.user.id, place: place._id, startsAt,
    endsAt: new Date(startsAt.getTime() + 3600000), partySize: 1, status: 'reserving' });
  await reserveUserWindow(orphan);
  await reserveSlot(place, orphan);
  await Booking.deleteOne({ _id: orphan._id });
  await recoverBookingReservations();
  assert.equal((await BookingSlot.findOne({ place: place._id, startsAt })).reserved, 0);
  assert.equal((await BookingUserWindow.findOne({ user: user.user.id })).reservations.length, 0);
  const recoveredBooking = await request(app).post('/api/bookings').set(auth(user.accessToken))
    .send({ placeId: String(place._id), startsAt: startsAt.toISOString(), partySize: 1 }).expect(201);
  await BookingSlot.collection.updateOne({ place: place._id, startsAt },
    { $unset: { reservations: '' }, $set: { reserved: 99 } });
  await migrateLegacyBookingSlots();
  const migrated = await BookingSlot.findOne({ place: place._id, startsAt });
  assert.equal(migrated.reserved, 1);
  assert.equal(String(migrated.reservations[0].booking), recoveredBooking.body.booking._id);
  await BookingUserWindow.deleteOne({ user: user.user.id });
  await reconcileBookingUserWindows();
  assert.equal((await BookingUserWindow.findOne({ user: user.user.id })).reservations.length, 1);
  await request(app).post(`/api/bookings/${recoveredBooking.body.booking._id}/cancel`)
    .set(auth(user.accessToken)).expect(200);
  assert.equal((await BookingSlot.findOne({ place: place._id, startsAt })).reserved, 0);
  const interruptedRelease = await request(app).post('/api/bookings').set(auth(user.accessToken))
    .send({ placeId: String(place._id), startsAt: startsAt.toISOString(), partySize: 1 }).expect(201);
  await Booking.updateOne({ _id: interruptedRelease.body.booking._id }, { $set: { status: 'cancelled' } });
  await recoverBookingReservations();
  assert.equal((await BookingSlot.findOne({ place: place._id, startsAt })).reserved, 0);
  assert.equal((await BookingUserWindow.findOne({ user: user.user.id })).reservations.length, 0);
  const visitingStart = new Date(Date.now() - 10 * 60000);
  const visiting = await Booking.create({ user: user.user.id, place: place._id, startsAt: visitingStart,
    endsAt: new Date(visitingStart.getTime() + 3600000), partySize: 1, status: 'completed' });
  await reserveUserWindow(visiting);
  await recoverBookingReservations();
  assert.equal((await BookingUserWindow.findOne({ user: user.user.id })).reservations.length, 1);
  await recoverBookingReservations(new Date(Date.now() + 2 * 3600000));
  assert.equal((await BookingUserWindow.findOne({ user: user.user.id })).reservations.length, 0);
});

test('merchant closing dates cannot invalidate existing bookings and block new bookings', async () => {
  const owner = await register('Calendar Owner', 'calendar-owner@example.com');
  const guest = await register('Calendar Guest', 'calendar-guest@example.com');
  await User.updateOne({ _id: owner.user.id }, { $set: { role: 'merchant' } });
  const place = await Place.create({ name: 'Calendar Cafe', address: '10 Campus Road',
    location: { type: 'Point', coordinates: [105.81, 21.01] }, submittedBy: owner.user.id,
    owner: owner.user.id, approval: 'approved', booking: { enabled: true, capacityPerSlot: 4 },
    business: { openingHours: Array.from({ length: 7 }, (_, day) => ({ day, open: '08:00', close: '22:00' })) } });
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 2);
  start.setUTCHours(3, 0, 0, 0);
  const date = localVisitTime(start).date;
  await request(app).patch(`/api/merchant/places/${place._id}`).set(auth(owner.accessToken))
    .send({ seatingCapacity: 2 }).expect(400);
  await request(app).patch(`/api/merchant/places/${place._id}`).set(auth(owner.accessToken))
    .send({ seatingCapacity: 4 }).expect(200);
  const booked = await request(app).post('/api/bookings').set(auth(guest.accessToken))
    .send({ placeId: String(place._id), startsAt: start.toISOString(), partySize: 1 }).expect(201);
  const adminLogin = await request(app).post('/api/auth/login')
    .send({ email: 'root@example.com', password: 'AdminPassword123!' }).expect(200);
  await request(app).patch(`/api/admin/places/${place._id}`).set(auth(adminLogin.body.accessToken))
    .send({ approval: 'rejected', decisionNote: 'Store is closed for review' }).expect(409);
  await request(app).patch(`/api/merchant/places/${place._id}`).set(auth(owner.accessToken))
    .send({ closedDates: [date] }).expect(409);
  await request(app).patch(`/api/merchant/places/${place._id}`).set(auth(owner.accessToken))
    .send({ temporaryClosed: true }).expect(409);
  await request(app).patch(`/api/merchant/places/${place._id}`).set(auth(owner.accessToken))
    .send({ openingHours: [] }).expect(409);
  await request(app).patch(`/api/merchant/places/${place._id}`).set(auth(owner.accessToken))
    .send({ capacityPerSlot: 1 }).expect(409);
  await request(app).post(`/api/bookings/${booked.body.booking._id}/cancel`).set(auth(guest.accessToken)).expect(200);
  await request(app).patch(`/api/merchant/places/${place._id}`).set(auth(owner.accessToken))
    .send({ closedDates: [date] }).expect(200);
  const availability = await request(app).get(`/api/places/${place._id}/availability`).query({ date }).expect(200);
  assert.equal(availability.body.closedOnDate, true);
  assert.equal(availability.body.enabled, false);
  await request(app).post('/api/bookings').set(auth(guest.accessToken))
    .send({ placeId: String(place._id), startsAt: start.toISOString(), partySize: 1 }).expect(409);
});

test('review appeal and no-show dispute require ownership and admin decision', async () => {
  const user = await register('Case Guest', 'case-guest@example.com');
  const userAuth = auth(user.accessToken);
  const place = await Place.findOne({ name: 'New Study Cafe Plus' });
  const review = await Review.create({ user: user.user.id, place: place._id, rating: 4,
    text: 'Quiet study space', hidden: true, moderationNote: 'Needs review' });
  const startsAt = new Date(Date.now() - 2 * 3600000);
  const booking = await Booking.create({ user: user.user.id, place: place._id, startsAt,
    endsAt: new Date(startsAt.getTime() + 3600000), partySize: 1, status: 'no_show', noShowAt: new Date() });
  const reason = 'I was at the place and have a receipt to prove it.';
  await request(app).post('/api/cases').set(userAuth)
    .send({ kind: 'review_appeal', targetId: String(booking._id), reason }).expect(409);
  const appeal = await request(app).post('/api/cases').set(userAuth)
    .send({ kind: 'review_appeal', targetId: String(review._id), reason }).expect(201);
  await request(app).post('/api/cases').set(userAuth)
    .send({ kind: 'review_appeal', targetId: String(review._id), reason }).expect(409);
  const dispute = await request(app).post('/api/cases').set(userAuth)
    .send({ kind: 'booking_dispute', targetId: String(booking._id), reason }).expect(201);
  const mine = await request(app).get('/api/cases/me').set(userAuth).expect(200);
  assert.equal(mine.body.total, 2);
  const login = await request(app).post('/api/auth/login')
    .send({ email: 'root@example.com', password: 'AdminPassword123!' }).expect(200);
  const adminAuth = auth(login.body.accessToken);
  await request(app).get('/api/admin/review-appeals').set(userAuth).expect(403);
  const queue = await request(app).get('/api/admin/review-appeals').set(adminAuth).expect(200);
  assert.equal(queue.body.total, 1);
  const decisionNote = 'Receipt and visit log were checked by the moderator.';
  await request(app).patch(`/api/admin/review-appeals/${appeal.body.case._id}`).set(adminAuth)
    .send({ status: 'accepted', decisionNote }).expect(200);
  assert.equal((await Review.findById(review._id)).hidden, false);
  await request(app).patch(`/api/admin/booking-disputes/${dispute.body.case._id}`).set(adminAuth)
    .send({ status: 'accepted', decisionNote }).expect(200);
  assert.equal((await Booking.findById(booking._id)).status, 'completed');
  assert.equal((await VisitProof.findOne({ booking: booking._id })).method, 'admin_dispute');
  await request(app).patch(`/api/admin/booking-disputes/${dispute.body.case._id}`).set(adminAuth)
    .send({ status: 'accepted', decisionNote }).expect(409);
});

test('email outbox retries and password reset token is delivered once', async () => {
  const emailCfg = { ...cfg, smtp: { host: 'smtp.example.test', from: 'StudySpot <noreply@example.test>' } };
  const created = await queueEmail(emailCfg, { to: 'retry@example.test', subject: 'Retry', text: 'Hello' });
  const now = new Date();
  const first = await processEmailOutbox(emailCfg, now, async () => { throw new Error('temporary SMTP failure'); });
  assert.equal(first.retried, 1);
  assert.equal((await EmailOutbox.findById(created._id)).status, 'pending');
  const delivered = [];
  const second = await processEmailOutbox(emailCfg, new Date(now.getTime() + 61000), async (_cfg, mail) => delivered.push(mail));
  assert.equal(second.sent, 1);
  assert.equal(delivered[0].to, 'retry@example.test');
  assert.equal((await EmailOutbox.findById(created._id)).text, '');
  const failing = await EmailOutbox.create({ to: 'failed@example.test', subject: 'Failed delivery', text: 'Message',
    attempts: 4, nextAttemptAt: new Date(Date.now() - 1000) });
  const failedRun = await processEmailOutbox(emailCfg, new Date(), async () => { throw new Error('SMTP down'); });
  assert.equal(failedRun.failed, 1);
  assert.equal((await EmailOutbox.findById(failing._id)).status, 'failed');
  assert.ok(await Notification.exists({ kind: 'email_delivery_failed' }));

  const user = await register('Reset Guest', 'reset-guest@example.com');
  const smtpApp = createApp(emailCfg, io);
  await request(smtpApp).post('/api/auth/forgot-password').send({ email: 'reset-guest@example.com' }).expect(202);
  const resetMail = await EmailOutbox.findOne({ to: 'reset-guest@example.com' });
  const token = resetMail.text.match(/mật khẩu của bạn: ([a-f0-9]+)/)?.[1];
  assert.ok(token);
  await request(smtpApp).post('/api/auth/reset-password').send({ token, newPassword: 'NewPassword123!' }).expect(204);
  await request(smtpApp).post('/api/auth/reset-password').send({ token, newPassword: 'OtherPassword123!' }).expect(400);
  await request(smtpApp).get('/api/auth/me').set(auth(user.accessToken)).expect(401);
  const resetLogin = await request(smtpApp).post('/api/auth/login')
    .send({ email: 'reset-guest@example.com', password: 'NewPassword123!' }).expect(200);
  await request(smtpApp).post('/api/auth/change-email').set(auth(resetLogin.body.accessToken))
    .send({ email: 'new-reset-guest@example.com', currentPassword: 'bad-password' }).expect(403);
  await request(smtpApp).post('/api/auth/change-email').set(auth(resetLogin.body.accessToken))
    .send({ email: 'new-reset-guest@example.com', currentPassword: 'NewPassword123!' }).expect(202);
  const confirmMail = await EmailOutbox.findOne({ to: 'new-reset-guest@example.com', subject: '[StudySpot] Xác nhận email mới' });
  const confirmToken = confirmMail.text.match(/email mới của bạn: ([a-f0-9]+)/)?.[1];
  assert.ok(confirmToken);
  await request(smtpApp).post('/api/auth/confirm-email').send({ token: confirmToken }).expect(204);
  await request(smtpApp).post('/api/auth/confirm-email').send({ token: confirmToken }).expect(400);
  await request(smtpApp).get('/api/auth/me').set(auth(resetLogin.body.accessToken)).expect(401);
  await request(smtpApp).post('/api/auth/login')
    .send({ email: 'reset-guest@example.com', password: 'NewPassword123!' }).expect(401);
  await request(smtpApp).post('/api/auth/login')
    .send({ email: 'new-reset-guest@example.com', password: 'NewPassword123!' }).expect(200);
});
