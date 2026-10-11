# Chi Tiêu — quản lý tài chính cá nhân

Website quản lý chi tiêu theo yêu cầu, sử dụng **MongoDB, Express, React và Node.js**. Giao diện tiếng Việt tập trung vào giao dịch hằng ngày, kế hoạch ngân sách, mục tiêu tiết kiệm và báo cáo trực quan.

## Tính năng

- Đăng ký, đăng nhập và hồ sơ cá nhân; dữ liệu MongoDB được phân vùng theo người dùng.
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
# cấu hình CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY và CLOUDINARY_API_SECRET để bật tải avatar
pnpm dev
```

Mở `http://localhost:3000`. Vite chạy frontend ở cổng `3000`, chuyển tiếp `/api` đến Express cổng `4000`. Trên Windows PowerShell thay `cp` bằng `Copy-Item .env.example .env`.

Để bật tải ảnh đại diện, tạo/lấy **Cloud Name**, **API Key** và **API Secret** trong Cloudinary Dashboard → Settings → API Keys, điền lần lượt vào `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` và `CLOUDINARY_API_SECRET` trong `.env`, rồi khởi động lại server. Ảnh được tải trực tiếp lên Cloudinary; MongoDB chỉ lưu URL và public ID.

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
