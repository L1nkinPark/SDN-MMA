import { emailError, isValidEmail, nameError, passwordError } from '../validation';

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
    expect(nameError(' A ')).toBe('Tên cần ít nhất 2 ký tự.');
    expect(nameError('An')).toBeNull();
    expect(nameError('x'.repeat(81))).toBe('Tên tối đa 80 ký tự.');
  });
});
