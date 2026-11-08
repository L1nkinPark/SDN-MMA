/** Client-side checks that mirror the backend's Zod rules, so most 400s never happen. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL.test(email.trim());
}

/** Length after trimming, as the backend trims before checking. */
export function trimmedLength(value: string): number {
  return value.trim().length;
}

export function emailError(email: string): string | null {
  return isValidEmail(email) ? null : 'Email chưa đúng định dạng.';
}

export function passwordError(password: string): string | null {
  if (password.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
  if (password.length > 128) return 'Mật khẩu tối đa 128 ký tự.';
  return null;
}

export function nameError(name: string): string | null {
  const length = trimmedLength(name);
  if (length < 2) return 'Họ tên cần ít nhất 2 ký tự.';
  if (length > 80) return 'Họ tên tối đa 80 ký tự.';
  return null;
}

export function ratingError(rating: number): string | null {
  return rating >= 1 && rating <= 5 ? null : 'Hãy chọn số sao.';
}

export function reviewTextError(text: string): string | null {
  const length = trimmedLength(text);
  if (length < 3) return 'Nhận xét cần ít nhất 3 ký tự.';
  if (length > 1000) return 'Nhận xét tối đa 1.000 ký tự.';
  return null;
}

export function reportDetailError(detail: string): string | null {
  const length = trimmedLength(detail);
  if (length < 10) return 'Chi tiết cần ít nhất 10 ký tự.';
  if (length > 2000) return 'Chi tiết tối đa 2.000 ký tự.';
  return null;
}

export function placeNameError(name: string): string | null {
  const length = trimmedLength(name);
  if (length < 2) return 'Tên cần ít nhất 2 ký tự.';
  if (length > 120) return 'Tên tối đa 120 ký tự.';
  return null;
}

export function addressError(address: string): string | null {
  const length = trimmedLength(address);
  if (length < 5) return 'Địa chỉ cần ít nhất 5 ký tự.';
  if (length > 300) return 'Địa chỉ tối đa 300 ký tự.';
  return null;
}

export function descriptionError(description: string): string | null {
  return trimmedLength(description) > 2000 ? 'Mô tả tối đa 2.000 ký tự.' : null;
}

/**
 * Parses a price typed as "25.000", "25,000" or "25000". Empty means null (unverified).
 * Returns undefined when the text isn't a whole number of đồng.
 */
export function parsePrice(text: string): number | null | undefined {
  const compact = text.replace(/\s/g, '');
  if (!compact) return null;
  if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(compact)) return undefined;
  return Number(compact.replace(/[.,]/g, ''));
}

export function priceError(text: string): string | null {
  return parsePrice(text) === undefined ? 'Giá cần là số đồng, ví dụ 25.000.' : null;
}

/** The code in the reset email is 64 hex characters; the backend accepts 32 to 256. */
export function resetCodeError(code: string): string | null {
  const length = trimmedLength(code);
  if (length === 0) return 'Nhập mã trong email.';
  if (length < 32 || length > 256) return 'Mã chưa đúng. Hãy sao chép đủ mã trong email.';
  return null;
}

export function confirmPasswordError(password: string, confirmation: string): string | null {
  return password === confirmation ? null : 'Mật khẩu nhập lại chưa khớp.';
}
