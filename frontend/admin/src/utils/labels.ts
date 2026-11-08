import type {
  AdminPermission,
  Approval,
  BookingAction,
  BookingStatus,
  ClaimStatus,
  FraudStatus,
  ReportReason,
  ReportStatus,
  UserRole,
  UserStatus,
} from '../api/types';

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

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Chờ quán xác nhận',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã hủy',
  completed: 'Khách đã đến',
  no_show: 'Không đến',
};

export const BOOKING_ACTION_LABELS: Record<BookingAction, string> = {
  approve: 'Duyệt',
  reject: 'Từ chối',
  arrived: 'Khách đã đến',
  cancel: 'Hủy',
  no_show: 'Không đến',
};

/** Merchant claims and place change requests share these states. */
export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

export const FRAUD_STATUS_LABELS: Record<FraudStatus, string> = {
  pending: 'Chờ rà soát',
  resolved: 'Đã xác nhận gian lận',
  dismissed: 'Đã bỏ cờ',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  student: 'Sinh viên',
  merchant: 'Chủ quán',
  admin: 'Quản trị viên',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Đang hoạt động',
  suspended: 'Đã khóa',
  deleted: 'Đã xóa',
};

export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  '*': 'Toàn quyền (super admin)',
  users: 'Người dùng',
  places: 'Địa điểm, chủ quán, thay đổi quán',
  moderation: 'Báo cáo và đánh giá',
  bookings: 'Đặt chỗ',
  fraud: 'Check-in bất thường',
  audit: 'Nhật ký quản trị',
  analytics: 'Tổng quan',
};

export const DAY_LABELS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'] as const;

/** Audit `action` values written by adminController. Unknown actions keep their key in brackets. */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  'admin.promote': 'Cấp quyền quản trị',
  'admin.permissions': 'Đổi quyền quản trị',
  'admin.demote': 'Thu hồi quyền quản trị',
  'user.active': 'Mở khóa tài khoản',
  'user.suspended': 'Khóa tài khoản',
  'claim.approved': 'Duyệt hồ sơ chủ quán',
  'claim.rejected': 'Từ chối hồ sơ chủ quán',
  'booking.cancel': 'Hủy booking',
  'booking.approve': 'Duyệt booking',
  'booking.reject': 'Từ chối booking',
  'booking.arrived': 'Xác nhận khách đã đến',
  'booking.no_show': 'Ghi nhận không đến',
  'review_appeal.accepted': 'Chấp nhận khiếu nại đánh giá',
  'review_appeal.rejected': 'Từ chối khiếu nại đánh giá',
  'booking_dispute.accepted': 'Chấp nhận khiếu nại booking',
  'booking_dispute.rejected': 'Từ chối khiếu nại booking',
  'fraud.resolved': 'Xác nhận gian lận',
  'fraud.dismissed': 'Bỏ cờ gian lận',
  'place_change.approved': 'Duyệt thay đổi quán',
  'place_change.rejected': 'Từ chối thay đổi quán',
  'place.owner_transfer': 'Chuyển quyền quản lý quán',
  'place.approved': 'Duyệt địa điểm',
  'place.rejected': 'Từ chối địa điểm',
  'place.pending': 'Đưa địa điểm về chờ duyệt',
  'place.update': 'Sửa địa điểm',
  'place.image_add': 'Duyệt ảnh địa điểm',
  'place.image_remove': 'Gỡ ảnh địa điểm',
  'report.resolved': 'Xử lý báo cáo',
  'report.dismissed': 'Bỏ qua báo cáo',
  'review.hide': 'Ẩn đánh giá',
  'review.restore': 'Hiện lại đánh giá',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? `Thao tác khác (${action})`;
}

const TARGET_LABELS: Record<string, string> = {
  User: 'Tài khoản',
  Place: 'Địa điểm',
  MerchantClaim: 'Hồ sơ chủ quán',
  Booking: 'Booking',
  FraudFlag: 'Cờ gian lận',
  PlaceChangeRequest: 'Đề nghị thay đổi',
  Report: 'Báo cáo',
  Review: 'Đánh giá',
  SupportCase: 'Khiếu nại',
};

export function targetLabel(targetType: string): string {
  return TARGET_LABELS[targetType] ?? targetType;
}

/**
 * `FraudFlag.detail` is written by the backend in English, e.g. "12 km in 3 minutes".
 * Shown in Vietnamese; anything unexpected falls back to a general sentence.
 */
export function fraudDetailText(detail: string | null | undefined): string {
  const match = /^(\d+) km in (\d+) minutes?$/.exec((detail ?? '').trim());
  if (match) return `Di chuyển ${match[1]} km trong ${match[2]} phút giữa hai lần check-in.`;
  return 'Hai lần check-in liên tiếp cách nhau quá xa so với thời gian giữa chúng.';
}
