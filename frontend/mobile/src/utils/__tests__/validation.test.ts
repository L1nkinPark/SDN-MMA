import { emailError, isValidEmail, nameError, passwordError, ratingError, reviewTextError } from '../validation';

describe('validation', () => {
  it('checks email format', () => {
    expect(isValidEmail('sinhvien@fpt.edu.vn')).toBe(true);
    expect(isValidEmail('  sinhvien@fpt.edu.vn ')).toBe(true);
    expect(isValidEmail('sinhvien@fpt')).toBe(false);
    expect(emailError('')).toBe('Email chưa đúng định dạng.');
  });

  it('checks password length 8 to 128', () => {
    expect(passwordError('1234')).toBe('Mật khẩu cần ít nhất 8 ký tự.');
    expect(passwordError('12345678')).toBeNull();
    expect(passwordError('x'.repeat(129))).toBe('Mật khẩu tối đa 128 ký tự.');
  });

  it('checks trimmed name length 2 to 80', () => {
    expect(nameError(' A ')).toBe('Họ tên cần ít nhất 2 ký tự.');
    expect(nameError('An')).toBeNull();
    expect(nameError('x'.repeat(81))).toBe('Họ tên tối đa 80 ký tự.');
  });

  it('checks review rating 1 to 5 and text 3 to 1000', () => {
    expect(ratingError(0)).toBe('Hãy chọn số sao.');
    expect(ratingError(5)).toBeNull();
    expect(reviewTextError(' Ok ')).toBe('Nhận xét cần ít nhất 3 ký tự.');
    expect(reviewTextError('Tốt')).toBeNull();
    expect(reviewTextError('x'.repeat(1001))).toBe('Nhận xét tối đa 1.000 ký tự.');
  });
});
