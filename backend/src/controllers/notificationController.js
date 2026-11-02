import { z } from 'zod';
import { Notification } from '../models/index.js';
import { HttpError, assertId, pageQuery, parse } from '../utils/common.js';

export const notificationController = {
  list: async (req, res) => {
    const { page, limit, unread } = parse(pageQuery.extend({ unread: z.enum(['true', 'false']).optional() }), req.query);
    const query = { user: req.user._id, ...(unread === 'true' ? { readAt: null } : {}) };
    const [items, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Notification.countDocuments(query), Notification.countDocuments({ user: req.user._id, readAt: null })
    ]);
    res.json({ items, total, unreadCount, page, limit });
  },
  read: async (req, res) => {
    const id = assertId(req.params.id);
    const notification = await Notification.findOneAndUpdate({ _id: id, user: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }, { new: true });
    if (!notification) throw new HttpError(404, 'Unread notification not found');
    res.json({ notification });
  },
  readAll: async (req, res) => {
    const result = await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
    res.json({ updated: result.modifiedCount });
  }
};
