import { z } from 'zod';
import { AuditEvent, Booking, Checkin, EmailOutbox, FraudFlag, MerchantClaim, Place, PlaceChangeRequest, RefreshToken, Report, Review, SupportCase, User, VisitProof } from '../models/index.js';
import { HttpError, assertId, coordinates, escapeRegex, pageQuery, parse } from '../utils/common.js';
import { updateRating } from '../services/ratingService.js';
import { uploadPlaceImage } from '../services/imageService.js';
import { localVisitTime, releaseSlot } from '../services/bookingService.js';
import { notifyUser } from '../services/notificationService.js';
import { recalculateStatus } from '../services/statusService.js';
import { awardReputation } from '../services/reputationService.js';
import { linkReviewToVisit } from '../services/visitReviewService.js';

export const adminController = {
  promoteAdmin: async (req, res) => {
    const { userId, permissions } = parse(z.object({ userId: z.string(),
      permissions: z.array(z.enum(['*', 'users', 'places', 'moderation', 'bookings', 'fraud', 'audit', 'analytics'])).min(1) }), req.body);
    const id = assertId(userId);
    const user = await User.findOneAndUpdate({ _id: id, status: 'active', role: { $ne: 'admin' } },
      { $set: { role: 'admin', adminPermissions: [...new Set(permissions)] }, $inc: { tokenVersion: 1 } }, { new: true });
    if (!user) throw new HttpError(409, 'Eligible user not found');
    await RefreshToken.updateMany({ user: id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await AuditEvent.create({ actor: req.user._id, action: 'admin.promote', targetType: 'User', targetId: id,
      detail: permissions.join(',') });
    res.json({ user: { id, email: user.email, role: user.role, adminPermissions: user.adminPermissions } });
  },
  updateAdminPermissions: async (req, res) => {
    const id = assertId(req.params.id);
    if (String(req.user._id) === id) throw new HttpError(403, 'Cannot change own admin permissions');
    const { permissions } = parse(z.object({ permissions: z.array(z.enum([
      '*', 'users', 'places', 'moderation', 'bookings', 'fraud', 'audit', 'analytics'
    ])).min(1) }), req.body);
    const user = await User.findOneAndUpdate({ _id: id, role: 'admin' },
      { $set: { adminPermissions: [...new Set(permissions)] } }, { new: true });
    if (!user) throw new HttpError(404, 'Admin not found');
    await AuditEvent.create({ actor: req.user._id, action: 'admin.permissions', targetType: 'User', targetId: id,
      detail: permissions.join(',') });
    res.json({ user: { id, email: user.email, role: user.role, adminPermissions: user.adminPermissions } });
  },
  demoteAdmin: async (req, res) => {
    const id = assertId(req.params.id);
    if (String(req.user._id) === id) throw new HttpError(403, 'Cannot remove own admin role');
    const user = await User.findOneAndUpdate({ _id: id, role: 'admin' },
      { $set: { role: 'student', adminPermissions: [] }, $inc: { tokenVersion: 1 } }, { new: true });
    if (!user) throw new HttpError(404, 'Admin not found');
    await RefreshToken.updateMany({ user: id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await AuditEvent.create({ actor: req.user._id, action: 'admin.demote', targetType: 'User', targetId: id });
    res.json({ user: { id, email: user.email, role: user.role } });
  },
  listUsers: async (req, res) => {
    const { page, limit, role, status, q } = parse(pageQuery.extend({
      role: z.enum(['student', 'merchant', 'admin']).optional(),
      status: z.enum(['active', 'suspended', 'deleted']).optional(), q: z.string().trim().max(100).optional()
    }), req.query);
    const query = { ...(role ? { role } : {}), ...(status ? { status } : {}),
      ...(q ? { email: { $regex: escapeRegex(q), $options: 'i' } } : {}) };
    const [items, total] = await Promise.all([
      User.find(query).select('name email role status reputation adminPermissions createdAt updatedAt')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), User.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  userHistory: async (req, res) => {
    const id = assertId(req.params.id);
    const user = await User.findById(id).select('name email role status reputation createdAt updatedAt').lean();
    if (!user) throw new HttpError(404, 'User not found');
    const [bookings, checkins, reviews, reports, visits, flags, audit, cases] = await Promise.all([
      Booking.find({ user: id }).populate('place', 'name').sort({ createdAt: -1 }).limit(30).lean(),
      Checkin.find({ user: id }).populate('place', 'name').sort({ createdAt: -1 }).limit(30).lean(),
      Review.find({ user: id }).populate('place', 'name').sort({ createdAt: -1 }).limit(30).lean(),
      Report.find({ user: id }).populate('place', 'name').sort({ createdAt: -1 }).limit(30).lean(),
      VisitProof.find({ user: id }).populate('place', 'name').sort({ createdAt: -1 }).limit(30).lean(),
      FraudFlag.find({ user: id }).populate('place', 'name').sort({ createdAt: -1 }).limit(30).lean(),
      AuditEvent.find({ targetType: 'User', targetId: id }).populate('actor', 'name email').sort({ createdAt: -1 }).limit(30).lean(),
      SupportCase.find({ user: id }).sort({ createdAt: -1 }).limit(30).lean()
    ]);
    res.set('Cache-Control', 'no-store').json({ user, bookings, checkins, reviews, reports, visits, flags, audit, cases });
  },
  updateUser: async (req, res) => {
    const id = assertId(req.params.id);
    const { status, reason } = parse(z.object({ status: z.enum(['active', 'suspended']),
      reason: z.string().trim().min(5).max(500) }), req.body);
    if (String(req.user._id) === id) throw new HttpError(403, 'Cannot change own status');
    const user = await User.findOneAndUpdate({ _id: id, role: { $ne: 'admin' }, status: { $ne: status } },
      { $set: { status }, ...(status === 'suspended' ? { $inc: { tokenVersion: 1 } } : {}) }, { new: true });
    if (!user) throw new HttpError(409, 'User not found or status already set');
    if (status === 'suspended') await RefreshToken.updateMany({ user: id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await AuditEvent.create({ actor: req.user._id, action: `user.${status}`, targetType: 'User', targetId: user._id, detail: reason || null });
    if (status === 'active') await notifyUser(req.app.locals.cfg, user._id, {
      kind: 'account_restored', title: 'Tài khoản đã được mở lại', body: 'Bạn có thể sử dụng StudySpot bình thường.'
    }).catch(console.error);
    res.json({ user: { id: String(user._id), name: user.name, email: user.email, role: user.role, status: user.status } });
  },
  listClaims: async (req, res) => {
    const { page, limit, status } = parse(pageQuery.extend({
      status: z.enum(['pending', 'approved', 'rejected']).optional()
    }), req.query);
    const query = status ? { status } : {};
    const [items, total] = await Promise.all([
      MerchantClaim.find(query).populate('applicant', 'name email').populate('place', 'name address owner')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      MerchantClaim.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  decideClaim: async (req, res) => {
    const id = assertId(req.params.id);
    const { status, decisionNote } = parse(z.object({ status: z.enum(['approved', 'rejected']),
      decisionNote: z.string().trim().min(5).max(1000) }), req.body);
    const claim = await MerchantClaim.findOne({ _id: id, status: 'pending' });
    if (!claim) throw new HttpError(409, 'Pending claim not found');
    if (status === 'approved') {
      const place = await Place.findOneAndUpdate({ _id: claim.place, owner: null, approval: 'approved' },
        { $set: { owner: claim.applicant, 'business.phone': claim.contactPhone } }, { new: true });
      if (!place) throw new HttpError(409, 'Place already owned or unavailable');
    }
    const decided = await MerchantClaim.findOneAndUpdate({ _id: id, status: 'pending' },
      { $set: { status, decisionNote, decidedBy: req.user._id, decidedAt: new Date() } }, { new: true });
    if (!decided) {
      if (status === 'approved') await Place.updateOne({ _id: claim.place, owner: claim.applicant }, { $set: { owner: null } });
      throw new HttpError(409, 'Claim already decided');
    }
    if (status === 'approved') {
      await User.updateOne({ _id: claim.applicant, role: 'student' }, { $set: { role: 'merchant' } });
      await MerchantClaim.updateMany({ place: claim.place, _id: { $ne: id }, status: 'pending' },
        { $set: { status: 'rejected', decisionNote: 'Another claim was approved', decidedBy: req.user._id, decidedAt: new Date() } });
    }
    await AuditEvent.create({ actor: req.user._id, action: `claim.${status}`,
      targetType: 'MerchantClaim', targetId: decided._id, detail: decisionNote });
    await notifyUser(req.app.locals.cfg, decided.applicant, { kind: `merchant_claim_${status}`,
      title: status === 'approved' ? 'Đã duyệt quyền chủ quán' : 'Hồ sơ chủ quán chưa được duyệt',
      body: decisionNote, resourceType: 'MerchantClaim', resourceId: decided._id }).catch(console.error);
    res.json({ claim: decided });
  },
  listBookings: async (req, res) => {
    const { page, limit, status, placeId, q, date } = parse(pageQuery.extend({
      status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
      placeId: z.string().optional(), q: z.string().trim().max(100).optional(), date: z.iso.date().optional()
    }), req.query);
    const query = { ...(status ? { status } : {}) };
    if (placeId) query.place = assertId(placeId);
    if (q) {
      const places = await Place.find({ name: { $regex: escapeRegex(q), $options: 'i' } }).select('_id').lean();
      query.place = { $in: places.map(place => place._id) };
      if (placeId) query.place = { $in: places.filter(place => String(place._id) === placeId).map(place => place._id) };
    }
    if (date) {
      const start = new Date(`${date}T00:00:00+07:00`);
      query.startsAt = { $gte: start, $lt: new Date(start.getTime() + 86400000) };
    }
    const [items, total] = await Promise.all([
      Booking.find(query).populate('user', 'name email').populate('place', 'name address')
        .sort({ startsAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Booking.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  cancelBooking: async (req, res) => {
    const id = assertId(req.params.id);
    const { reason } = parse(z.object({ reason: z.string().trim().min(5).max(500) }), req.body);
    const booking = await Booking.findOneAndUpdate({ _id: id, status: { $in: ['pending', 'confirmed'] }, startsAt: { $gt: new Date() } },
      { $set: { status: 'cancelled', cancelledBy: req.user._id, cancelledAt: new Date(),
        cancellationKind: 'admin', cancellationReason: reason } }, { new: true });
    if (!booking) throw new HttpError(409, 'Active booking not found');
    await releaseSlot(booking);
    await AuditEvent.create({ actor: req.user._id, action: 'booking.cancel', targetType: 'Booking',
      targetId: booking._id, detail: reason });
    await notifyUser(req.app.locals.cfg, booking.user, { kind: 'booking_cancelled',
      title: 'Booking đã bị hủy', body: reason, resourceType: 'Booking', resourceId: booking._id }).catch(console.error);
    res.json({ booking });
  },
  listAudit: async (req, res) => {
    const { page, limit } = parse(pageQuery, req.query);
    const [items, total] = await Promise.all([
      AuditEvent.find().populate('actor', 'name email').sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit).lean(), AuditEvent.countDocuments()
    ]);
    res.json({ items, page, limit, total });
  },
  listPlaceChanges: async (req, res) => {
    const { page, limit, status } = parse(pageQuery.extend({
      status: z.enum(['pending', 'approved', 'rejected']).optional()
    }), req.query);
    const query = status ? { status } : {};
    const [items, total] = await Promise.all([
      PlaceChangeRequest.find(query).populate('merchant', 'name email').populate('place', 'name address')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), PlaceChangeRequest.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  listFraudFlags: async (req, res) => {
    const { page, limit, status } = parse(pageQuery.extend({
      status: z.enum(['pending', 'resolved', 'dismissed']).optional()
    }), req.query);
    const query = status ? { status } : {};
    const [items, total] = await Promise.all([
      FraudFlag.find(query).populate('user', 'name email').populate('place', 'name address')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), FraudFlag.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  decideFraudFlag: async (req, res) => {
    const id = assertId(req.params.id);
    const { status, reason } = parse(z.object({ status: z.enum(['resolved', 'dismissed']),
      reason: z.string().trim().min(5).max(500) }), req.body);
    const flag = await FraudFlag.findOneAndUpdate({ _id: id, status: 'pending' },
      { $set: { status, decidedBy: req.user._id, decidedAt: new Date() } }, { new: true });
    if (!flag) throw new HttpError(409, 'Pending fraud flag not found');
    if (status === 'dismissed') {
      const checkin = await Checkin.findByIdAndUpdate(flag.checkin, { $set: { flagged: false } }, { new: true });
      if (checkin) {
        await awardReputation(checkin.user, checkin.place, 'checkin', checkin.createdAt.toISOString().slice(0, 10), 1);
        if (checkin.verificationLevel === 'qr_verified' && checkin.verifiedAt &&
          !(await VisitProof.exists({ user: checkin.user, place: checkin.place, method: 'qr', verifiedAt: checkin.verifiedAt }))) {
          const proof = await VisitProof.create({ user: checkin.user, place: checkin.place, method: 'qr', verifiedAt: checkin.verifiedAt });
          await linkReviewToVisit(proof);
        }
      }
      await recalculateStatus(flag.place, req.app.locals.cfg, req.app.locals.io);
    }
    await AuditEvent.create({ actor: req.user._id, action: `fraud.${status}`, targetType: 'FraudFlag', targetId: flag._id, detail: reason || null });
    res.json({ flag });
  },
  decidePlaceChange: async (req, res) => {
    const id = assertId(req.params.id);
    const { status, decisionNote } = parse(z.object({ status: z.enum(['approved', 'rejected']),
      decisionNote: z.string().trim().min(5).max(1000) }), req.body);
    const pending = await PlaceChangeRequest.findOne({ _id: id, status: 'pending' });
    if (!pending) throw new HttpError(409, 'Pending change not found');
    if (status === 'approved' && !(await Place.exists({ _id: pending.place, owner: pending.merchant, approval: 'approved' }))) {
      throw new HttpError(409, 'Place ownership changed');
    }
    const change = await PlaceChangeRequest.findOneAndUpdate({ _id: id, status: 'pending' },
      { $set: { status, decisionNote, decidedBy: req.user._id, decidedAt: new Date() } }, { new: true });
    if (!change) throw new HttpError(409, 'Pending change not found');
    if (status === 'approved') {
      const fields = {};
      for (const key of ['name', 'description', 'address']) {
        if (change.changes[key] !== undefined) fields[key] = change.changes[key];
      }
      if (change.changes.coordinates) fields.location = { type: 'Point', coordinates: change.changes.coordinates };
      const update = { $set: fields };
      if (change.changes.imagesToAdd) update.$addToSet = { images: { $each: change.changes.imagesToAdd } };
      const applied = await Place.updateOne({ _id: change.place, owner: change.merchant, approval: 'approved' }, update);
      if (!applied.matchedCount) {
        await PlaceChangeRequest.updateOne({ _id: id, status: 'approved' }, { $set: { status: 'pending', decisionNote: null, decidedBy: null, decidedAt: null } });
        throw new HttpError(409, 'Place ownership changed');
      }
    }
    await AuditEvent.create({ actor: req.user._id, action: `place_change.${status}`,
      targetType: 'PlaceChangeRequest', targetId: change._id, detail: decisionNote });
    await notifyUser(req.app.locals.cfg, change.merchant, { kind: `place_change_${status}`,
      title: status === 'approved' ? 'Thay đổi quán đã được duyệt' : 'Thay đổi quán chưa được duyệt',
      body: decisionNote, resourceType: 'PlaceChangeRequest', resourceId: change._id }).catch(console.error);
    res.json({ change });
  },
  transferPlaceOwner: async (req, res) => {
    const id = assertId(req.params.id);
    const { ownerId, reason } = parse(z.object({ ownerId: z.string().nullable(),
      reason: z.string().trim().min(5).max(500) }), req.body);
    const owner = ownerId ? await User.findOne({ _id: assertId(ownerId), status: 'active' }) : null;
    if (ownerId && !owner) throw new HttpError(404, 'New owner not found');
    const place = await Place.findByIdAndUpdate(id, { $set: { owner: owner?._id || null } }, { new: true });
    if (!place) throw new HttpError(404, 'Place not found');
    if (owner?.role === 'student') await User.updateOne({ _id: owner._id }, { $set: { role: 'merchant' } });
    await PlaceChangeRequest.updateMany({ place: id, status: 'pending' },
      { $set: { status: 'rejected', decisionNote: 'Ownership changed', decidedBy: req.user._id, decidedAt: new Date() } });
    await AuditEvent.create({ actor: req.user._id, action: 'place.owner_transfer', targetType: 'Place',
      targetId: place._id, detail: reason });
    res.json({ place });
  },
  listPlaces: async (req, res) => {
    const { page, limit, approval } = parse(pageQuery.extend({ approval: z.enum(['pending', 'approved', 'rejected']).optional() }), req.query);
    const query = approval ? { approval } : {};
    const [items, total] = await Promise.all([
      Place.find(query).select('+onboardingEvidenceUrls').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Place.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  updatePlace: async (req, res) => {
    const id = assertId(req.params.id);
    const body = parse(z.object({
      name: z.string().trim().min(2).max(120).optional(), description: z.string().trim().max(2000).optional(),
      address: z.string().trim().min(5).max(300).optional(), coordinates: coordinates.optional(),
      amenities: z.object({ wifi: z.boolean().nullable().optional(), outlets: z.boolean().nullable().optional() }).optional(),
      minDrinkPrice: z.number().min(0).nullable().optional(),
      approval: z.enum(['pending', 'approved', 'rejected']).optional(),
      decisionNote: z.string().trim().min(5).max(1000).optional()
    }), req.body);
    if (!Object.keys(body).length) throw new HttpError(400, 'No changes supplied');
    if (body.approval && !body.decisionNote) throw new HttpError(400, 'Decision note is required');
    if (body.approval && body.approval !== 'approved' && await Booking.exists({ place: id,
      status: { $in: ['pending', 'confirmed'] }, startsAt: { $gt: new Date() } })) {
      throw new HttpError(409, 'Cancel future bookings before hiding the place');
    }
    const changes = { ...body };
    if (body.decisionNote) { changes.moderationNote = body.decisionNote; delete changes.decisionNote; }
    if (body.coordinates) { changes.location = { type: 'Point', coordinates: body.coordinates }; delete changes.coordinates; }
    if (body.amenities) {
      delete changes.amenities;
      for (const [key, value] of Object.entries(body.amenities)) changes[`amenities.${key}`] = value;
    }
    const place = await Place.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true });
    if (!place) throw new HttpError(404, 'Place not found');
    if (body.approval === 'approved' && place.owner) {
      await User.updateOne({ _id: place.owner, role: 'student', status: 'active' }, { $set: { role: 'merchant' } });
    }
    await AuditEvent.create({ actor: req.user._id, action: body.approval ? `place.${body.approval}` : 'place.update',
      targetType: 'Place', targetId: place._id, detail: body.decisionNote || null });
    if (body.approval && body.approval !== 'pending') await notifyUser(req.app.locals.cfg, place.submittedBy,
      { kind: `place_${body.approval}`, title: body.approval === 'approved' ? 'Địa điểm đã được duyệt' : 'Địa điểm chưa được duyệt',
        body: body.decisionNote ? `${place.name}: ${body.decisionNote}` : place.name,
        resourceType: 'Place', resourceId: place._id }).catch(console.error);
    res.json({ place });
  },
  listReports: async (req, res) => {
    const { page, limit, status } = parse(pageQuery.extend({ status: z.enum(['pending', 'resolved', 'dismissed']).optional() }), req.query);
    const query = status ? { status } : {};
    const [items, total] = await Promise.all([
      Report.find(query).populate('user', 'name email').populate('place', 'name address').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Report.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  updateReport: async (req, res) => {
    const id = assertId(req.params.id);
    const { status, reason } = parse(z.object({ status: z.enum(['resolved', 'dismissed']),
      reason: z.string().trim().min(5).max(1000) }), req.body);
    const report = await Report.findOneAndUpdate({ _id: id, status: 'pending' }, { $set: { status, resolvedBy: req.user._id,
      resolutionNote: reason } }, { new: true });
    if (!report) throw new HttpError(409, 'Pending report not found');
    await AuditEvent.create({ actor: req.user._id, action: `report.${status}`, targetType: 'Report',
      targetId: report._id, detail: reason || null });
    await notifyUser(req.app.locals.cfg, report.user, { kind: `report_${status}`,
      title: status === 'resolved' ? 'Báo cáo đã được xử lý' : 'Báo cáo đã được xem xét',
      body: reason || 'Xem trạng thái báo cáo trong StudySpot.', resourceType: 'Report', resourceId: report._id }).catch(console.error);
    res.json({ report });
  },
  listReviews: async (req, res) => {
    const { page, limit, hidden } = parse(pageQuery.extend({ hidden: z.enum(['true', 'false']).optional() }), req.query);
    const query = hidden === undefined ? {} : { hidden: hidden === 'true' };
    const [items, total] = await Promise.all([
      Review.find(query).populate('user', 'name email').populate('place', 'name address')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Review.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  updateReview: async (req, res) => {
    const id = assertId(req.params.id);
    const { hidden, reason } = parse(z.object({ hidden: z.boolean(),
      reason: z.string().trim().min(5).max(1000) }), req.body);
    const review = await Review.findOneAndUpdate({ _id: id, hidden: { $ne: hidden } },
      { $set: { hidden, moderationNote: reason } }, { new: true });
    if (!review) throw new HttpError(409, 'Review not found or visibility already set');
    await updateRating(review.place);
    await AuditEvent.create({ actor: req.user._id, action: hidden ? 'review.hide' : 'review.restore',
      targetType: 'Review', targetId: review._id, detail: reason || null });
    await notifyUser(req.app.locals.cfg, review.user, { kind: hidden ? 'review_hidden' : 'review_restored',
      title: hidden ? 'Đánh giá đã được ẩn' : 'Đánh giá đã được khôi phục',
      body: reason || 'Đánh giá của bạn đã được kiểm duyệt.', resourceType: 'Review', resourceId: review._id }).catch(console.error);
    res.json({ review });
  },
  uploadImage: async (req, res) => {
    const id = assertId(req.params.id);
    const { reason } = parse(z.object({ reason: z.string().trim().min(5).max(500) }), req.body);
    if (!req.file) throw new HttpError(400, 'JPEG, PNG, or WebP image required (max 5 MB)');
    if (!(await Place.exists({ _id: id }))) throw new HttpError(404, 'Place not found');
    const imageUrl = await uploadPlaceImage(req.file);
    const place = await Place.findByIdAndUpdate(id, { $push: { images: imageUrl } }, { new: true });
    await AuditEvent.create({ actor: req.user._id, action: 'place.image_add', targetType: 'Place', targetId: id, detail: reason });
    res.status(201).json({ imageUrl, place });
  },
  removeImage: async (req, res) => {
    const id = assertId(req.params.id);
    const { imageUrl, reason } = parse(z.object({ imageUrl: z.url(), reason: z.string().trim().min(5).max(500) }), req.body);
    const place = await Place.findOneAndUpdate({ _id: id, images: imageUrl }, { $pull: { images: imageUrl } }, { new: true });
    if (!place) throw new HttpError(404, 'Image not found at place');
    await AuditEvent.create({ actor: req.user._id, action: 'place.image_remove', targetType: 'Place', targetId: id, detail: reason });
    if (place.owner) await notifyUser(req.app.locals.cfg, place.owner, { kind: 'place_image_removed',
      title: 'Ảnh địa điểm đã bị gỡ', body: `${place.name}: ${reason}`, resourceType: 'Place', resourceId: place._id }).catch(console.error);
    res.json({ place });
  },
  analytics: async (req, res) => {
    const { from, to } = parse(z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() }), req.query);
    const today = localVisitTime(new Date()).date;
    const periodFrom = from || localVisitTime(new Date(Date.now() - 29 * 86400000)).date;
    const periodTo = to || today;
    const start = new Date(`${periodFrom}T00:00:00+07:00`);
    const end = new Date(new Date(`${periodTo}T00:00:00+07:00`).getTime() + 86400000);
    if (start >= end || end.getTime() - start.getTime() > 366 * 86400000) {
      throw new HttpError(400, 'Date range must be between 1 and 366 days');
    }
    const createdAt = { $gte: start, $lt: end };
    const [users, approvedPlaces, pendingPlaces, pendingReports, reviews, activeCheckins,
      merchants, pendingClaims, upcomingBookings, verifiedVisits, pendingFraudFlags, pendingEmails, failedEmails] = await Promise.all([
      User.countDocuments(), Place.countDocuments({ approval: 'approved' }), Place.countDocuments({ approval: 'pending' }),
      Report.countDocuments({ status: 'pending' }), Review.countDocuments({ hidden: false }), Checkin.countDocuments({ expiresAt: { $gt: new Date() } }),
      User.countDocuments({ role: 'merchant' }), MerchantClaim.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: 'confirmed', startsAt: { $gt: new Date() } }), VisitProof.countDocuments(),
      FraudFlag.countDocuments({ status: 'pending' }), EmailOutbox.countDocuments({ status: { $in: ['pending', 'sending'] } }),
      EmailOutbox.countDocuments({ status: 'failed' })
    ]);
    const [newUsers, newPlaces, newBookings, completedBookings, cancelledBookings, noShows,
      newCheckins, newReviews, newReports, newVerifiedVisits] = await Promise.all([
      User.countDocuments({ createdAt }), Place.countDocuments({ createdAt }), Booking.countDocuments({ createdAt }),
      Booking.countDocuments({ createdAt, status: 'completed' }), Booking.countDocuments({ createdAt, status: 'cancelled' }),
      Booking.countDocuments({ createdAt, status: 'no_show' }), Checkin.countDocuments({ createdAt }),
      Review.countDocuments({ createdAt }), Report.countDocuments({ createdAt }), VisitProof.countDocuments({ createdAt })
    ]);
    res.json({ users, approvedPlaces, pendingPlaces, pendingReports, reviews, activeCheckins,
      merchants, pendingClaims, upcomingBookings, verifiedVisits, pendingFraudFlags, pendingEmails, failedEmails,
      period: { from: periodFrom, to: periodTo, newUsers, newPlaces, newBookings, completedBookings,
        cancelledBookings, noShows, newCheckins, newReviews, newReports, newVerifiedVisits } });
  }
};
