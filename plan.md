# Kế hoạch xây dựng — Chi Tiêu

## Mục tiêu và phạm vi

Xây dựng website quản lý tài chính cá nhân bằng **MERN Stack**: React (TypeScript), Node.js, Express và MongoDB (Mongoose). Mọi dữ liệu riêng tư được truy vấn theo người dùng đã đăng nhập. Hỗ trợ quản lý thu/chi, tài khoản tiền, danh mục, ngân sách, mục tiêu tiết kiệm, phân tích và xuất báo cáo. Mở rộng theo yêu cầu mới nhất: biểu đồ thống kê trực quan và xuất báo cáo thu–chi dạng Excel. Kèm hướng dẫn cài đặt, thiết lập MongoDB, cấu hình biến môi trường và chạy trên máy tính cá nhân.

### Tính năng sản phẩm

- Đăng ký, đăng nhập, đăng xuất, quản lý hồ sơ; tách dữ liệu theo tài khoản người dùng.
- Trang tổng quan số dư, thu, chi, ngân sách và giao dịch gần đây.
- Tạo, sửa, xóa, xem giao dịch thu/chi với số tiền, ngày, danh mục, tài khoản, ghi chú và hình thức thanh toán.
- Quản lý danh mục và tài khoản tiền mặt/ngân hàng/ví điện tử; số dư được tính từ số dư đầu kỳ và các giao dịch.
- Ngân sách theo danh mục/thời gian với tiến độ chi tiêu.
- Mục tiêu tiết kiệm, số tiền đích, đóng góp, tiến độ và hạn hoàn thành.
- Báo cáo và biểu đồ theo kỳ, danh mục, tài khoản; so sánh thu–chi.
- Tìm kiếm, lọc, sắp xếp, phân trang; xuất CSV và Excel (.xlsx).
- Responsive, trạng thái tải/rỗng/lỗi rõ ràng; ngày và tiền tệ hiển thị theo chuẩn Việt Nam.
- REST API Express, xác thực cookie, kiểm tra dữ liệu và bảo vệ các API; MongoDB lưu dữ liệu.

## Kiến trúc và công nghệ

- **Client**: React + TypeScript + Vite, React Router, Recharts, Lucide; giao tiếp với API cùng origin.
- **Server**: Node.js + Express + TypeScript, REST `/api/*`, Zod validation, bcryptjs + JWT trong HttpOnly cookie, Helmet và rate limiting.
- **Dữ liệu**: MongoDB qua Mongoose. `MONGODB_URI` là kết nối MongoDB do người dùng cấu hình. Hạ tầng database có sẵn của workspace tương thích MySQL, không được dùng thay cho MongoDB trong sản phẩm MERN.
- **Báo cáo**: tổng hợp trên server; ExcelJS tạo workbook `.xlsx` có các trang tổng quan, giao dịch, theo danh mục và theo tháng; CSV cho lịch sử giao dịch.
- **Phát triển**: pnpm workspace; Vite phục vụ Preview cổng 3000 và chuyển tiếp `/api` tới Express cổng 4000. Bản build phục vụ client tĩnh từ Express trên `PORT`.
- **Cấu hình cục bộ**: `.env` riêng, không commit; cung cấp `.env.example`, hướng dẫn MongoDB Community cục bộ hoặc MongoDB Atlas, chuỗi kết nối, tạo tài khoản thử nghiệm, migration/seed danh mục, chạy dev/build và lưu ý an toàn.
- Khi chưa cấu hình MongoDB, API báo trạng thái chưa kết nối; giao diện có thể mở chế độ xem thử với dữ liệu mẫu tách riêng khỏi tài khoản thật. Không giả lập việc ghi dữ liệu lên MongoDB.

## Cấu trúc thư mục

