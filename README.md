# StudySpot Backend

Backend cho ứng dụng tìm chỗ học quanh trường. Dự án dùng Node.js + Express + MongoDB/Mongoose, tổ chức theo MVC trong một modular monolith. Socket.IO phát thay đổi trạng thái sau khi ghi vào DB. Ảnh địa điểm được lưu ở Cloudinary nếu có cấu hình.

Sơ đồ chỉnh sửa được bằng diagrams.net/draw.io: [`docs/StudySpot-ERD-System-Architecture.drawio`](docs/StudySpot-ERD-System-Architecture.drawio), gồm hai trang ERD MongoDB và kiến trúc hệ thống. Có thể tạo lại từ model hiện tại bằng `python scripts/generate-diagrams.py`.

Để xem ERD đủ trường và quan hệ trong MongoDB Compass khi các collection thật chưa có dữ liệu, chạy `npm run seed:erd-demo`. Lệnh tạo database riêng `studyspot_erd_demo` với một bộ document minh họa cho cả 7 collection và index tham chiếu giúp Compass suy luận quan hệ; database `studyspot` đang dùng cho ứng dụng không bị sửa. Trong Compass, vào **Data Modeling → Generate diagram**, chọn database `studyspot_erd_demo`, chọn cả 7 collection, bật **Automatically infer relationships**. Diagram sinh từ dữ liệu mẫu, còn file draw.io mô tả model trong mã nguồn.

Bản ERD Compass đã xuất: [`docs/StudySpot-Compass-Full-ERD.mdm`](docs/StudySpot-Compass-Full-ERD.mdm). Dùng **Data Modeling → Import diagram** để mở lại hoặc chia sẻ sơ đồ này mà không cần tạo lại từ dữ liệu mẫu.

## Chạy dự án

Yêu cầu Node.js 20+ và MongoDB (local hoặc Atlas).

```bash
npm install
cp .env.example .env
npm run dev
```

Trên PowerShell, dùng `Copy-Item .env.example .env`. Sửa `MONGODB_URI`, hai JWT secret khác nhau (ít nhất 32 ký tự), `CLIENT_ORIGINS` và Cloudinary nếu cần upload ảnh. `GET http://localhost:4000/health` trả `{ "ok": true }` khi API đang chạy. Chạy `npm test` để chạy unit test và kiểm tra các luồng chính bằng MongoDB tạm trong bộ nhớ; `npm run test:coverage` để xem coverage.

Swagger UI: `http://localhost:4000/api/docs`. File OpenAPI gốc: `src/docs/openapi.yaml`; bản JSON dùng cho công cụ khác: `http://localhost:4000/api/openapi.json`. Trong Swagger UI, gọi `/api/auth/login` hoặc `/api/auth/register`, sao chép `accessToken`, bấm **Authorize** và dán token để thử các endpoint có biểu tượng khóa. Endpoint admin cần token của tài khoản admin.

Mở `http://localhost:4000/` hoặc `/api` sẽ thấy thông tin API. Đây là backend JSON, không có giao diện web ở trang gốc. Truy cập một URL không được khai báo vẫn trả `404 { "error": "Route not found" }`.

Để tạo hoặc cập nhật tài khoản quản trị, điền `ADMIN_EMAIL`, `ADMIN_PASSWORD` (ít nhất 12 ký tự) và tùy chọn `ADMIN_NAME` trong `.env`, rồi chạy `npm run create-admin`. API đăng ký công khai chỉ tạo tài khoản `student`.

Để nạp dữ liệu demo quanh campus FPT TP.HCM ở Lô E2a-7 đường D1, chạy `npm run seed:hcm -- admin@example.com` với email admin đã tạo. Script chạy lặp lại an toàn, chỉ thêm địa điểm còn thiếu và không ghi đè chỉnh sửa của admin. Mỗi địa điểm có `source.url`, ngày tra cứu và ghi chú độ chính xác vị trí. Dữ liệu từ trang trường/website cửa hàng/danh bạ trực tuyến, chưa khảo sát thực địa; Wi-Fi, ổ cắm và giá chưa xác minh được lưu là `null`.

Danh sách nguồn và mức độ xác minh: [`docs/HCM-D1-SEED-SOURCES.md`](docs/HCM-D1-SEED-SOURCES.md).

## Quy ước API

