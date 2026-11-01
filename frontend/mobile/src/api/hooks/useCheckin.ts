import { useMutation, useQueryClient } from '@tanstack/react-query';

import { placesApi } from '../places';
import { queryKeys } from '../queryKeys';
import type { CheckinInput, LiveStatus, PlaceResponse } from '../types';

/** Writes a new live status into the cached place detail (shared with the socket updates). */
export function setCachedLiveStatus(
  queryClient: ReturnType<typeof useQueryClient>,
  placeId: string,
  liveStatus: LiveStatus,
): void {
  queryClient.setQueryData<PlaceResponse>(queryKeys.place(placeId), (previous) =>
    previous?.place ? { ...previous, place: { ...previous.place, liveStatus } } : previous,
  );
}

/** `POST /api/places/{id}/checkins`. 403 when farther than 250 m, 429 within 15 minutes of the last one. */
export function useCheckin(placeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckinInput) => placesApi.checkin(placeId, input),
    onSuccess: (result) => {
      if (result.liveStatus) setCachedLiveStatus(queryClient, placeId, result.liveStatus);
      // Map markers and rows get no socket updates; reputation may have gone up.
      queryClient.invalidateQueries({ queryKey: queryKeys.placeLists });
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}
