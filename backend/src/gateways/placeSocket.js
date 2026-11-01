import { Place } from '../models/index.js';
import { assertId } from '../utils/common.js';
import { recalculateStatus } from '../services/statusService.js';

export function registerPlaceSocket(io, cfg) {
  io.on('connection', socket => {
    socket.on('place:join', async (placeId, acknowledge) => {
      try {
        assertId(placeId);
        let place = await Place.findOne({ _id: placeId, approval: 'approved' }).select('liveStatus');
        if (!place) throw new Error('Place not found');
        if (place.liveStatus.validUntil && place.liveStatus.validUntil <= new Date()) {
          await recalculateStatus(placeId, cfg, io);
          place = await Place.findById(placeId).select('liveStatus');
        }
        await socket.join(`place:${placeId}`);
        socket.emit('place:status', { placeId, liveStatus: place.liveStatus });
        if (typeof acknowledge === 'function') acknowledge({ ok: true });
      } catch (err) { if (typeof acknowledge === 'function') acknowledge({ ok: false, error: err.message }); }
    });
    socket.on('place:leave', placeId => {
      if (typeof placeId === 'string') socket.leave(`place:${placeId}`);
    });
  });
}
