import {
  addressError,
  confirmPasswordError,
  resetCodeError,
  descriptionError,
  emailError,
  isValidEmail,
  nameError,
  parsePrice,
  passwordError,
  placeNameError,
  priceError,
  ratingError,
  reviewTextError,
} from '../validation';

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

describe('place proposal validation', () => {
  it('checks name, address and description lengths', () => {
    expect(placeNameError('A')).toBe('Tên cần ít nhất 2 ký tự.');
    expect(placeNameError('x'.repeat(121))).toBe('Tên tối đa 120 ký tự.');
    expect(addressError('D1')).toBe('Địa chỉ cần ít nhất 5 ký tự.');
    expect(addressError('Đường D1, Khu Công nghệ cao')).toBeNull();
    expect(descriptionError('')).toBeNull();
    expect(descriptionError('x'.repeat(2001))).toBe('Mô tả tối đa 2.000 ký tự.');
  });

  it('parses prices; empty is null', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('  ')).toBeNull();
    expect(parsePrice('25.000')).toBe(25000);
    expect(parsePrice('25,000')).toBe(25000);
    expect(parsePrice('25000')).toBe(25000);
    expect(parsePrice('25k')).toBeUndefined();
    expect(parsePrice('-5')).toBeUndefined();
    expect(priceError('abc')).toBe('Giá cần là số đồng, ví dụ 25.000.');
  });

  it('checks the reset code and the repeated password', () => {
    expect(resetCodeError('')).toBe('Nhập mã trong email.');
    expect(resetCodeError('abc')).toBe('Mã chưa đúng. Hãy sao chép đủ mã trong email.');
    expect(resetCodeError(` ${'a'.repeat(64)} `)).toBeNull();
    expect(confirmPasswordError('Password1', 'Password1')).toBeNull();
    expect(confirmPasswordError('Password1', 'Password2')).toBe('Mật khẩu nhập lại chưa khớp.');
  });
});
