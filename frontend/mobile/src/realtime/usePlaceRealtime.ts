import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { setCachedLiveStatus } from '@/api/hooks/useCheckin';
import { queryKeys } from '@/api/queryKeys';

import { getSocket, type PlaceStatusEvent } from './socket';

export type RealtimeState = 'connecting' | 'live' | 'offline';

/**
 * Joins the place room while mounted and writes `place:status` into the place query.
 * MongoDB stays the source of truth: after a reconnect we join again and refetch over REST.
 */
export function usePlaceRealtime(placeId: string | undefined): RealtimeState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<RealtimeState>('connecting');

  useEffect(() => {
    if (!placeId) return;
    const socket = getSocket();

    const join = () => {
      socket.emit('place:join', placeId, (result) => setState(result?.ok ? 'live' : 'offline'));
    };
    const onStatus = (event: PlaceStatusEvent) => {
      if (event.placeId === placeId && event.liveStatus) setCachedLiveStatus(queryClient, placeId, event.liveStatus);
    };
    const onLost = () => setState('offline');
    const onReconnect = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.place(placeId), exact: true });
    };

    socket.on('connect', join);
    socket.on('disconnect', onLost);
    socket.on('connect_error', onLost);
    socket.on('place:status', onStatus);
    socket.io.on('reconnect', onReconnect);

    if (socket.connected) join();
    else socket.connect();

    return () => {
      if (socket.connected) socket.emit('place:leave', placeId);
      socket.off('connect', join);
      socket.off('disconnect', onLost);
      socket.off('connect_error', onLost);
      socket.off('place:status', onStatus);
      socket.io.off('reconnect', onReconnect);
    };
  }, [placeId, queryClient]);

  return state;
}
