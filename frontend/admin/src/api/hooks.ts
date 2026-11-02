import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from './endpoints';
import { queryKeys } from './queryKeys';
import type { Approval, PlaceInput, PlaceUpdate, ReportStatus } from './types';

export function useAnalytics() {
  return useQuery({ queryKey: queryKeys.analytics, queryFn: adminApi.analytics });
}

export function usePlaces(approval: Approval | 'all', page: number) {
  return useQuery({
    queryKey: queryKeys.placesPage(approval, page),
    queryFn: () => adminApi.listPlaces(page, approval === 'all' ? undefined : approval),
    placeholderData: keepPreviousData,
  });
}

export function useReports(status: ReportStatus | 'all', page: number) {
  return useQuery({
    queryKey: queryKeys.reportsPage(status, page),
    queryFn: () => adminApi.listReports(page, status === 'all' ? undefined : status),
    placeholderData: keepPreviousData,
  });
}

export function useReviews(visibility: 'all' | 'visible' | 'hidden', page: number) {
  return useQuery({
    queryKey: queryKeys.reviewsPage(visibility, page),
    queryFn: () => adminApi.listReviews(page, visibility === 'all' ? undefined : visibility === 'hidden'),
    placeholderData: keepPreviousData,
  });
}

/** Lists and counts that a moderation change can affect. */
function useInvalidate() {
  const queryClient = useQueryClient();
  return (...keys: (readonly string[])[]) =>
    Promise.all([...keys, queryKeys.analytics].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useUpdatePlace() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: PlaceUpdate }) => adminApi.updatePlace(id, changes),
    onSuccess: () => invalidate(queryKeys.places),
  });
}

export function useUploadImage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => adminApi.uploadImage(id, file),
    onSuccess: () => invalidate(queryKeys.places),
  });
}

export function useCreatePlace() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: PlaceInput) => adminApi.createPlace(input),
    onSuccess: () => invalidate(queryKeys.places),
  });
}

export function useUpdateReport() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'resolved' | 'dismissed'; reason?: string }) => adminApi.updateReport(id, status, reason),
    onSuccess: () => invalidate(queryKeys.reports),
  });
}

export function useUpdateReview() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, hidden, reason }: { id: string; hidden: boolean; reason?: string }) => adminApi.updateReview(id, hidden, reason),
    onSuccess: () => invalidate(queryKeys.reviews),
  });
}
