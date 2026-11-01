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
