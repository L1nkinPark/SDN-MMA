# Dữ liệu khởi tạo quanh FPT TP.HCM, Lô E2a-7 đường D1

Tra cứu ngày 2026-11-01 cho bản demo StudySpot. Script `npm run seed:hcm -- <admin-email>` thêm bốn địa điểm sau, có thể chạy nhiều lần mà không tạo trùng. Dữ liệu là điểm khởi đầu để sinh viên kiểm tra và cập nhật, không phải kết quả khảo sát thực địa.

| Địa điểm | Nguồn tên/địa chỉ | Nguồn tọa độ | Độ chính xác |
|---|---|---|---|
| Thư viện Đại học FPT TP.HCM | [FPT University: campus và thư viện 3 tầng](https://daihoc.fpt.edu.vn/tat-tan-tat-ve-fptu/ban-do-truong-dai-hoc-fpt/) | [Tâm khuôn viên trên OpenStreetMap qua Mapcarta](https://mapcarta.com/W1022939891) | Xấp xỉ khuôn viên; chưa xác định cửa thư viện |
| Passio Coffee - FPT University | [FPT University giới thiệu Passio là nơi ôn bài](https://daihoc.fpt.edu.vn/chua-phan-loai/2k5-me-di-review-cho-bo-qua-nhung-quan-cafe-xinh-xeo-o-ngoi-truong-nay/) | [Foody: metadata vị trí](https://www.foody.vn/ho-chi-minh/passio-coffee-fpt-university) | Vị trí điểm từ danh bạ, chưa khảo sát |
| Laha Coffee - Khu Công Nghệ Cao | [Foody: tên, địa chỉ và vị trí](https://www.foody.vn/ho-chi-minh/laha-coffee-khu-cong-nghe-cao) | Cùng nguồn | Vị trí điểm từ danh bạ, chưa khảo sát |
| Trung Nguyên Legend Café - Khu Công Nghệ Cao | [Website Trung Nguyên Legend: danh sách chi nhánh](https://trungnguyenlegend.com/ban-do-khong-gian-ca-phe-nang-luong/) | [Foody: metadata vị trí](https://www.foody.vn/ho-chi-minh/trung-nguyen-legend-coffee-khu-cong-nghe-cao) | Vị trí điểm từ danh bạ, chưa khảo sát |

Các thông tin Wi‑Fi, ổ cắm và giá nước chưa xác minh được lưu là `null`. Trạng thái đông/ồn bắt đầu bằng `unknown` và chỉ cập nhật từ check-in có hiệu lực. Trước khi dùng ngoài bản demo, nên kiểm tra trực tiếp quán còn hoạt động, quyền vào cửa, giờ mở cửa, tọa độ lối vào và tiện ích.
