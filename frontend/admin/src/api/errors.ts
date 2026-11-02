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
export const TOO_FAST_MESSAGE = 'Bạn thao tác quá nhanh. Đợi một lúc rồi thử lại.';
export const SERVER_MESSAGE = 'Máy chủ đang gặp sự cố. Thử lại sau.';

const exactMessages: Record<number, Record<string, string>> = {
  400: {
    'No changes supplied': 'Chưa có thay đổi nào để lưu.',
    'JPEG, PNG, or WebP image required (max 5 MB)': 'Chỉ nhận ảnh JPEG, PNG hoặc WebP, tối đa 5 MB.',
    'File content does not match a supported image format': 'Nội dung tệp không phải ảnh JPEG, PNG hoặc WebP.',
    'File too large': 'Ảnh lớn hơn 5 MB.',
  },
  401: { 'Invalid email or password': WRONG_CREDENTIALS_MESSAGE },
  403: { 'Admin access required': NOT_ADMIN_MESSAGE },
  404: {
    'Place not found': 'Không tìm thấy địa điểm.',
    'Review not found': 'Không tìm thấy đánh giá.',
    'Report not found': 'Không tìm thấy báo cáo.',
  },
  409: { 'Resource already exists': 'Dữ liệu này đã tồn tại.' },
  503: { 'Cloudinary is not configured': 'Máy chủ chưa cấu hình tải ảnh (Cloudinary).' },
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
    case 403:
      return NOT_ADMIN_MESSAGE;
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
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorMessage(error: unknown): string {
  return isApiError(error) ? error.message : GENERIC_MESSAGE;
}
