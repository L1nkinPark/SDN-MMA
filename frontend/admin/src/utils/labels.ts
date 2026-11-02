import type { Approval, ReportReason, ReportStatus } from '../api/types';

export const APPROVAL_LABELS: Record<Approval, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Chờ xử lý',
  resolved: 'Đã xử lý',
  dismissed: 'Đã bỏ qua',
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  closed: 'Địa điểm đã đóng cửa',
  incorrect_info: 'Thông tin chưa đúng',
  inappropriate: 'Nội dung không phù hợp',
  other: 'Lý do khác',
};
