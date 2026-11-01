import { z } from 'zod';
import { User } from '../models/index.js';
import { parse } from '../utils/common.js';

export const reputationController = {
  leaderboard: async (req, res) => {
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }), req.query);
    const items = await User.find({ reputation: { $gt: 0 }, role: 'student' })
      .select('name reputation').sort({ reputation: -1, createdAt: 1 }).limit(limit).lean();
    res.json({ items });
  }
};
