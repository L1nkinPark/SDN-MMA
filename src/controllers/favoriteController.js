import { Place, User } from '../models/index.js';
import { HttpError, assertId } from '../utils/common.js';
import { publicUser } from '../views/userView.js';

export const favoriteController = {
  list: async (req, res) => {
    const user = await User.findById(req.user._id).populate({ path: 'favorites', match: { approval: 'approved' } });
    res.json({ items: user.favorites });
  },
  add: async (req, res) => {
    const id = assertId(req.params.placeId);
    if (!(await Place.exists({ _id: id, approval: 'approved' }))) throw new HttpError(404, 'Place not found');
    const user = await User.findByIdAndUpdate(req.user._id, { $addToSet: { favorites: id } }, { new: true });
    res.json({ user: publicUser(user) });
  },
  remove: async (req, res) => {
    const id = assertId(req.params.placeId);
    await User.updateOne({ _id: req.user._id }, { $pull: { favorites: id } });
    res.status(204).end();
  }
};
