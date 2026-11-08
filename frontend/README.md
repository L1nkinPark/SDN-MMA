# Frontend StudySpot

Hai ứng dụng dùng chung backend trong `backend/`, theo `backend/src/docs/openapi.yaml` và `backend/docs/SETUP.md`:

- `mobile/`: ứng dụng cho sinh viên (Expo, React Native).
- `admin/`: trang web cho quản trị viên **và** chủ quán (Vite, React). Sinh viên muốn đăng ký quán cũng đăng nhập ở đây.

Web có trang `/register` cho sinh viên và người muốn quản lý quán. Cả hai đăng ký bằng cùng API và bắt đầu với vai trò sinh viên; chọn “Chủ quán” chỉ dẫn sang hồ sơ quán mới hoặc hồ sơ nhận quyền. Admin duyệt hồ sơ xong mới cấp vai trò chủ quán. Sinh viên dùng cùng email/mật khẩu để đăng nhập ứng dụng mobile.

Cách cài và chạy: xem `backend/docs/SETUP.md`. Kiểm tra trước khi mở PR:

```bash
# frontend/mobile
npm run lint && npx tsc --noEmit && npm test
npx expo export --platform android        # kiểm tra đóng gói, không cần thiết bị

# frontend/admin
npm run lint && npm run typecheck && npm test && npm run build
```

`npx tsc` trên mobile đọc type route từ `.expo/types/router.d.ts`. File này chỉ được tạo lại khi chạy `npx expo start`. Sau khi thêm màn mới, hãy chạy Expo một lần trước khi chạy `tsc`.

## Quy ước

- Mọi request đi qua client trong `src/api/`; màn hình chỉ dùng hooks (`src/api/hooks*`), không gọi `fetch` hay `api.request` trực tiếp.
- Type lấy từ `schema.d.ts` (tạo bằng `npx openapi-typescript ../../backend/src/docs/openapi.yaml -o src/api/schema.d.ts`). Riêng các response mà `openapi.yaml` chỉ mô tả bằng chữ (booking của tôi, availability, thông báo, danh sách admin mới...) có type viết tay ở cuối `src/api/types.ts`, đánh dấu rõ. Khi OpenAPI có schema thì thay các type này.
- Lỗi tiếng Anh của backend được dịch trong `src/api/errors.ts`; không hiển thị câu tiếng Anh.
- Ngày giờ đặt chỗ, giờ mở cửa, ngày nghỉ luôn tính theo giờ Việt Nam (`src/utils/vnTime.ts`), không theo múi giờ của máy.
- Phong cách: vở kẻ ô như `frontend/design/`. Các màn mới không có bản thiết kế nên dùng lại component sẵn có (dòng kẻ 1px, tiêu đề có gạch 1.5px, không thẻ bo góc, không emoji).

## Mobile: màn mới

