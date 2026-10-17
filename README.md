# Chi Tiêu — quản lý tài chính cá nhân

Website quản lý chi tiêu theo yêu cầu, sử dụng **MongoDB, Express, React và Node.js**. Giao diện tiếng Việt tập trung vào giao dịch hằng ngày, kế hoạch ngân sách, mục tiêu tiết kiệm và báo cáo trực quan.

## Tính năng

- Đăng ký, đăng nhập và hồ sơ cá nhân; dữ liệu MongoDB được phân vùng theo người dùng.
- Đăng ký yêu cầu xác minh email qua SMTP trước khi được đăng nhập; email xác minh hết hạn sau 24 giờ và có thể gửi lại từ trang đăng nhập.
- Đăng nhập hoặc tạo tài khoản bằng Google OAuth với email đã xác minh.
- Phiên đăng nhập được duy trì tối đa 5 ngày bằng HttpOnly cookie; khi hết hạn, ứng dụng thông báo và tự đăng xuất.
- Đăng ký không bị giới hạn bởi bộ đếm dùng chung; chỉ các lần đăng nhập thất bại lặp lại mới bị giới hạn để giảm dò mật khẩu.
- Người dùng có thể vô hiệu hóa tài khoản trong Cài đặt; dữ liệu được giữ lại và chỉ quản trị viên mới có thể kích hoạt lại.
- Trang quản trị giới hạn theo allowlist `ADMIN_EMAILS`; admin có thể tìm/lọc tài khoản, khôi phục tài khoản đã vô hiệu hóa và xem nhật ký thao tác.
- Ảnh đại diện tải trực tiếp lên Cloudinary; MongoDB chỉ lưu URL và mã ảnh.
- Ghi nhận, sửa, xóa giao dịch thu/chi; tìm kiếm, lọc theo ngày/danh mục/tài khoản, sắp xếp và phân trang.
- Quản lý tiền mặt, ngân hàng, ví điện tử và danh mục; số dư tài khoản tính từ số dư ban đầu và các giao dịch.
- Ngân sách theo danh mục/tháng; mục tiêu tiết kiệm có tiến độ và ghi nhận khoản góp.
- Dashboard có biểu đồ dòng tiền và cơ cấu chi tiêu; báo cáo nhóm theo ngày/tháng/năm, danh mục và tài khoản, so sánh với kỳ trước.
- Xuất lịch sử thành CSV và workbook Excel `.xlsx` có sheet Tổng quan, Giao dịch, Theo danh mục và Theo tháng.
- Responsive cho điện thoại và máy tính; tiền VND/ngày theo chuẩn Việt Nam.
- Chế độ xem thử trên trình duyệt được hiển thị rõ khi chưa cấu hình MongoDB; không giả vờ ghi dữ liệu demo vào cơ sở dữ liệu thật.

## Chạy nhanh

Yêu cầu Node.js `>=20.11`, pnpm `11.25.0` và MongoDB local hoặc MongoDB Atlas.

```bash
pnpm install
cp .env.example .env
# sửa MONGODB_URI và JWT_SECRET trong .env
# cấu hình SMTP_HOST, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM và APP_URL để bật xác minh email
# cấu hình CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY và CLOUDINARY_API_SECRET để bật tải avatar
pnpm dev
```

Mở `http://localhost:3000`. Vite chạy frontend ở cổng `3000`, chuyển tiếp `/api` đến Express cổng `4000`. Trên Windows PowerShell thay `cp` bằng `Copy-Item .env.example .env`.

Để bật tải ảnh đại diện, tạo/lấy **Cloud Name**, **API Key** và **API Secret** trong Cloudinary Dashboard → Settings → API Keys, điền lần lượt vào `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` và `CLOUDINARY_API_SECRET` trong `.env`, rồi khởi động lại server. Ảnh được tải trực tiếp lên Cloudinary; MongoDB chỉ lưu URL và public ID.

