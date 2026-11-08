import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/auth/session';

import { BOOKINGS_PAGE_SIZE, bookingsApi } from '../bookings';
import { queryKeys } from '../queryKeys';
import type { CreateBookingInput, MyBooking, MyBookingPage } from '../types';

function nextPage(last: MyBookingPage): number | undefined {
  const page = last.page ?? 1;
  const limit = last.limit ?? BOOKINGS_PAGE_SIZE;
  return page * limit < (last.total ?? 0) ? page + 1 : undefined;
}

/** `GET /api/places/{id}/availability?date=` for one Vietnam calendar day. Public. */
export function useAvailability(placeId: string | undefined, date: string) {
  return useQuery({
    queryKey: queryKeys.availability(placeId ?? '', date),
    queryFn: () => bookingsApi.availability(placeId as string, date),
    enabled: Boolean(placeId && date),
  });
}

/** Paged `GET /api/bookings/me`, newest start time first. */
export function useMyBookings() {
  const { status } = useSession();
  const query = useInfiniteQuery({
    queryKey: queryKeys.myBookings,
    queryFn: ({ pageParam }) => bookingsApi.listMine(pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: status === 'signed-in',
  });
  const items: MyBooking[] = query.data?.pages.flatMap((page) => page.items ?? []) ?? [];
  return { ...query, items, total: query.data?.pages[0]?.total ?? 0 };
}

/** `POST /api/bookings`; refreshes the user's bookings and the day's free seats. */
export function useCreateBooking(placeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => bookingsApi.create(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myBookings });
      queryClient.invalidateQueries({ queryKey: queryKeys.availabilityAll(placeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

/** `POST /api/bookings/{id}/cancel`; only possible more than 1 hour before the start. */
export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (booking: MyBooking) => bookingsApi.cancel(booking._id as string),
    onSettled: (_data, _error, booking) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myBookings });
      const place = booking.place;
      const placeId = typeof place === 'string' ? place : place?._id;
      if (placeId) queryClient.invalidateQueries({ queryKey: queryKeys.availabilityAll(placeId) });
    },
  });
}
