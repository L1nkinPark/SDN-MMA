import { z } from 'zod';
import { AuditEvent, Booking, Checkin, MerchantClaim, Place, RefreshToken, Report, Review, User, VisitProof } from '../models/index.js';
import { HttpError, assertId, coordinates, escapeRegex, pageQuery, parse } from '../utils/common.js';
import { updateRating } from '../services/ratingService.js';
import { uploadPlaceImage } from '../services/imageService.js';
import { releaseSlot } from '../services/bookingService.js';

export const adminController = {
  listUsers: async (req, res) => {
    const { page, limit, role, status, q } = parse(pageQuery.extend({
      role: z.enum(['student', 'merchant', 'admin']).optional(),
      status: z.enum(['active', 'suspended']).optional(), q: z.string().trim().max(100).optional()
    }), req.query);
    const query = { ...(role ? { role } : {}), ...(status ? { status } : {}),
      ...(q ? { email: { $regex: escapeRegex(q), $options: 'i' } } : {}) };
    const [items, total] = await Promise.all([
      User.find(query).select('name email role status reputation createdAt updatedAt')
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), User.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  updateUser: async (req, res) => {
    const id = assertId(req.params.id);
    const { status } = parse(z.object({ status: z.enum(['active', 'suspended']) }), req.body);
    if (String(req.user._id) === id) throw new HttpError(403, 'Cannot change own status');
    const user = await User.findOneAndUpdate({ _id: id, role: { $ne: 'admin' } },
      { $set: { status } }, { new: true });
    if (!user) throw new HttpError(404, 'Non-admin user not found');
    if (status === 'suspended') await RefreshToken.updateMany({ user: id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await AuditEvent.create({ actor: req.user._id, action: `user.${status}`, targetType: 'User', targetId: user._id });
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
    res.json({ claim: decided });
  },
  listBookings: async (req, res) => {
    const { page, limit, status } = parse(pageQuery.extend({
      status: z.enum(['confirmed', 'cancelled', 'completed', 'no_show']).optional()
    }), req.query);
    const query = status ? { status } : {};
    const [items, total] = await Promise.all([
      Booking.find(query).populate('user', 'name email').populate('place', 'name address')
        .sort({ startsAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Booking.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  cancelBooking: async (req, res) => {
    const id = assertId(req.params.id);
    const { reason } = parse(z.object({ reason: z.string().trim().min(5).max(500) }), req.body);
    const booking = await Booking.findOneAndUpdate({ _id: id, status: 'confirmed', startsAt: { $gt: new Date() } },
      { $set: { status: 'cancelled', cancelledBy: req.user._id } }, { new: true });
    if (!booking) throw new HttpError(409, 'Active booking not found');
    await releaseSlot(booking);
    await AuditEvent.create({ actor: req.user._id, action: 'booking.cancel', targetType: 'Booking',
      targetId: booking._id, detail: reason });
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
  listPlaces: async (req, res) => {
    const { page, limit, approval } = parse(pageQuery.extend({ approval: z.enum(['pending', 'approved', 'rejected']).optional() }), req.query);
    const query = approval ? { approval } : {};
    const [items, total] = await Promise.all([
      Place.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Place.countDocuments(query)
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
      approval: z.enum(['pending', 'approved', 'rejected']).optional()
    }), req.body);
    if (!Object.keys(body).length) throw new HttpError(400, 'No changes supplied');
    const changes = { ...body };
    if (body.coordinates) { changes.location = { type: 'Point', coordinates: body.coordinates }; delete changes.coordinates; }
    if (body.amenities) {
      delete changes.amenities;
      for (const [key, value] of Object.entries(body.amenities)) changes[`amenities.${key}`] = value;
    }
    const place = await Place.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true });
    if (!place) throw new HttpError(404, 'Place not found');
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
    const { status } = parse(z.object({ status: z.enum(['resolved', 'dismissed']) }), req.body);
    const report = await Report.findByIdAndUpdate(id, { $set: { status, resolvedBy: req.user._id } }, { new: true });
    if (!report) throw new HttpError(404, 'Report not found');
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
    const { hidden } = parse(z.object({ hidden: z.boolean() }), req.body);
    const review = await Review.findByIdAndUpdate(id, { $set: { hidden } }, { new: true });
    if (!review) throw new HttpError(404, 'Review not found');
    await updateRating(review.place);
    res.json({ review });
  },
  uploadImage: async (req, res) => {
    const id = assertId(req.params.id);
    if (!req.file) throw new HttpError(400, 'JPEG, PNG, or WebP image required (max 5 MB)');
    if (!(await Place.exists({ _id: id }))) throw new HttpError(404, 'Place not found');
    const imageUrl = await uploadPlaceImage(req.file);
    const place = await Place.findByIdAndUpdate(id, { $push: { images: imageUrl } }, { new: true });
    res.status(201).json({ imageUrl, place });
  },
  analytics: async (_req, res) => {
    const [users, approvedPlaces, pendingPlaces, pendingReports, reviews, activeCheckins,
      merchants, pendingClaims, upcomingBookings, verifiedVisits] = await Promise.all([
      User.countDocuments(), Place.countDocuments({ approval: 'approved' }), Place.countDocuments({ approval: 'pending' }),
      Report.countDocuments({ status: 'pending' }), Review.countDocuments({ hidden: false }), Checkin.countDocuments({ expiresAt: { $gt: new Date() } }),
      User.countDocuments({ role: 'merchant' }), MerchantClaim.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: 'confirmed', startsAt: { $gt: new Date() } }), VisitProof.countDocuments()
    ]);
    res.json({ users, approvedPlaces, pendingPlaces, pendingReports, reviews, activeCheckins,
      merchants, pendingClaims, upcomingBookings, verifiedVisits });
  }
};