- Prefix: `/api`. Body và response dùng JSON, trừ upload ảnh dùng `multipart/form-data`.
- Endpoint cần đăng nhập: header `Authorization: Bearer <accessToken>`.
- Danh sách trả `{ items, page, limit, total }`. `page` bắt đầu từ 1, `limit` tối đa 100.
- Lỗi trả `{ "error": "..." }` với HTTP status phù hợp. ID dùng MongoDB ObjectId.
- Tọa độ GeoJSON luôn theo thứ tự `[longitude, latitude]`, không phải `[latitude, longitude]`.
- `crowd`: `unknown | low | medium | high`; `noise`: `unknown | quiet | moderate | loud`.
- `amenities.wifi` và `amenities.outlets` có thể là `null` (chưa xác minh), `true` hoặc `false`. `minDrinkPrice: null` nghĩa là chưa có giá đáng tin cậy.

### Xác thực

| Method | URL | Quyền | Chức năng |
|---|---|---|---|
| POST | `/api/auth/register` | Công khai | Tạo tài khoản `{ name, email, password }` |
| POST | `/api/auth/login` | Công khai | Đăng nhập `{ email, password }` |
| POST | `/api/auth/refresh` | Công khai | Đổi refresh token `{ refreshToken }` |
| POST | `/api/auth/logout` | Công khai | Thu hồi refresh token `{ refreshToken }` |
| GET | `/api/auth/me` | User | Hồ sơ hiện tại |

Đăng ký/đăng nhập/refresh trả `{ user, accessToken, refreshToken }`. Refresh token được xoay vòng; token cũ hết hiệu lực ngay sau khi đổi. Client nên lưu refresh token trong secure storage và gọi `/refresh` khi access token hết hạn.

### Địa điểm và hoạt động của sinh viên

| Method | URL | Quyền | Chức năng |
|---|---|---|---|
| GET | `/api/places` | Công khai | Danh sách/tìm kiếm/lọc địa điểm đã duyệt |
| POST | `/api/places` | User | Gửi địa điểm mới, chờ admin duyệt |
| GET | `/api/places/:id` | Công khai | Chi tiết địa điểm đã duyệt |
| GET | `/api/places/:id/reviews` | Công khai | Đánh giá đang hiển thị |
| PUT | `/api/places/:id/reviews/me` | User | Tạo/cập nhật đánh giá `{ rating, text }` |
| DELETE | `/api/places/:id/reviews/me` | User | Xóa đánh giá của mình |
| POST | `/api/places/:id/checkins` | User | Check-in `{ crowd, noise, coordinates }` |
| GET | `/api/favorites` | User | Danh sách đã lưu |
| PUT | `/api/favorites/:placeId` | User | Lưu địa điểm |
| DELETE | `/api/favorites/:placeId` | User | Bỏ lưu |
| POST | `/api/reports` | User | Báo cáo `{ placeId, reason, detail }` |
| GET | `/api/reports/me` | User | Báo cáo của mình |
| GET | `/api/reputation/leaderboard` | Công khai | Bảng xếp hạng điểm đóng góp (`limit` tối đa 100) |

Tạo địa điểm:

```json
{
  "name": "Thư viện gần trường",
  "description": "Có bàn học nhóm",
  "address": "123 Đường ABC, Hà Nội",
  "coordinates": [105.8, 21.0],
  "amenities": { "wifi": true, "outlets": true },
  "minDrinkPrice": 25000
}
```

`GET /api/places` hỗ trợ `q`, `lat`, `lng`, `radius` (mét, mặc định 5000), `wifi`, `outlets`, `maxPrice`, `crowd`, `noise`, `page`, `limit`. Khi truyền `lat` phải truyền cả `lng`; kết quả sắp theo khoảng cách. Không truyền vị trí thì sắp theo địa điểm mới nhất. Ví dụ: `/api/places?lat=21.0&lng=105.8&radius=2000&wifi=true&outlets=true`.

Check-in yêu cầu tọa độ trong bán kính 250 m từ địa điểm và giới hạn một lần mỗi 15 phút cho mỗi user/địa điểm. Mỗi check-in có hiệu lực 120 phút (cấu hình được). Trạng thái dùng báo cáo mới nhất của mỗi user còn hiệu lực, lấy trung bình mức đông/ồn; dưới `STATUS_MIN_SAMPLES` (mặc định 2) sẽ là `unknown`. Job nền cập nhật khi check-in hết hạn. Client đọc snapshot qua REST khi mở/reconnect, sau đó nghe Socket.IO. Vị trí do điện thoại gửi lên nên vẫn có thể bị giả lập; đây là giới hạn của xác thực vị trí chỉ bằng GPS phía client.

