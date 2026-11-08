/**
 * The only place that turns backend errors into Vietnamese text.
 * Pages read `status` to pick a state and `message` to show text; never show `serverMessage`.
 */

export const NETWORK_MESSAGE = 'Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
export const GENERIC_MESSAGE = 'Đã có lỗi xảy ra. Thử lại sau.';
export const INVALID_INPUT_MESSAGE = 'Thông tin chưa hợp lệ. Kiểm tra lại rồi thử lần nữa.';
export const WRONG_CREDENTIALS_MESSAGE = 'Email hoặc mật khẩu không đúng. Kiểm tra lại rồi thử lần nữa.';
export const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.';
export const NOT_ADMIN_MESSAGE = 'Tài khoản này không có quyền quản trị.';
export const NO_PERMISSION_MESSAGE = 'Tài khoản của bạn chưa được cấp quyền cho thao tác này.';
export const ACCOUNT_UNAVAILABLE_MESSAGE = 'Tài khoản đang bị khóa hoặc đã bị xóa. Liên hệ quản trị viên nếu có nhầm lẫn.';
export const TOO_FAST_MESSAGE = 'Bạn thao tác quá nhanh. Đợi một lúc rồi thử lại.';
export const SERVER_MESSAGE = 'Máy chủ đang gặp sự cố. Thử lại sau.';
export const BOOKINGS_BLOCK_MESSAGE =
  'Còn booking sắp tới bị ảnh hưởng bởi thay đổi này. Hãy hủy hoặc xử lý các booking đó trước rồi lưu lại.';

const exactMessages: Record<number, Record<string, string>> = {
  400: {
    'No changes supplied': 'Chưa có thay đổi nào để lưu.',
    'JPEG, PNG, or WebP image required (max 5 MB)': 'Chỉ nhận ảnh JPEG, PNG hoặc WebP, tối đa 5 MB.',
    'File content does not match a supported image format': 'Nội dung tệp không phải ảnh JPEG, PNG hoặc WebP.',
    'File too large': 'Ảnh lớn hơn 5 MB.',
    'Invalid opening hours': 'Giờ mở cửa chưa hợp lệ: mỗi ngày chỉ một khung và giờ mở phải trước giờ đóng.',
    'Closed dates must be unique and within the next year': 'Ngày nghỉ phải khác nhau, từ hôm nay đến tối đa 1 năm tới.',
    'Invalid or expired reset token': 'Mã đặt lại không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới.',
    'New password must differ': 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    'Invalid ID': 'Mã không hợp lệ.',
  },
  401: { 'Invalid email or password': WRONG_CREDENTIALS_MESSAGE },
  403: {
    'Admin access required': NOT_ADMIN_MESSAGE,
    'Account unavailable': ACCOUNT_UNAVAILABLE_MESSAGE,
    'Merchant access required': 'Chỉ chủ quán đã được duyệt mới làm được thao tác này.',
    'Place ownership required': 'Bạn không quản lý địa điểm của booking này.',
    'Current password incorrect': 'Mật khẩu hiện tại không đúng.',
    'Cannot change own status': 'Không thể tự khóa hoặc mở tài khoản của mình.',
    'Cannot change own admin permissions': 'Không thể tự đổi quyền của mình.',
    'Cannot remove own admin role': 'Không thể tự thu hồi quyền quản trị của mình.',
  },
  404: {
    'Place not found': 'Không tìm thấy địa điểm.',
    'Review not found': 'Không tìm thấy đánh giá.',
    'Report not found': 'Không tìm thấy báo cáo.',
    'Approved place not found': 'Không tìm thấy địa điểm đã duyệt này.',
    'Owned place not found': 'Không tìm thấy quán bạn quản lý (quán phải đã được duyệt).',
    'Booking not found': 'Không tìm thấy booking.',
    'Admin not found': 'Không tìm thấy quản trị viên.',
    'Non-admin user not found': 'Không tìm thấy tài khoản (không áp dụng cho quản trị viên).',
    'New owner not found': 'Không tìm thấy tài khoản đang hoạt động để nhận quyền.',
    'Unread notification not found': 'Thông báo này đã được đọc.',
  },
  409: {
    'Resource already exists': 'Dữ liệu này đã tồn tại.',
    'Maximum 3 pending place submissions': 'Bạn đang có 3 hồ sơ quán chờ duyệt. Đợi admin xử lý rồi gửi thêm.',
    'Place already has an owner': 'Quán này đã có chủ quản lý.',
    'Pending claim already exists': 'Bạn đã gửi hồ sơ cho quán này và đang chờ duyệt.',
    'Pending change already exists': 'Quán đang có một đề nghị thay đổi chờ duyệt. Đợi admin xử lý trước.',
    'Place is temporarily closed': 'Quán đang tạm đóng cửa nên không tạo mã QR.',
    'Cancel future bookings before changing slot duration or capacity': BOOKINGS_BLOCK_MESSAGE,
    'Cancel affected future bookings before changing availability': BOOKINGS_BLOCK_MESSAGE,
    'Booking already started': 'Booking đã đến giờ bắt đầu nên không duyệt hoặc hủy được nữa.',
    'Pending booking not found': 'Booking này không còn chờ duyệt.',
    'Outside arrival window': 'Chỉ xác nhận khách đến trong khoảng 15 phút trước và sau giờ đặt.',
    'Too early to mark no-show': 'Chỉ đánh dấu không đến sau giờ đặt 15 phút.',
    'Booking already processed': 'Booking này đã được xử lý.',
    'Pending claim not found': 'Hồ sơ này không còn chờ duyệt.',
    'Claim already decided': 'Hồ sơ này đã được xử lý.',
    'Place already owned or unavailable': 'Quán đã có chủ hoặc không còn được duyệt.',
    'Pending change not found': 'Đề nghị này không còn chờ duyệt.',
    'Place ownership changed': 'Quyền quản lý quán đã thay đổi; đề nghị này không áp dụng được.',
    'Pending fraud flag not found': 'Cờ này đã được xử lý.',
    'Active booking not found': 'Booking không còn hiệu lực để hủy.',
    'Eligible user not found': 'Tài khoản không đủ điều kiện (phải đang hoạt động và chưa là quản trị viên).',
  },
  503: {
    'Cloudinary is not configured': 'Máy chủ chưa cấu hình tải ảnh (Cloudinary).',
    'Email delivery is not configured': 'Máy chủ chưa gửi được email lúc này. Thử lại sau hoặc liên hệ quản trị viên.',
  },
};