```text
chitieu/
├── client/
│   ├── src/
│   │   ├── components/       # Thành phần dùng chung, biểu mẫu, khung điều hướng
│   │   ├── pages/            # Tổng quan, giao dịch, ngân sách, mục tiêu, tài khoản, báo cáo
│   │   ├── lib/              # API client, định dạng tiền/ngày, dữ liệu xem thử
│   │   ├── types/            # Kiểu dữ liệu phía trình duyệt
│   │   ├── App.tsx            # Route và khởi tạo phiên
│   │   ├── main.tsx           # Điểm vào React
│   │   └── styles.css         # Hệ thống giao diện responsive
│   ├── index.html
│   ├── vite.config.ts
│   └── tsconfig.json
├── server/
│   └── src/
│       ├── config/            # Kết nối MongoDB và cấu hình môi trường
│       ├── middleware/        # Xác thực, kiểm tra lỗi, giới hạn request
│       ├── models/            # User, Account, Category, Transaction, Budget, Goal
│       ├── routes/            # REST endpoints
│       ├── services/          # Nghiệp vụ tổng hợp và xuất báo cáo
│       ├── app.ts             # Express app
│       └── index.ts           # Khởi động server
├── public/manus-routes.json
├── docs/LOCAL_SETUP.md        # Hướng dẫn cài đặt và chạy local
├── .env.example
├── package.json               # Workspaces và scripts dùng chung
├── pnpm-workspace.yaml
├── tsconfig.json
├── plan.md
└── TODO.md
```

## Thiết kế giao diện

- **Design Movement**: Editorial fintech — dashboard tài chính tinh gọn, lấy cảm hứng từ các tạp chí dữ liệu và ứng dụng ngân hàng số cao cấp.
- **Nguyên tắc cốt lõi**: thứ bậc số liệu rõ ràng; màu sắc có ý nghĩa; thao tác thu/chi nhanh, dễ hoàn tác; ưu tiên khả năng đọc trên mobile.
- **Màu sắc**: nền giấy ngà ấm giảm cảm giác lạnh của bảng số; mực xanh than cho độ tin cậy; xanh ngọc sâu là màu thương hiệu biểu đạt sức khỏe tài chính; san hô và hổ phách chỉ dùng làm cảnh báo/chi tiêu.
- **Bố cục**: thanh điều hướng dọc gọn ở desktop, vùng làm việc dạng editorial với một điểm nhấn số dư, báo cáo biểu đồ xen với dòng giao dịch; trên mobile chuyển sang điều hướng dưới và thẻ nội dung xếp dọc.
- **Motif nhận diện**: biểu tượng đồng xu/lá cách điệu; các nét tăng trưởng mảnh trên vùng số dư; thẻ tài chính viền mảnh bo vừa phải, tránh hiệu ứng kính và gradient lạm dụng.
- **Tương tác**: nút thêm giao dịch luôn dễ thấy; modal gọn, mặc định có giá trị hợp lý; bộ lọc hiển thị lựa chọn; thông báo sau lưu/xóa; empty/loading/error có nội dung hướng dẫn.
- **Chuyển động**: hover/press 120–180 ms; biểu đồ xuất hiện nhẹ khi vào màn hình; không nhấp nháy hoặc làm chậm nội dung; tôn trọng `prefers-reduced-motion`.
- **Typography**: Be Vietnam Pro cho nội dung tiếng Việt, IBM Plex Mono cho số liệu then chốt; tiêu đề có tương phản kích cỡ, số dư lớn nhất ở dashboard.
- **Brand Essence**: “Rõ từng đồng, nhẹ đầu mỗi tháng” — công cụ cho cá nhân muốn kiểm soát thu–chi mà không cần bảng tính; tính cách: sáng rõ, gần gũi, đáng tin.
- **Brand Voice**: tiêu đề ngắn, dùng tiếng Việt tự nhiên, không phán xét. Ví dụ: “Tiền của bạn đang đi đâu?” và “Mỗi khoản nhỏ, một bức tranh rõ hơn.”
- **Wordmark & Logo**: chữ “chi tiêu” chữ thường cạnh dấu đồng xu gồm vòng tròn và đường tăng trưởng đi lên, dùng như icon nhỏ ở điều hướng.
- **Màu thương hiệu**: xanh ngọc sâu `#087F6A`.

## Vận hành và lưu ý

- Không commit `.env`, URI hoặc khóa ký JWT. Hướng dẫn local tạo khóa bằng `openssl rand -hex 32` và thiết lập cookie phù hợp HTTP cục bộ.
- Mọi model tài chính có `userId`; mọi truy vấn, cập nhật, xóa đều phải giới hạn theo user hiện tại.
- Không ghi giao dịch thử nghiệm vào database dùng chung. Dữ liệu xem thử trên trình duyệt được đánh dấu rõ là demo.
- Excel/CSV tuân thủ các bộ lọc ngày, tài khoản, danh mục và từ khóa; Excel có tổng hợp ở các sheet riêng.
