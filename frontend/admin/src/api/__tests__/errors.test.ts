import { describe, expect, it } from 'vitest';

import { ApiError, vietnameseMessage } from '../errors';

describe('admin error mapping', () => {
  it.each([
    [403, 'Admin access required', 'Tài khoản này không có quyền quản trị.'],
    [400, 'No changes supplied', 'Chưa có thay đổi nào để lưu.'],
    [400, 'File too large', 'Ảnh lớn hơn 5 MB.'],
    [400, 'name: Too small', 'Thông tin chưa hợp lệ. Kiểm tra lại rồi thử lần nữa.'],
    [404, 'Report not found', 'Không tìm thấy báo cáo.'],
    [503, 'Cloudinary is not configured', 'Máy chủ chưa cấu hình tải ảnh (Cloudinary).'],
    [500, 'boom', 'Máy chủ đang gặp sự cố. Thử lại sau.'],
    [429, 'Too many requests', 'Bạn thao tác quá nhanh. Đợi một lúc rồi thử lại.'],
    [null, null, 'Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'],
    [403, 'Account unavailable', 'Tài khoản đang bị khóa hoặc đã bị xóa. Liên hệ quản trị viên nếu có nhầm lẫn.'],
    [403, 'Admin permission required: users', 'Tài khoản của bạn chưa được cấp quyền cho thao tác này.'],
    [403, 'Merchant access required', 'Chỉ chủ quán đã được duyệt mới làm được thao tác này.'],
    [409, 'Possible duplicate place: 6650aa', 'Đã có một địa điểm cùng tên trong bán kính 100 m. Kiểm tra lại trước khi gửi.'],
    [
      409,
      'Cancel affected future bookings before changing availability',
      'Còn booking sắp tới bị ảnh hưởng bởi thay đổi này. Hãy hủy hoặc xử lý các booking đó trước rồi lưu lại.',
    ],
    [409, 'Outside arrival window', 'Chỉ xác nhận khách đến trong khoảng 15 phút trước và sau giờ đặt.'],
  ])('%s %s', (status, message, expected) => {
    expect(vietnameseMessage(status, message)).toBe(expected);
  });

  it('never exposes English text', () => {
    expect(new ApiError(418, 'I am a teapot').message).not.toContain('teapot');
  });
});
