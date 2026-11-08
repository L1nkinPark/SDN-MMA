# Quy tắc xử lý tranh chấp StudySpot

## Nguyên tắc chung

- GPS chứng minh thiết bị ở gần quán, không chứng minh khách đã vào hoặc ngồi tại quán. Không dùng GPS đơn lẻ để khôi phục quyền đánh giá.
- Mỗi quyết định cần nêu căn cứ, người xử lý, thời điểm và được ghi vào `AuditEvent`. Trạng thái cuối chỉ được quyết định một lần.
- Trong khi hồ sơ đang chờ, dữ liệu gốc giữ nguyên. Khiếu nại bị bác không tự động trừ uy tín người gửi.
- Không công khai chứng từ đăng ký chủ quán, biên lai hoặc dữ liệu vị trí chính xác cho người dùng khác.

## Các luồng đã hỗ trợ

| Tình huống | Người gửi và hạn | Căn cứ admin phải xem | Kết quả |
| --- | --- | --- | --- |
| Booking bị ghi `no_show` | Người đặt; 7 ngày từ `noShowAt`; một hồ sơ/booking | Booking, giờ đến, thao tác của quán, nhật ký QR/nhân viên, biên lai hoặc nguồn chứng cứ khác | Chấp nhận: `completed` và `VisitProof`, không giữ lại ghế của khung giờ đã qua. Bác: giữ `no_show`. |
| Đánh giá bị ẩn | Tác giả; 14 ngày từ `hiddenAt`; một hồ sơ/review | Nội dung, lý do ẩn, `VisitProof` cùng user và quán | Chấp nhận: hiện lại review và tính lại điểm đúng quán. Bác: giữ ẩn. |
| Hai hồ sơ cùng nhận quyền quản lý quán | Người xin quyền nộp chứng từ; admin duyệt từng claim | Chứng từ kinh doanh, quyền quản lý hiện tại, lịch sử claim | Một quán chỉ có một `owner`; hồ sơ khác bị bác khi một claim được duyệt. Chuyển owner do admin thực hiện có lý do. |

Với khiếu nại `no_show`, admin phải chọn `evidenceSource` và ghi `evidenceSummary` ít nhất 20 ký tự khi chấp nhận. Lời trình bày của khách một mình không đủ. `SupportCase` lưu kết luận và thời điểm; quyết định gửi thông báo đến khách. Kháng nghị đánh giá chỉ được chấp nhận khi review còn gắn với `VisitProof` đúng người và đúng quán.

## Phạm vi chưa có luồng khiếu nại riêng

- Khách/chủ phản đối booking bị hủy, lý do hủy hoặc việc quán không giữ ghế: hiện chỉ có lịch sử booking, lý do hủy và audit; chưa có loại `SupportCase` tương ứng hay cơ chế bồi hoàn.
- Chủ hiện tại phản đối claim hoặc quyết định chuyển quyền quán: hiện admin phải đối chiếu ngoại tuyến; chưa có cổng phản đối hai phía.
- Người bị ảnh hưởng kháng nghị quyết định xử lý báo cáo/cờ gian lận: hiện có xử lý và audit, chưa có vòng kháng nghị.
- Chưa có thời hạn xử lý bắt buộc, nhắc admin khi quá hạn hoặc vòng tái khiếu nại. Không hứa SLA với người dùng khi chưa vận hành được.

Các mục này được đánh dấu rõ trong bảng nghiệp vụ, không xem như chức năng đã triển khai.
