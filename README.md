# Chi Tiêu — quản lý tài chính cá nhân

Website quản lý chi tiêu theo yêu cầu, sử dụng **MongoDB, Express, React và Node.js**. Giao diện tiếng Việt tập trung vào giao dịch hằng ngày, kế hoạch ngân sách, mục tiêu tiết kiệm và báo cáo trực quan.

## Tính năng

- Đăng ký, đăng nhập và hồ sơ cá nhân; dữ liệu MongoDB được phân vùng theo người dùng.
- Đăng ký và đăng nhập bằng email/mật khẩu; tài khoản Google sử dụng OAuth với email đã xác minh bởi Google.
- Đăng nhập hoặc tạo tài khoản bằng Google OAuth với email đã xác minh.
- Phiên đăng nhập được duy trì tối đa 5 ngày bằng HttpOnly cookie; khi hết hạn, ứng dụng thông báo và tự đăng xuất.
- Đăng ký không bị giới hạn bởi bộ đếm dùng chung; chỉ các lần đăng nhập thất bại lặp lại mới bị giới hạn để giảm dò mật khẩu.
- Người dùng có thể vô hiệu hóa tài khoản trong Cài đặt; dữ liệu được giữ lại và chỉ quản trị viên mới có thể kích hoạt lại.
- Trang quản trị giới hạn theo allowlist `ADMIN_EMAILS`; admin có thể tìm/lọc tài khoản, khôi phục tài khoản đã vô hiệu hóa và xem nhật ký thao tác.
- Khách có thể liên hệ hỗ trợ qua chat ngay cả khi chưa đăng nhập; mỗi tab có phiên chat ẩn danh riêng để các khách khác nhau không dùng chung hội thoại. Quản trị viên nhận và trả lời tin nhắn realtime trong hộp thư quản trị, với trạng thái đang soạn/đã gửi/đã nhận/đã xem, trạng thái online/offline tài khoản và bộ đếm tin chưa đọc ở cả hai phía. Đóng/mở hội thoại được đồng bộ realtime tới khách. Tin nhắn có chứa mật khẩu, mã xác thực hoặc thông tin thẻ/tài khoản tài chính sẽ bị chặn ở giao diện và API. Quản trị viên có thể khôi phục và chuyển hội thoại sang tài khoản đã đăng ký trùng email; token chat ẩn danh bị từ chối sau khi chuyển, còn chủ tài khoản đăng nhập có thể tiếp tục hội thoại tại widget trong ứng dụng. Admin có thể xóa vĩnh viễn toàn bộ một hội thoại và lịch sử tin nhắn sau khi xác nhận. Xác minh OTP để nhận lại hội thoại từ thiết bị/phiên khách khác chưa được bật; cần cấu hình dịch vụ gửi email trước khi triển khai luồng này.
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
# cấu hình CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY và CLOUDINARY_API_SECRET để bật tải avatar
pnpm dev
```

Mở `http://localhost:3000`. Vite chạy frontend ở cổng `3000`, chuyển tiếp `/api` và kết nối Socket.IO `/socket.io` đến Express cổng `4000`. Khi triển khai, reverse proxy cần cho phép nâng cấp kết nối WebSocket tới cùng máy chủ ứng dụng. Trên Windows PowerShell thay `cp` bằng `Copy-Item .env.example .env`.

Để bật tải ảnh đại diện, tạo/lấy **Cloud Name**, **API Key** và **API Secret** trong Cloudinary Dashboard → Settings → API Keys, điền lần lượt vào `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` và `CLOUDINARY_API_SECRET` trong `.env`, rồi khởi động lại server. Ảnh được tải trực tiếp lên Cloudinary; MongoDB chỉ lưu URL và public ID.

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
