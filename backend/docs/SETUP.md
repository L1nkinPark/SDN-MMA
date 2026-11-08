# Chạy StudySpot trên máy mới

Yêu cầu: Node.js 20+, npm, MongoDB 7+ (cài trực tiếp hoặc chạy bằng Docker). Không cần Docker nếu đã có MongoDB hoặc MongoDB Atlas.

```powershell
# Chỉ chạy lệnh này nếu chưa có MongoDB trên localhost:27017
docker run -d --name studyspot-mongo -p 27017:27017 -v studyspot-mongo-data:/data/db mongo:7
# Lần sau: docker start studyspot-mongo
```

```powershell
cd backend
Copy-Item .env.example .env
npm ci
```

Điền `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` trong `backend/.env`. Hai JWT secret phải khác nhau và dài ít nhất 32 ký tự. Nếu dùng tài khoản quản trị mặc định, điền `ADMIN_EMAIL` và `ADMIN_PASSWORD` rồi chạy `npm run create-admin`. Đổi mật khẩu admin sau khi đăng nhập lần đầu và không commit `.env`.

Cloudinary cần `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` để tải ảnh. Email cần `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Ví dụ SMTP cổng 587 thường dùng `SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=true`; cổng 465 dùng `SMTP_SECURE=true`. Mật khẩu SMTP nên là app password nếu nhà cung cấp yêu cầu. Không có SMTP, thông báo trong ứng dụng vẫn hoạt động, còn quên mật khẩu qua email trả 503.

```powershell
cd backend
npm run seed:hcm
npm run dev
```

API: `http://localhost:4000/api`; Swagger: `http://localhost:4000/api/docs`; kiểm tra: `http://localhost:4000/health`. Chạy `npm test` trong thư mục backend để kiểm thử.

Web admin và chủ quán:

```powershell
cd frontend/admin
Copy-Item .env.example .env
npm ci
npm run dev
```

Mobile:

```powershell
cd frontend/mobile
Copy-Item .env.example .env
npm ci
npm start
```

Trong mobile `.env`, `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000` chỉ dành cho Android emulator. Để chạy trên điện thoại thật bằng Expo Go:

1. Kết nối máy tính và điện thoại vào cùng Wi-Fi. Trên Windows, chạy `Get-NetIPAddress -AddressFamily IPv4 | Where-Object InterfaceAlias -Like '*Wi-Fi*'` để lấy địa chỉ IPv4 của máy tính.
2. Đặt `EXPO_PUBLIC_API_URL=http://<IPv4-của-máy-tính>:4000` trong `frontend/mobile/.env`; không thêm `/api` hoặc dấu `/` cuối. Không đưa JWT secret, mật khẩu SMTP hoặc Cloudinary API secret vào `EXPO_PUBLIC_*`.
3. Chạy MongoDB, rồi từ `backend/` chạy `npm run dev`. Mở `http://<IPv4-của-máy-tính>:4000/health` trên trình duyệt điện thoại; phải thấy trạng thái `ok`. Nếu không truy cập được, kiểm tra Windows Firewall cho Node.js/cổng 4000 và mạng Wi-Fi có chặn thiết bị liên lạc với nhau hay không.
4. Cài Expo Go từ `https://expo.dev/go`, chọn đúng SDK với `frontend/mobile/package.json`. Từ `frontend/mobile/` chạy `npm start`, rồi quét mã QR trong terminal: Android quét bằng Expo Go; iPhone quét bằng Camera. Với iPhone vật lý, đăng nhập cùng tài khoản Expo trên CLI (`npx expo login`) và Expo Go.
5. Nếu QR không mở được, thử `npx expo start --tunnel`. Tunnel chỉ giúp điện thoại kết nối Metro; API vẫn dùng IP Wi-Fi trong `.env` và điện thoại vẫn phải truy cập được địa chỉ đó. Sau khi sửa `.env`, tải lại ứng dụng trong Expo Go.

`GOOGLE_MAPS_API_KEY` không cần điền khi dùng Expo Go; cần cấu hình khi tạo bản Android riêng. Camera QR và vị trí cần được cấp quyền trên điện thoại. Chỉ thử QR tại quán đã được admin duyệt và có chủ quán.

Luồng vận hành: tài khoản sinh viên đăng nhập web quản lý để gửi hồ sơ quán/nhận quyền quán; admin duyệt hồ sơ và minh chứng; chủ quán cấu hình giờ mở, sức chứa và booking; sinh viên đặt chỗ trên mobile; chủ quán duyệt nếu chế độ thủ công; khách quét QR tại quầy hoặc nhân viên xác nhận booking. Admin xem cờ bất thường và nhật ký trong web.

Chủ quán có thể đặt ngày nghỉ trong trang quản lý. Hệ thống không cho lưu lịch nghỉ hoặc tạm đóng cửa nếu còn booking tương lai bị ảnh hưởng; chủ quán cần xử lý các booking đó trước. Email được xếp hàng trong MongoDB và thử gửi lại tối đa 5 lần khi SMTP lỗi. Mã đặt lại mật khẩu và email chứa mã hết hạn sau 30 phút.

`GET /health` trả 200 khi MongoDB phản hồi ping và 503 khi mất kết nối. Dùng endpoint này cho health check của hosting; cảnh báo khi trả 503 hoặc tiến trình dừng.

Sao lưu MongoDB local: cài MongoDB Database Tools, rồi chạy `powershell -File backend/scripts/backup-local.ps1` từ thư mục gốc. Bản sao lưu nằm trong `backend/backups/` và được Git bỏ qua. Thử khôi phục định kỳ vào cơ sở dữ liệu riêng, ví dụ `mongorestore --host 127.0.0.1 --port 27017 --db studyspot_restore backend/backups/<thời-gian>/studyspot`. Với MongoDB Atlas, cấu hình automated backups trong Atlas.

GPS từ điện thoại có thể bị giả. QR tại quầy và vị trí chỉ là bằng chứng hỗ trợ; để xác nhận khách đã vào quán, nhân viên phải đánh dấu `Đã đến` trên booking. Admin cần kiểm tra cờ di chuyển bất thường trước khi tin báo cáo hoặc đánh giá.