Để gửi email xác minh **thật đến hộp thư người dùng**, cấu hình SMTP trong `.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` và `EMAIL_FROM`. Cấu hình này được dùng cả khi chạy local lẫn production; không có chế độ giả lập email. Ví dụ với Gmail, bật xác minh 2 bước, tạo **App password** rồi đặt `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER` bằng địa chỉ Gmail gửi thư, `SMTP_PASSWORD` bằng App password và `EMAIL_FROM` bằng địa chỉ người gửi được Gmail cho phép. Không dùng mật khẩu đăng nhập Gmail thông thường. Với nhà cung cấp khác, dùng đúng SMTP host/port/TLS và thông tin xác thực họ cung cấp. Đặt `APP_URL` bằng URL ứng dụng (local: `http://localhost:3000`; production: domain HTTPS), rồi khởi động lại server. Nếu local đã cấu hình MongoDB và SMTP, đăng ký sẽ gửi thư thật đến email đăng ký; liên kết có hiệu lực 24 giờ.

Khi kiểm thử local trên cùng máy, liên kết `http://localhost:3000` có thể mở trực tiếp trên máy đó. Để mở liên kết từ điện thoại hoặc thiết bị khác, tạo HTTPS tunnel chỉ cho cổng Express local `4000` (ví dụ bằng ngrok hoặc Cloudflare Tunnel), rồi đặt URL tunnel vào `EMAIL_VERIFICATION_URL` trong `.env`. Ví dụ: `EMAIL_VERIFICATION_URL=https://<public-tunnel>`. Khi đó email vẫn gửi qua SMTP thật, còn liên kết xác minh đi tới server local và database local. Không dùng `EMAIL_VERIFICATION_URL` trỏ về production khi muốn xác minh tài khoản trong database local. Trong production có thể để trống để dùng `APP_URL`.

Sau khi thay đổi cấu hình, khởi động lại API. Nếu SMTP thiếu/sai cấu hình hoặc nhà cung cấp từ chối gửi, đăng ký trả lỗi rõ ràng; tài khoản được tạo vẫn có thể yêu cầu gửi lại email từ trang đăng nhập. Đăng nhập Google tiếp tục sử dụng trạng thái email đã xác minh do Google cung cấp.

Để bật đăng nhập Google, tạo OAuth Client ID loại **Web application** trong Google Cloud Console. Thêm URL chuyển hướng được ủy quyền `http://localhost:3000/api/auth/google/callback` khi chạy local; đặt Client ID, Client Secret và URI tương ứng vào `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` và `GOOGLE_REDIRECT_URI` trong `.env`. Khi triển khai production, thêm domain HTTPS của ứng dụng với đường dẫn `/api/auth/google/callback` vào danh sách chuyển hướng và đặt cùng URI trong biến môi trường production. Không đưa Client Secret vào frontend.

Để cấp quyền quản trị, điền email của tài khoản đã đăng ký vào `ADMIN_EMAILS` trong `.env` (nhiều email phân tách bằng dấu phẩy), khởi động lại server rồi đăng nhập/tải lại ứng dụng. Chỉ email trong allowlist này truy cập được `/admin` và API quản trị.

Xem hướng dẫn hệ điều hành, thiết lập Atlas, khóa JWT/cookie và chế độ production tại [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

## Scripts

```bash
pnpm dev       # Express API + Vite
pnpm typecheck  # TypeScript cho client và server
pnpm build      # frontend dist và Node server
pnpm start      # server production (frontend cùng cổng)
```

## Cấu trúc

- `client/`: React + TypeScript + Vite, React Router, Recharts, API client và dữ liệu demo local.
- `server/`: REST API Express/TypeScript, Mongoose models, xác thực cookie và báo cáo ExcelJS.
- `docs/LOCAL_SETUP.md`: hướng dẫn cài và cấu hình MongoDB chi tiết.
- `.env.example`: biến môi trường mẫu, không chứa credential thật.
