import { z } from 'zod';
import { Place, Report } from '../models/index.js';
import { HttpError, objectId, pageQuery, parse } from '../utils/common.js';

export const reportController = {
  create: async (req, res) => {
    const body = parse(z.object({
      placeId: objectId,
      reason: z.enum(['closed', 'incorrect_info', 'inappropriate', 'other']),
      detail: z.string().trim().min(10).max(2000)
    }), req.body);
    if (!(await Place.exists({ _id: body.placeId, approval: 'approved' }))) throw new HttpError(404, 'Place not found');
    const existing = await Report.exists({ user: req.user._id, place: body.placeId, status: 'pending' });
    if (existing) throw new HttpError(409, 'You already have a pending report for this place');
    const report = await Report.create({ user: req.user._id, place: body.placeId, reason: body.reason, detail: body.detail });
    res.status(201).json({ report });
  },
  listMine: async (req, res) => {
    const { page, limit } = parse(pageQuery, req.query);
    const query = { user: req.user._id };
    const [items, total] = await Promise.all([
      Report.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Report.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  }
};
