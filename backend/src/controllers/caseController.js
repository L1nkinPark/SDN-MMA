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
      if ((review.hiddenAt || review.updatedAt) < new Date(Date.now() - 14 * 86400000)) {
        throw new HttpError(409, 'Appeal window closed');
      }
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
    const targetIds = items.map(item => item.targetId);
    const targetType = kind === 'booking_dispute' ? 'Booking' : 'Review';
    const [targets, events, proofs] = await Promise.all([
      kind === 'booking_dispute'
        ? Booking.find({ _id: { $in: targetIds } }).populate('place', 'name address').lean()
        : Review.find({ _id: { $in: targetIds } }).populate('place', 'name address')
          .populate('verifiedVisit', 'method verifiedAt').lean(),
      AuditEvent.find({ targetType, targetId: { $in: targetIds } }).sort({ createdAt: -1 }).lean(),
      kind === 'booking_dispute' ? VisitProof.find({ booking: { $in: targetIds } }).lean() : Promise.resolve([])
    ]);
    const targetById = new Map(targets.map(target => [String(target._id), target]));
    const context = items.map(item => ({ ...item, target: targetById.get(String(item.targetId)) || null,
      targetEvents: events.filter(event => String(event.targetId) === String(item.targetId)),
      visitProof: proofs.find(proof => String(proof.booking) === String(item.targetId)) || null }));
    res.json({ items: context, page, limit, total });
  },
  adminDecide: kind => async (req, res) => {
    const id = assertId(req.params.id);
    const { status, decisionNote, evidenceSource, evidenceSummary } = parse(z.object({ status: z.enum(['accepted', 'rejected']),
      decisionNote: z.string().trim().min(20).max(2000),
      evidenceSource: z.enum(['receipt', 'qr_log', 'staff_confirmation', 'other']).optional(),
      evidenceSummary: z.string().trim().min(20).max(2000).optional() }), req.body);
    if (status === 'accepted' && kind === 'booking_dispute' && (!evidenceSource || !evidenceSummary)) {
      throw new HttpError(400, 'Evidence source and summary required to confirm visit');
    }
    const supportCase = await SupportCase.findOneAndUpdate({ _id: id, kind, status: 'pending' },
      { $set: { status, decisionNote, evidenceSource: evidenceSource || null, evidenceSummary: evidenceSummary || null,
        decidedBy: req.user._id, decidedAt: new Date() } }, { new: true });
    if (!supportCase) throw new HttpError(409, 'Pending case not found');
    if (status === 'accepted') {
      if (kind === 'review_appeal') {
        const existing = await Review.findOne({ _id: supportCase.targetId, user: supportCase.user, hidden: true });
        const verified = existing?.verifiedVisit && await VisitProof.exists({ _id: existing.verifiedVisit,
          user: existing.user, place: existing.place });
        if (!verified) {
          await SupportCase.updateOne({ _id: id, status }, { $set: { status: 'pending', decisionNote: null,
            evidenceSource: null, evidenceSummary: null, decidedBy: null, decidedAt: null } });
          throw new HttpError(409, 'Verified visit required to restore review');
        }
        const review = await Review.findOneAndUpdate({ _id: supportCase.targetId, user: supportCase.user, hidden: true },
          { $set: { hidden: false, hiddenAt: null, moderationNote: decisionNote } }, { new: true });
        if (!review) {
          await SupportCase.updateOne({ _id: id, status }, { $set: { status: 'pending', decisionNote: null,
            evidenceSource: null, evidenceSummary: null, decidedBy: null, decidedAt: null } });
          throw new HttpError(409, 'Review no longer hidden');
        }
        await updateRating(review.place);
      } else {
        const original = await Booking.findOne({ _id: supportCase.targetId, user: supportCase.user, status: 'no_show' });
        if (!original) {
          await SupportCase.updateOne({ _id: id, status }, { $set: { status: 'pending', decisionNote: null,
            evidenceSource: null, evidenceSummary: null, decidedBy: null, decidedAt: null } });
          throw new HttpError(409, 'Booking no longer marked no-show');
        }
        const booking = await Booking.findOneAndUpdate({ _id: supportCase.targetId, user: supportCase.user, status: 'no_show' },
          { $set: { status: 'completed', arrivedAt: original.startsAt, noShowAt: null, decidedBy: req.user._id,
            decidedAt: new Date() } }, { new: true });
        if (!booking) {
          await SupportCase.updateOne({ _id: id, status }, { $set: { status: 'pending', decisionNote: null,
            evidenceSource: null, evidenceSummary: null, decidedBy: null, decidedAt: null } });
          throw new HttpError(409, 'Booking no longer marked no-show');
        }
        const proof = await VisitProof.findOneAndUpdate({ booking: booking._id }, { $setOnInsert: { user: booking.user, place: booking.place,
          booking: booking._id, method: 'admin_dispute', verifiedAt: booking.startsAt } }, { upsert: true, new: true });
        await linkReviewToVisit(proof);
      }
    }
    await AuditEvent.create({ actor: req.user._id, action: `${kind}.${status}`, targetType: 'SupportCase',
      targetId: id, detail: evidenceSummary ? `${decisionNote} | ${evidenceSource}: ${evidenceSummary}` : decisionNote });
    await notifyUser(req.app.locals.cfg, supportCase.user, { kind: `${kind}_${status}`,
      title: status === 'accepted' ? 'Khiếu nại đã được chấp nhận' : 'Khiếu nại chưa được chấp nhận',
      body: decisionNote, resourceType: 'SupportCase', resourceId: id }).catch(console.error);
    res.json({ case: supportCase });
  }
};
