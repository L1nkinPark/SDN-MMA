import { ApiError, errorMessage, vietnameseMessage } from '../errors';

describe('error mapping', () => {
  it.each([
    [400, 'email: Invalid email', 'Thông tin chưa hợp lệ. Kiểm tra lại rồi thử lần nữa.'],
    [401, 'Invalid email or password', 'Email hoặc mật khẩu không đúng. Kiểm tra lại rồi thử lần nữa.'],
    [401, 'Invalid or expired token', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'],
    [403, 'Check-in requires location within 250 meters', 'Chỉ check-in được khi ở trong bán kính 250 m.'],
    [403, 'This review was hidden by moderation', 'Đánh giá của bạn đã bị ẩn bởi quản trị viên.'],
    [404, 'Place not found', 'Không tìm thấy địa điểm.'],
    [404, 'Review not found', 'Không tìm thấy đánh giá.'],
    [409, 'You already have a pending report for this place', 'Bạn đã có một báo cáo đang chờ xử lý cho địa điểm này.'],
    [409, 'Resource already exists', 'Email này đã có tài khoản. Hãy đăng nhập.'],
    [429, 'Wait 15 minutes before another check-in at this place', 'Bạn vừa check-in ở đây. Đợi 15 phút rồi thử lại.'],
    [429, 'Too many requests, please try again later.', 'Bạn thao tác quá nhanh. Đợi một lúc rồi thử lại.'],
    [403, 'Account unavailable', 'Tài khoản đang bị khóa hoặc đã bị xóa. Liên hệ quản trị viên nếu có nhầm lẫn.'],
    [403, 'Invalid or expired visit code', 'Mã QR đã hết hạn hoặc không hợp lệ. Nhờ quán tạo mã mới rồi quét lại.'],
    [409, 'Slot is full', 'Khung giờ này đã hết chỗ. Hãy chọn giờ khác.'],
    [409, 'Booking time overlaps another upcoming booking', 'Bạn đã đặt chỗ ở một quán khác trong khoảng thời gian này. Hãy chọn giờ không trùng.'],
    [409, 'Booking request is still processing', 'Yêu cầu đặt chỗ đang được xử lý. Đợi một chút rồi thử lại.'],
    [409, 'Maximum 3 upcoming bookings', 'Bạn đang giữ 3 lượt đặt chỗ sắp tới. Hủy bớt một lượt để đặt thêm.'],
    [400, 'Booking must be 1 hour to 14 days ahead', 'Chỉ đặt được chỗ trước ít nhất 1 giờ và không quá 14 ngày.'],
    [403, 'Current password incorrect', 'Mật khẩu hiện tại không đúng.'],
    [503, 'Email delivery is not configured', 'Máy chủ chưa gửi được email lúc này. Thử lại sau hoặc liên hệ quản trị viên.'],
    [500, 'Internal server error', 'Máy chủ đang gặp sự cố. Thử lại sau.'],
    [503, 'Image upload is not configured', 'Máy chủ đang gặp sự cố. Thử lại sau.'],
    [null, null, 'Chưa kết nối được. Kiểm tra mạng rồi thử lại.'],
  ])('%s %s', (status, message, expected) => {
    expect(vietnameseMessage(status, message)).toBe(expected);
  });

  it('never exposes the English text', () => {
    const error = new ApiError(418, 'I am a teapot');
    expect(error.message).not.toContain('teapot');
    expect(error.serverMessage).toBe('I am a teapot');
    expect(error.status).toBe(418);
  });

  it('gives a Vietnamese fallback for unknown errors', () => {
    expect(errorMessage(new Error('boom'))).toBe('Đã có lỗi xảy ra. Thử lại sau.');
  });
});
