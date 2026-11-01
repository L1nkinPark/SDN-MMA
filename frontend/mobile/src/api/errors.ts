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

/** Exact backend messages that have their own Vietnamese text. */
const exactMessages: Record<number, Record<string, string>> = {
  401: { 'Invalid email or password': WRONG_CREDENTIALS_MESSAGE },
  403: {
    'Check-in requires location within 250 meters': 'Chỉ check-in được khi ở trong bán kính 250 m.',
    'This review was hidden by moderation': 'Đánh giá của bạn đã bị ẩn bởi quản trị viên.',
  },
  404: {
    'Place not found': 'Không tìm thấy địa điểm.',
    'Review not found': 'Không tìm thấy đánh giá.',
  },
  409: {
    'You already have a pending report for this place': 'Bạn đã có một báo cáo đang chờ xử lý cho địa điểm này.',
    'Resource already exists': 'Email này đã có tài khoản. Hãy đăng nhập.',
  },
  429: { 'Wait 15 minutes before another check-in at this place': 'Bạn vừa check-in ở đây. Đợi 15 phút rồi thử lại.' },
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

/** HTTP status of a thrown value, if it is an API error. */
export function errorStatus(error: unknown): number | null {
  return isApiError(error) ? error.status : null;
}
