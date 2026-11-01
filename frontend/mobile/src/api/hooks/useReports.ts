import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/auth/session';

import { queryKeys } from '../queryKeys';
import { REPORTS_PAGE_SIZE, reportsApi } from '../reports';
import type { Report, ReportInput, ReportPage } from '../types';

function nextPage(last: ReportPage): number | undefined {
  const page = last.page ?? 1;
  const limit = last.limit ?? REPORTS_PAGE_SIZE;
  return page * limit < (last.total ?? 0) ? page + 1 : undefined;
}

/** `POST /api/reports`; refreshes the user's report list on success. */
export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportInput) => reportsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myReports }),
  });
}

/** Paged `GET /api/reports/me`. `place` is only an ID. */
export function useMyReports() {
  const { status } = useSession();
  const query = useInfiniteQuery({
    queryKey: queryKeys.myReports,
    queryFn: ({ pageParam }) => reportsApi.listMine(pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: status === 'signed-in',
  });
  const items: Report[] = query.data?.pages.flatMap((page) => page.items ?? []) ?? [];
  return { ...query, items, total: query.data?.pages[0]?.total ?? 0 };
}
