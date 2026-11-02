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
  ])('%s %s', (status, message, expected) => {
    expect(vietnameseMessage(status, message)).toBe(expected);
  });

  it('never exposes English text', () => {
    expect(new ApiError(418, 'I am a teapot').message).not.toContain('teapot');
  });
});