Điểm đóng góp: +1 cho check-in đầu tiên tại một địa điểm trong ngày UTC, +2 cho đánh giá đầu tiên tại địa điểm đó. Xóa rồi tạo lại đánh giá không cộng điểm thêm.

`reason` của báo cáo: `closed`, `incorrect_info`, `inappropriate`, `other`. Mỗi user chỉ có một báo cáo đang chờ xử lý cho một địa điểm.

### Quản trị

Tất cả endpoint dưới đây yêu cầu role `admin`.

| Method | URL | Chức năng |
|---|---|---|
| GET | `/api/admin/places?approval=pending` | Danh sách địa điểm theo trạng thái |
| PATCH | `/api/admin/places/:id` | Sửa thông tin/duyệt hoặc từ chối (`approval`) |
| POST | `/api/admin/places/:id/images` | Upload trường form `image` lên Cloudinary, tối đa 5 MB, JPEG/PNG/WebP |
| GET | `/api/admin/reports?status=pending` | Danh sách báo cáo |
| PATCH | `/api/admin/reports/:id` | Xử lý báo cáo `{ "status": "resolved" }` hoặc `dismissed` |
| GET | `/api/admin/reviews?hidden=false` | Liệt kê đánh giá để duyệt |
| PATCH | `/api/admin/reviews/:id` | Ẩn/hiện đánh giá `{ "hidden": true }` |
| GET | `/api/admin/analytics` | Tổng số user, địa điểm, báo cáo, đánh giá và check-in còn hiệu lực |

`PATCH /api/admin/places/:id` nhận các trường `name`, `description`, `address`, `coordinates`, `amenities`, `minDrinkPrice`, `approval` (`pending | approved | rejected`). Endpoint ảnh trả `503` nếu chưa cấu hình Cloudinary.

Để dùng upload ảnh, điền `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` vào `.env` và khởi động lại server. Có thể kiểm tra bằng `npm run smoke:cloudinary -- admin@example.com`; script upload ảnh 1×1 tạm qua endpoint admin rồi gỡ khỏi MongoDB và Cloudinary. Để thử đúng server đang chạy, đặt `SMOKE_BASE_URL=http://localhost:4000` trong môi trường của lệnh kiểm tra.

## Socket.IO

Kết nối tới cùng URL API. Client gửi `place:join` với `placeId` và callback nhận `{ ok: true }` hoặc `{ ok: false, error }`. Server gửi ngay `place:status` dạng `{ placeId, liveStatus }` khi join, rồi gửi lại khi trạng thái thay đổi. Rời địa điểm bằng `place:leave`. Khi reconnect, client join lại room đang xem và gọi REST `/api/places` hoặc `/api/places/:id` để đồng bộ marker/snapshot mới nhất.

`liveStatus` gồm `crowd`, `noise`, `sampleCount`, `updatedAt`, `validUntil`. Socket chỉ là kênh thông báo; MongoDB lưu trạng thái chính thức.

## Cấu trúc

```text
src/
  models/       Mongoose schema, indexes (Model)
  controllers/  Nhận request, kiểm tra input, trả JSON (Controller)
  views/        Chọn dữ liệu công khai cho JSON response (View)
  routes/       URL và middleware của từng endpoint
  services/     JWT, tính trạng thái, rating, reputation, upload ảnh
  middleware/   Xác thực, phân quyền, upload, xử lý lỗi
  gateways/     Socket.IO events
  docs/         OpenAPI YAML và Swagger UI spec loader
  utils/        Hàm dùng chung và validation
  app.js        Ghép Express routes
  http.js       Ghép HTTP và Socket.IO
  server.js     Kết nối MongoDB và chạy server/job
```

**MVC cho REST API:** Model là các file trong `models/`; Controller là các file trong `controllers/`; View là JSON response và các serializer trong `views/`, được mobile app và web admin hiển thị. Backend không render HTML. Các nghiệp vụ dùng lại hoặc không phụ thuộc HTTP nằm trong `services/`. Ví dụ luồng check-in: `routes/placeRoutes.js` → `controllers/checkinController.js` → `models/Checkin.js` + `services/statusService.js` → JSON và sự kiện Socket.IO.
