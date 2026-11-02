/** Client-side checks that mirror the backend's Zod rules. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function length(value: string): number {
  return value.trim().length;
}

export function emailError(email: string): string | null {
  return EMAIL.test(email.trim()) ? null : 'Email chưa đúng định dạng.';
}

export function passwordError(password: string): string | null {
  if (password.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
  if (password.length > 128) return 'Mật khẩu tối đa 128 ký tự.';
  return null;
}

export function placeNameError(name: string): string | null {
  if (length(name) < 2) return 'Tên cần ít nhất 2 ký tự.';
  if (length(name) > 120) return 'Tên tối đa 120 ký tự.';
  return null;
}

export function addressError(address: string): string | null {
  if (length(address) < 5) return 'Địa chỉ cần ít nhất 5 ký tự.';
  if (length(address) > 300) return 'Địa chỉ tối đa 300 ký tự.';
  return null;
}

export function descriptionError(description: string): string | null {
  return length(description) > 2000 ? 'Mô tả tối đa 2.000 ký tự.' : null;
}

/** Parses a decimal typed with a dot or a comma. Returns undefined when it isn't a number. */
export function parseDecimal(text: string): number | undefined {
  const compact = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(compact)) return undefined;
  return Number(compact);
}

export function latitudeError(text: string): string | null {
  const value = parseDecimal(text);
  return value === undefined || value < -90 || value > 90 ? 'Vĩ độ là số từ -90 đến 90, ví dụ 10.8411.' : null;
}

export function longitudeError(text: string): string | null {
  const value = parseDecimal(text);
  return value === undefined || value < -180 || value > 180 ? 'Kinh độ là số từ -180 đến 180, ví dụ 106.8098.' : null;
}

/** "25.000", "25,000" or "25000". Empty means null (unverified); undefined means invalid. */
export function parsePrice(text: string): number | null | undefined {
  const compact = text.replace(/\s/g, '');
  if (!compact) return null;
  if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(compact)) return undefined;
  return Number(compact.replace(/[.,]/g, ''));
}

export function priceError(text: string): string | null {
  return parsePrice(text) === undefined ? 'Giá cần là số đồng, ví dụ 25.000.' : null;
}
