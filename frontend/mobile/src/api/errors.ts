/**
 * The only place that turns backend errors into Vietnamese text.
 * Screens read `status` to pick a state and `message` to show text; never show `serverMessage`.
 */

export const NETWORK_MESSAGE = 'Chưa kết nối được. Kiểm tra mạng rồi thử lại.';
export const GENERIC_MESSAGE = 'Đã có lỗi xảy ra. Thử lại sau.';
export const INVALID_INPUT_MESSAGE = 'Thông tin chưa hợp lệ. Kiểm tra lại rồi thử lần nữa.';
export const WRONG_CREDENTIALS_MESSAGE = 'Email hoặc mật khẩu không đúng. Kiểm tra lại rồi thử lần nữa.';
export const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
export const TOO_FAST_MESSAGE = 'Bạn thao tác quá nhanh. Đợi một lúc rồi thử lại.';
export const SERVER_MESSAGE = 'Máy chủ đang gặp sự cố. Thử lại sau.';

export const ACCOUNT_UNAVAILABLE_MESSAGE = 'Tài khoản đang bị khóa hoặc đã bị xóa. Liên hệ quản trị viên nếu có nhầm lẫn.';
export const EMAIL_UNAVAILABLE_MESSAGE = 'Máy chủ chưa gửi được email lúc này. Thử lại sau hoặc liên hệ quản trị viên.';

/** Exact backend messages that have their own Vietnamese text. */
const exactMessages: Record<number, Record<string, string>> = {
  400: {
    'Booking must be 1 hour to 14 days ahead': 'Chỉ đặt được chỗ trước ít nhất 1 giờ và không quá 14 ngày.',
    'Start time must align with slot duration': 'Giờ đến phải trùng với một khung giờ của quán.',
    'Invalid or expired reset token': 'Mã đặt lại không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới.',
    'New password must differ': 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    'No changes supplied': 'Chưa có thay đổi nào để lưu.',
  },
  401: { 'Invalid email or password': WRONG_CREDENTIALS_MESSAGE },
  403: {
    'Check-in requires location within 250 meters': 'Chỉ check-in được khi ở trong bán kính 250 m.',
    'This review was hidden by moderation': 'Đánh giá của bạn đã bị ẩn bởi quản trị viên.',
    'Verified visit required to review': 'Bạn cần quét mã QR tại quầy hoặc được quán xác nhận đã đến trong 14 ngày gần đây trước khi đánh giá.',
    'Account unavailable': ACCOUNT_UNAVAILABLE_MESSAGE,
    'Invalid or expired visit code': 'Mã QR đã hết hạn hoặc không hợp lệ. Nhờ quán tạo mã mới rồi quét lại.',
    'Visit code does not belong to this place': 'Mã QR này không phải của địa điểm bạn đang check-in.',
    'Verified visit requires accurate location within 100 meters':
      'Để xác minh bằng QR, bạn cần ở trong quán (cách tối đa 100 m) và GPS chính xác dưới 50 m.',
    'Owner cannot check in at own place': 'Chủ quán không check-in tại quán của mình.',
    'Owner cannot review own place': 'Chủ quán không đánh giá quán của mình.',
    'Owner cannot book own place': 'Chủ quán không đặt chỗ tại quán của mình.',
    'Current password incorrect': 'Mật khẩu hiện tại không đúng.',
    'Password incorrect': 'Mật khẩu không đúng.',
    'Admin account cannot self-delete': 'Tài khoản quản trị không tự xóa được.',
  },
  404: {
    'Place not found': 'Không tìm thấy địa điểm.',
    'Review not found': 'Không tìm thấy đánh giá.',
    'Unread notification not found': 'Thông báo này đã được đọc.',
  },
  409: {
    'You already have a pending report for this place': 'Bạn đã có một báo cáo đang chờ xử lý cho địa điểm này.',
    'Resource already exists': 'Email này đã có tài khoản. Hãy đăng nhập.',
    'Booking unavailable': 'Quán hiện không nhận đặt chỗ.',
    'Booking capacity not configured': 'Quán chưa cấu hình số chỗ nên chưa nhận đặt chỗ.',
    'Place is closed on this date': 'Quán nghỉ vào ngày này.',
    'Outside opening hours': 'Khung giờ này nằm ngoài giờ mở cửa của quán.',
    'Party size exceeds slot capacity': 'Số người vượt quá số chỗ của một khung giờ.',
    'Slot is full': 'Khung giờ này đã hết chỗ. Hãy chọn giờ khác.',
    'Maximum 3 upcoming bookings': 'Bạn đang giữ 3 lượt đặt chỗ sắp tới. Hủy bớt một lượt để đặt thêm.',
    'Booking cannot be cancelled': 'Không hủy được: chỉ hủy được trước giờ đến ít nhất 1 giờ.',
  },
  429: { 'Wait 15 minutes before another check-in at this place': 'Bạn vừa check-in ở đây. Đợi 15 phút rồi thử lại.' },
  503: { 'Email delivery is not configured': EMAIL_UNAVAILABLE_MESSAGE },
};

/** Vietnamese text for an HTTP status and backend message. `status` null means a network failure. */
export function vietnameseMessage(status: number | null, serverMessage?: string | null): string {
  if (status === null) return NETWORK_MESSAGE;
  const exact = serverMessage ? exactMessages[status]?.[serverMessage.trim()] : undefined;
  if (exact) return exact;
  if (status >= 500) return SERVER_MESSAGE;
  switch (status) {
    case 400:
      return INVALID_INPUT_MESSAGE;
    case 401:
      return SESSION_EXPIRED_MESSAGE;
    case 429:
      return TOO_FAST_MESSAGE;
    default:
      return GENERIC_MESSAGE;
  }
}

export type ApiErrorKind = 'http' | 'network';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status, or null for a network failure. */
  readonly status: number | null;
  /** Raw backend text, for matching only. Never display it. */
  readonly serverMessage: string | null;

  constructor(status: number | null, serverMessage: string | null = null) {
    super(vietnameseMessage(status, serverMessage));
    this.name = 'ApiError';
    this.kind = status === null ? 'network' : 'http';
    this.status = status;
    this.serverMessage = serverMessage;
  }

  static network(): ApiError {
    return new ApiError(null);
  }

  /** True when the backend sent exactly this message. */
  is(status: number, serverMessage?: string): boolean {
    return this.status === status && (serverMessage === undefined || this.serverMessage === serverMessage);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Vietnamese text for any thrown value. */
export function errorMessage(error: unknown): string {
  return isApiError(error) ? error.message : GENERIC_MESSAGE;
}

/** The backend answers 403 `Account unavailable` for suspended or deleted accounts on every authenticated call. */
export function isAccountUnavailable(error: unknown): boolean {
  return isApiError(error) && error.is(403, 'Account unavailable');
}

/** HTTP status of a thrown value, if it is an API error. */
export function errorStatus(error: unknown): number | null {
  return isApiError(error) ? error.status : null;
}