| Màn | Route | API |
|---|---|---|
| Quên mật khẩu | `/forgot-password` | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` |
| Tài khoản và bảo mật | `/account` | `PATCH /api/auth/me`, `GET /api/auth/me/export` |
| Đổi mật khẩu | `/change-password` | `POST /api/auth/change-password` (đăng xuất sau khi đổi) |
| Xóa tài khoản | `/delete-account` | `DELETE /api/auth/me` |
| Thông báo | `/notifications` | `GET /api/notifications`, `PATCH .../{id}/read`, `POST .../read-all` |
| Đặt chỗ | `/places/[id]/booking` | `GET /api/places/{id}/availability`, `POST /api/bookings` |
| Đặt chỗ của tôi | `/my-bookings` | `GET /api/bookings/me`, `POST /api/bookings/{id}/cancel` |

Thay đổi ở màn cũ:

- **Check-in:** quét mã QR tại quầy ngay trong màn (chỉ khi quán có chủ). Trước khi gửi, app kiểm tra GPS chính xác dưới 50 m và cách quán tối đa 100 m.
- **Chi tiết địa điểm:** thêm giờ mở cửa hôm nay, trạng thái tạm đóng và lối vào đặt chỗ. Ẩn check-in, đánh giá và đặt chỗ nếu người xem là chủ quán.
- **Đánh giá:** hiện nhãn đã xác minh lượt ghé.
- **Hồ sơ:** hiện số thông báo chưa đọc.

## Web: khu vực theo vai trò

Sau khi đăng nhập:

- **Admin:** chỉ thấy các mục ứng với `adminPermissions`. Tài khoản không có danh sách quyền được coi là toàn quyền, giống backend.
- **Sinh viên và chủ quán:** vào khu "Quán của tôi".

| Khu | Trang | Quyền |
|---|---|---|
| Chủ quán | Quán của tôi, Đăng ký quán, Nhận quyền quán, Đề nghị đã gửi | mọi tài khoản không phải admin |
| Chủ quán | Quán: Đặt chỗ, Mã QR tại quầy, Vận hành, Thông tin và ảnh | chủ của quán đã duyệt |
| Admin | Tổng quan | `analytics` |
| Admin | Địa điểm, Hồ sơ chủ quán, Thay đổi quán | `places` |
| Admin | Báo cáo, Đánh giá | `moderation` |
| Admin | Đặt chỗ | `bookings` |
| Admin | Người dùng | `users` (cấp hoặc thu hồi quyền admin: chỉ `*`) |
| Admin | Bất thường | `fraud` |
| Admin | Nhật ký | `audit` |
| Chung | Thông báo, Tài khoản (đổi mật khẩu), Quên mật khẩu | mọi tài khoản |

## Chạy thử luồng chủ quán và QR

1. Admin đăng nhập web.
2. Một tài khoản sinh viên đăng nhập web, vào **Đăng ký quán mới** (hoặc **Nhận quyền quán**) và gửi hồ sơ kèm link `https://`.
3. Admin duyệt ở **Địa điểm** (hoặc **Hồ sơ chủ quán**). Tài khoản kia trở thành chủ quán.
4. Chủ quán vào quán, tab **Vận hành**: bật nhận đặt chỗ, nhập số chỗ mỗi khung giờ và giờ mở cửa, rồi bấm Lưu.
5. Trên mobile, một sinh viên khác đặt chỗ. Nếu quán duyệt thủ công, chủ quán bấm Duyệt ở tab **Đặt chỗ**.
6. Chủ quán mở tab **Mã QR tại quầy**. Sinh viên ở gần quán vào Check-in, chọn **Quét mã QR tại quầy** rồi gửi. Trên emulator, cần giả lập vị trí ở ngay quán và độ chính xác dưới 50 m.

## Việc cần báo người làm backend

Frontend không sửa backend. Các điểm sau đã gặp khi làm frontend:

1. **`npm run create-admin` bị lỗi** cả khi tạo mới lẫn khi tài khoản đã có: `TypeError: Cannot read properties of null (reading 'role')`. Nguyên nhân là default của `adminPermissions` trong `src/models/User.js` dùng `this.role`, mà khi `findOneAndUpdate` upsert thì `this` là `null`.
2. **`openapi.yaml` thiếu schema response** cho các endpoint mới (booking, availability, thông báo, danh sách admin...). Hiện tại frontend phải tự viết type cho các response này.
3. **OpenAPI thiếu các query param** mà backend có nhận:
   - `status` cho booking, hồ sơ chủ quán, thay đổi quán, cờ gian lận;
   - `q`, `role`, `status` cho `/api/admin/users`;
   - `unread` cho `/api/notifications`.

   Ngoài ra thiếu field `reason` khi khóa user.
4. Summary của `GET /api/merchant/places` ghi "do tôi gửi hoặc quản lý", nhưng code chỉ trả về quán mình sở hữu (`owner`). Đề xuất địa điểm của sinh viên qua `POST /api/places` vì vậy không hiện ở đây.
5. `FraudFlag.detail` được lưu bằng tiếng Anh ("12 km in 3 minutes"). Web đang tự chuyển sang tiếng Việt theo mẫu câu này.
6. `openapi.yaml` ghi thu hồi quyền admin là `DELETE /api/admin/admins/{id}/permissions`, nhưng route thật trong `adminRoutes.js` là `DELETE /api/admin/admins/{id}`. Web gọi theo route thật.

## Git

`develop` là nhánh chính. Mỗi việc làm trên một nhánh `feature/<tên>` tạo từ `develop` mới nhất, xong thì merge hoặc mở PR vào `develop`. Trước khi merge: lint, typecheck và test của app đã sửa phải qua.
