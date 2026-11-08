import { z } from 'zod';
import { AuditEvent, Booking, Review, SupportCase, VisitProof } from '../models/index.js';
import { HttpError, assertId, pageQuery, parse } from '../utils/common.js';
import { notifyUser } from '../services/notificationService.js';
import { updateRating } from '../services/ratingService.js';
import { linkReviewToVisit } from '../services/visitReviewService.js';

const createBody = z.object({ kind: z.enum(['review_appeal', 'booking_dispute']), targetId: z.string(),
  reason: z.string().trim().min(20).max(2000) });

export const caseController = {
  create: async (req, res) => {
    const { kind, targetId: rawId, reason } = parse(createBody, req.body);
    const targetId = assertId(rawId);
    if (kind === 'review_appeal') {
      const review = await Review.findOne({ _id: targetId, user: req.user._id, hidden: true });
      if (!review) throw new HttpError(409, 'Hidden review belonging to user required');
      if (review.updatedAt < new Date(Date.now() - 14 * 86400000)) throw new HttpError(409, 'Appeal window closed');
    } else {
      const booking = await Booking.findOne({ _id: targetId, user: req.user._id, status: 'no_show' });
      if (!booking) throw new HttpError(409, 'No-show booking belonging to user required');
      if ((booking.noShowAt || booking.updatedAt) < new Date(Date.now() - 7 * 86400000)) {
        throw new HttpError(409, 'Dispute window closed');
      }
    }
    if (await SupportCase.exists({ user: req.user._id, kind, targetId })) throw new HttpError(409, 'Case already submitted');
    const supportCase = await SupportCase.create({ user: req.user._id, kind, targetId, reason });
    res.status(201).json({ case: supportCase });
  },
  mine: async (req, res) => {
    const { page, limit } = parse(pageQuery, req.query);
    const query = { user: req.user._id };
    const [items, total] = await Promise.all([
      SupportCase.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      SupportCase.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  adminList: kind => async (req, res) => {
    const { page, limit, status } = parse(pageQuery.extend({ status: z.enum(['pending', 'accepted', 'rejected']).optional() }), req.query);
    const query = { kind, ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      SupportCase.find(query).populate('user', 'name email').sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit).lean(), SupportCase.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  adminDecide: kind => async (req, res) => {
    const id = assertId(req.params.id);
    const { status, decisionNote } = parse(z.object({ status: z.enum(['accepted', 'rejected']),
      decisionNote: z.string().trim().min(20).max(2000) }), req.body);
    const supportCase = await SupportCase.findOneAndUpdate({ _id: id, kind, status: 'pending' },
      { $set: { status, decisionNote, decidedBy: req.user._id, decidedAt: new Date() } }, { new: true });
    if (!supportCase) throw new HttpError(409, 'Pending case not found');
    if (status === 'accepted') {
      if (kind === 'review_appeal') {
        const review = await Review.findOneAndUpdate({ _id: supportCase.targetId, user: supportCase.user, hidden: true },
          { $set: { hidden: false, moderationNote: decisionNote } }, { new: true });
        if (!review) {
          await SupportCase.updateOne({ _id: id, status }, { $set: { status: 'pending', decisionNote: null, decidedBy: null, decidedAt: null } });
          throw new HttpError(409, 'Review no longer hidden');
        }
        await updateRating(review.place);
      } else {
        const original = await Booking.findOne({ _id: supportCase.targetId, user: supportCase.user, status: 'no_show' });
        if (!original) {
          await SupportCase.updateOne({ _id: id, status }, { $set: { status: 'pending', decisionNote: null, decidedBy: null, decidedAt: null } });
          throw new HttpError(409, 'Booking no longer marked no-show');
        }
        const booking = await Booking.findOneAndUpdate({ _id: supportCase.targetId, user: supportCase.user, status: 'no_show' },
          { $set: { status: 'completed', arrivedAt: original.startsAt, noShowAt: null, decidedBy: req.user._id,
            decidedAt: new Date() } }, { new: true });
        if (!booking) {
          await SupportCase.updateOne({ _id: id, status }, { $set: { status: 'pending', decisionNote: null, decidedBy: null, decidedAt: null } });
          throw new HttpError(409, 'Booking no longer marked no-show');
        }
        const proof = await VisitProof.findOneAndUpdate({ booking: booking._id }, { $setOnInsert: { user: booking.user, place: booking.place,
          booking: booking._id, method: 'admin_dispute', verifiedAt: booking.startsAt } }, { upsert: true, new: true });
        await linkReviewToVisit(proof);
      }
    }
    await AuditEvent.create({ actor: req.user._id, action: `${kind}.${status}`, targetType: 'SupportCase',
      targetId: id, detail: decisionNote });
    await notifyUser(req.app.locals.cfg, supportCase.user, { kind: `${kind}_${status}`,
      title: status === 'accepted' ? 'Khiếu nại đã được chấp nhận' : 'Khiếu nại chưa được chấp nhận',
      body: decisionNote, resourceType: 'SupportCase', resourceId: id }).catch(console.error);
    res.json({ case: supportCase });
  }
};
