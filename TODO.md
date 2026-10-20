# TODO — Chi Tiêu

## 1. Tài khoản, bảo mật và dữ liệu riêng tư
- Đăng ký, đăng nhập, đăng xuất và quản lý hồ sơ người dùng; dữ liệu tài chính được tách biệt theo từng tài khoản.
- Backend REST API bằng Node.js và Express, lưu trữ trên MongoDB, kiểm tra dữ liệu đầu vào và bảo vệ các API cần xác thực.
- Kết nối MongoDB qua biến môi trường `MONGODB_URI`; không dùng database MySQL của hạ tầng thay cho MongoDB.

## 2. Giao dịch, danh mục và tài khoản tiền
- Trang tổng quan hiển thị số dư, tổng thu, tổng chi và các biến động tài chính gần đây.
- Thêm, sửa, xóa và xem chi tiết giao dịch thu/chi với số tiền, ngày, danh mục, tài khoản, ghi chú và hình thức thanh toán.
- Quản lý danh mục thu/chi và các tài khoản tiền như tiền mặt, ngân hàng, ví điện tử; tự động cập nhật số dư theo giao dịch.
- Tìm kiếm, lọc, sắp xếp và phân trang lịch sử giao dịch.

## 3. Mục tiêu tiết kiệm
- Tạo và theo dõi mục tiêu tiết kiệm, gồm số tiền mục tiêu, tiến độ đóng góp và thời hạn hoàn thành.

## 4. Báo cáo, biểu đồ và xuất tệp
- Báo cáo tài chính bằng biểu đồ theo ngày, tháng, năm, danh mục và tài khoản; so sánh thu–chi giữa các kỳ.
- Bổ sung biểu đồ thống kê trực quan trên trang web để theo dõi biến động thu/chi và cơ cấu chi tiêu.
- Xuất dữ liệu tài chính ra CSV.
- Xuất báo cáo thu–chi ra tệp Excel định dạng `.xlsx`, giữ các bộ lọc báo cáo và cung cấp các sheet tổng hợp dễ đọc.

## 5. Giao diện, định dạng và hướng dẫn cài đặt
- Giao diện responsive, trạng thái tải/rỗng/lỗi rõ ràng, định dạng tiền tệ và ngày tháng phù hợp người dùng Việt Nam.
- Hiển thị mã nguồn hoàn chỉnh của trang web quản lý chi tiêu MERN Stack.
- Hướng dẫn chi tiết các bước cài đặt, cấu hình cơ sở dữ liệu MongoDB và chạy ứng dụng này trên máy tính cá nhân.
- Cung cấp `.env.example`, không đưa secret hoặc MongoDB URI riêng tư vào mã nguồn.