/** Vietnamese text for an HTTP status and backend message. `status` null means a network failure. */
export function vietnameseMessage(status: number | null, serverMessage?: string | null): string {
  if (status === null) return NETWORK_MESSAGE;
  const message = serverMessage?.trim() ?? '';
  const exact = message ? exactMessages[status]?.[message] : undefined;
  if (exact) return exact;
  if (status === 409 && message.startsWith('Possible duplicate place')) {
    return 'Đã có một địa điểm cùng tên trong bán kính 100 m. Kiểm tra lại trước khi gửi.';
  }
  if (status === 403 && message.startsWith('Admin permission required')) return NO_PERMISSION_MESSAGE;
  if (status >= 500) return SERVER_MESSAGE;
  switch (status) {
    case 400:
      return INVALID_INPUT_MESSAGE;
    case 401:
      return SESSION_EXPIRED_MESSAGE;
    case 403:
      return NO_PERMISSION_MESSAGE;
    case 429:
      return TOO_FAST_MESSAGE;
    default:
      return GENERIC_MESSAGE;
  }
}

export class ApiError extends Error {
  readonly kind: 'http' | 'network';
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

  /** True when the backend sent exactly this status, and this message if one is given. */
  is(status: number, serverMessage?: string): boolean {
    return this.status === status && (serverMessage === undefined || this.serverMessage === serverMessage);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorMessage(error: unknown): string {
  return isApiError(error) ? error.message : GENERIC_MESSAGE;
}

export function errorStatus(error: unknown): number | null {
  return isApiError(error) ? error.status : null;
}
