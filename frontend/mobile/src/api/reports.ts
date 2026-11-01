import { api } from './client';
import type { CreateReportResponse, ReportInput, ReportPage, ReportReason, ReportStatus } from './types';

export const REPORTS_PAGE_SIZE = 20;

export const reportsApi = {
  create: (input: ReportInput) => api.request<CreateReportResponse>('/api/reports', { method: 'POST', body: input }),
  listMine: (page: number, limit = REPORTS_PAGE_SIZE) =>
    api.request<ReportPage>('/api/reports/me', { query: { page, limit } }),
};

/** Reasons in the order the screen lists them. */
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'closed', label: 'Địa điểm đã đóng cửa' },
  { value: 'incorrect_info', label: 'Thông tin chưa đúng' },
  { value: 'inappropriate', label: 'Nội dung không phù hợp' },
  { value: 'other', label: 'Lý do khác' },
];

export function reasonLabel(reason: ReportReason | undefined): string {
  return REPORT_REASONS.find((item) => item.value === reason)?.label ?? 'Lý do khác';
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Đang chờ',
  resolved: 'Đã xử lý',
  dismissed: 'Đã bỏ qua',
};
