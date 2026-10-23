import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type Props = { type: "terms" | "privacy" };

export default function LegalPage({ type }: Props) {
  const isTerms = type === "terms";
  return (
    <main className="legal-page">
      <article className="legal-document">
        <Link className="legal-back" to="/login">
          <ArrowLeft size={16} /> Quay lại đăng nhập
        </Link>
        <div className="eyebrow">
          WEBSITE QUẢN LÝ CHI TIÊU - THÔNG TIN DÀNH CHO BẠN
        </div>
        <h1>{isTerms ? "Điều khoản sử dụng" : "Chính sách quyền riêng tư"}</h1>
        <p className="legal-updated">Cập nhật lần cuối: 23 tháng 10, 2026</p>
        {isTerms ? <TermsContent /> : <PrivacyContent />}
        <div className="legal-notice">
          Tài liệu này mô tả cách dịch vụ Chi Tiêu dự kiến vận hành. Nếu bạn có
          câu hỏi hoặc cần hỗ trợ về tài khoản và dữ liệu, hãy liên hệ đội ngũ
          hỗ trợ ngay trong ứng dụng.
        </div>
        <Link className="legal-back legal-back-bottom" to="/login">
          <ArrowLeft size={16} /> Quay lại đăng nhập
        </Link>
      </article>
    </main>
  );
}

function TermsContent() {
  return (
    <div className="legal-copy">
      <p>
        Chào mừng bạn đến với website quản lý chi tiêu, công cụ giúp bạn ghi
        nhận thu chi, mục tiêu tiết kiệm và nhìn lại thói quen tài chính. Khi
        tạo tài khoản, đăng nhập hoặc tiếp tục sử dụng dịch vụ, bạn xác nhận đã
        đọc và đồng ý với các điều khoản dưới đây. Vui lòng ngừng sử dụng dịch
        vụ nếu bạn không đồng ý.
      </p>
      <h2>1. Dịch vụ quản lý chi tiêu</h2>
      <p>
        Website quản lý chi tiêu cung cấp các tính năng quản lý tài chính cá
        nhân như tài khoản ghi chép, giao dịch thu chi, danh mục, mục tiêu, báo
        cáo và các công cụ hỗ trợ liên quan.
      </p>
      <h2>2. Điều kiện và tài khoản</h2>
      <p>
        Bạn cần có khả năng tự chịu trách nhiệm cho việc sử dụng tài khoản theo
        quy định áp dụng tại nơi bạn sinh sống. Thông tin đăng ký cần chính xác
        và được cập nhật khi thay đổi. Bạn chịu trách nhiệm giữ bí mật mật khẩu,
        thiết bị và phiên đăng nhập; mọi hoạt động phát sinh từ tài khoản được
        xem là do bạn thực hiện, trừ khi bạn kịp thời thông báo về việc mất
        quyền kiểm soát.
      </p>
      <p>
        Không chia sẻ thông tin đăng nhập, không cho người khác sử dụng tài
        khoản theo cách gây rủi ro cho dữ liệu và hãy đăng xuất khỏi thiết bị
        dùng chung. Nếu nghi ngờ tài khoản bị truy cập trái phép, hãy đổi mật
        khẩu và liên hệ hỗ trợ sớm nhất có thể.
      </p>
      <h2>3. Dữ liệu và nội dung bạn nhập</h2>
      <p>
        Bạn giữ trách nhiệm đối với dữ liệu mình nhập, bao gồm số tiền, ngày
        giao dịch, ghi chú, tên tài khoản và thông tin khác. Hãy kiểm tra nội
        dung trước khi lưu và tự lưu giữ bản sao của những dữ liệu quan trọng.
        Báo cáo được tạo dựa trên dữ liệu bạn cung cấp; thiếu hoặc nhập sai dữ
        liệu có thể khiến tổng hợp không chính xác.
      </p>
      <p>
        Bạn đồng ý không tải lên nội dung vi phạm pháp luật, xâm phạm quyền của
        người khác, chứa mã độc, hoặc cố tình gây ảnh hưởng đến hoạt động của hệ
        thống. Bạn không được dò quét, phá hoại, né cơ chế xác thực, khai thác
        lỗ hổng hoặc truy cập dữ liệu không thuộc tài khoản của mình.
      </p>
      <h2>4. Mục đích sử dụng và giới hạn tài chính</h2>
      <p>
        Website quản lý chi tiêu là công cụ ghi chép và tham khảo để hỗ trợ bạn
        tự quản lý thông tin. Dịch vụ không phải ngân hàng, ví điện tử, đơn vị
        lưu ký, dịch vụ kế toán, tư vấn đầu tư, tư vấn thuế hay tư vấn pháp lý.
        Các số liệu và biểu đồ không phải lời khuyên hoặc cam kết về kết quả tài
        chính. Bạn tự đánh giá và chịu trách nhiệm với quyết định chi tiêu, tiết
        kiệm, vay hoặc đầu tư của mình.
      </p>
      <h2>5. Quyền sở hữu trí tuệ</h2>
      <p>
        Giao diện, tên gọi, thiết kế, phần mềm, biểu tượng và tài liệu của
        website quản lý chi tiêu thuộc quyền của đơn vị vận hành hoặc bên cấp
        phép tương ứng. Bạn được quyền sử dụng dịch vụ cho mục đích cá nhân,
        không độc quyền và không chuyển nhượng. Bạn không được sao chép, sửa
        đổi, phân phối, bán lại hoặc tạo sản phẩm phái sinh từ các thành phần
        của dịch vụ nếu chưa được cho phép bằng văn bản.
      </p>
      <h2>6. Dịch vụ bên thứ ba</h2>
      <p>
        Một số chức năng có thể dựa vào nhà cung cấp bên ngoài, ví dụ đăng nhập
        bằng Google hoặc hạ tầng lưu trữ. Việc sử dụng các dịch vụ đó còn chịu
        điều khoản và chính sách riêng của nhà cung cấp. Chi Tiêu không kiểm
        soát toàn bộ khả năng hoạt động, nội dung hay chính sách của bên thứ ba.
      </p>
      <h2>7. Tính sẵn sàng và thay đổi</h2>
      <p>
        Chúng tôi cố gắng duy trì dịch vụ ổn định nhưng không đảm bảo truy cập
        liên tục, không có lỗi hoặc tương thích với mọi thiết bị. Hệ thống có
        thể tạm ngừng để bảo trì, nâng cấp, xử lý sự cố hoặc đáp ứng yêu cầu an
        toàn. Chúng tôi có thể thêm, điều chỉnh hoặc ngừng một tính năng; khi
        thay đổi đáng kể ảnh hưởng đến cách sử dụng, chúng tôi sẽ cố gắng thông
        báo trong ứng dụng hoặc qua kênh phù hợp.
      </p>
      <h2>8. Tạm khóa và chấm dứt</h2>
      <p>
        Chúng tôi có thể hạn chế hoặc tạm khóa quyền truy cập khi cần bảo vệ tài
        khoản, người dùng hoặc hệ thống, hoặc khi có dấu hiệu vi phạm điều
        khoản. Khi phù hợp, chúng tôi sẽ thông báo lý do và hướng dẫn cách khắc
        phục. Bạn có thể ngừng sử dụng dịch vụ bất cứ lúc nào; để yêu cầu hỗ trợ
        xóa tài khoản hoặc dữ liệu, hãy gửi yêu cầu qua chức năng hỗ trợ.
      </p>
      <h2>9. Trách nhiệm và giới hạn</h2>
      <p>
        Trong phạm vi pháp luật cho phép, bạn chịu trách nhiệm về quyết định dựa
        trên dữ liệu đã ghi chép và cần có bản sao dự phòng cho thông tin quan
        trọng. Chúng tôi không chịu trách nhiệm cho tổn thất phát sinh từ việc
        bạn nhập sai dữ liệu, để lộ thông tin đăng nhập, thiết bị hoặc kết nối
        của bạn gặp sự cố, hay dịch vụ bên thứ ba gián đoạn. Điều khoản này
        không loại trừ trách nhiệm mà pháp luật không cho phép loại trừ.
      </p>
      <h2>10. Cập nhật điều khoản</h2>
      <p>
        Điều khoản có thể được cập nhật để phản ánh thay đổi của sản phẩm hoặc
        yêu cầu vận hành. Phiên bản mới sẽ được đăng tại trang này cùng ngày cập
        nhật. Nếu thay đổi ảnh hưởng đáng kể đến quyền hoặc cách sử dụng của
        bạn, chúng tôi sẽ cố gắng thông báo trước hoặc tại thời điểm thay đổi có
        hiệu lực. Việc tiếp tục sử dụng sau ngày hiệu lực đồng nghĩa bạn chấp
        nhận nội dung mới.
      </p>
      <h2>11. Liên hệ</h2>
      <p>
        Nếu cần giải thích về điều khoản, báo cáo vấn đề hoặc yêu cầu hỗ trợ,
        hãy mở mục hỗ trợ trong ứng dụng Chi Tiêu và cung cấp mô tả cụ thể để
        chúng tôi có thể phản hồi.
      </p>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="legal-copy">
      <p>
        Chính sách này giải thích loại thông tin chi tiêu xử lý khi bạn đăng ký,
        đăng nhập và sử dụng các tính năng quản lý thu chi; mục đích sử dụng
        thông tin; cách bảo vệ, lưu giữ và lựa chọn của bạn. Bằng việc sử dụng
        dịch vụ, bạn xác nhận đã đọc nội dung này.
      </p>
      <h2>1. Thông tin chúng tôi xử lý</h2>
      <p>
        <strong>Thông tin tài khoản:</strong> tên, địa chỉ email, thông tin xác
        thực và ảnh đại diện nếu bạn cung cấp hoặc chọn đăng nhập bằng Google.
        Mật khẩu được xử lý theo cơ chế xác thực của hệ thống và không hiển thị
        trong giao diện hồ sơ.
      </p>
      <p>
        <strong>Dữ liệu tài chính do bạn nhập:</strong> tên tài khoản ghi chép,
        số dư ban đầu, khoản thu, khoản chi, ngày tháng, danh mục, ngân sách,
        mục tiêu và ghi chú. Bạn có thể đưa thông tin nhạy cảm vào ghi chú; vui
        lòng chỉ nhập những gì cần thiết cho việc quản lý của bạn.
      </p>
      <p>
        <strong>Dữ liệu kỹ thuật:</strong> thông tin phiên đăng nhập và cookie
        cần thiết để xác thực, bảo vệ phiên và duy trì hoạt động cơ bản. Khi
        bạn yêu cầu đặt lại mật khẩu, hệ thống tạo mã khôi phục đã được băm,
        lưu trong thời hạn ngắn và gửi liên kết đến email tài khoản qua nhà
        cung cấp email. Nhật ký kỹ thuật có thể được tạo để chẩn đoán lỗi,
        ngăn chặn lạm dụng và bảo vệ hệ thống.
      </p>
      <h2>2. Mục đích sử dụng</h2>
      <p>
        Thông tin được dùng để tạo và duy trì tài khoản; xác thực đăng nhập; lưu
        và hiển thị dữ liệu của bạn; tính toán báo cáo; hỗ trợ khôi phục hoặc
        bảo vệ tài khoản; gửi email đặt lại mật khẩu theo yêu cầu; phản hồi
        yêu cầu hỗ trợ; phát hiện sự cố, gian lận
        hoặc hành vi gây hại; và vận hành, cải thiện độ ổn định của dịch vụ.
      </p>
      <p>
        Chúng tôi không dùng dữ liệu giao dịch cá nhân để đưa ra lời khuyên tài
        chính tự động. Nếu ứng dụng bổ sung mục đích xử lý mới cần sự lựa chọn
        của bạn, chúng tôi sẽ thông báo và xin lựa chọn khi pháp luật yêu cầu.
      </p>
      <h2>3. Cách dữ liệu được lưu và tách biệt</h2>
      <p>
        Dữ liệu tài khoản được lưu trên hạ tầng của dịch vụ và được liên kết với
        tài khoản người dùng để hiển thị đúng dữ liệu khi đăng nhập. Các yêu cầu
        dữ liệu được kiểm tra quyền truy cập theo tài khoản. Không đưa mật khẩu
        hoặc thông tin tài chính vào thiết bị hay tài khoản mà bạn không tin
        cậy; hãy dùng mật khẩu riêng và bảo vệ thiết bị của mình.
      </p>
      <h2>4. Chia sẻ thông tin</h2>
      <p>
        Chúng tôi không bán dữ liệu cá nhân của bạn. Thông tin có thể được xử lý
        bởi nhà cung cấp hạ tầng hoặc dịch vụ cần thiết để vận hành sản phẩm,
        chẳng hạn lưu trữ cơ sở dữ liệu hoặc xác thực Google khi bạn chủ động
        chọn phương thức này. Các nhà cung cấp chỉ nên nhận phần thông tin cần
        thiết cho chức năng liên quan và chịu điều khoản riêng của họ.
      </p>
      <p>
        Thông tin cũng có thể được cung cấp khi cần thiết để đáp ứng yêu cầu hợp
        pháp từ cơ quan có thẩm quyền, bảo vệ quyền và an toàn của người dùng,
        điều tra hành vi gian lận hoặc xử lý sự cố bảo mật. Nếu dịch vụ được
        chuyển giao hoặc tái cấu trúc, dữ liệu có thể được chuyển cùng hoạt động
        đó với biện pháp thông báo phù hợp.
      </p>
      <h2>5. Cookie và phiên đăng nhập</h2>
      <p>
        Chi Tiêu sử dụng cookie phiên cần thiết để nhận biết trạng thái đăng
        nhập và bảo vệ các yêu cầu trong phiên. Nếu chặn cookie, một số chức
        năng như đăng nhập có thể không hoạt động. Đăng xuất hoặc xóa dữ liệu
        trình duyệt sẽ kết thúc phiên trên thiết bị đó; điều này không tự động
        xóa dữ liệu tài khoản trên máy chủ.
      </p>
      <h2>6. Thời gian lưu giữ và xóa</h2>
      <p>
        Thông tin được lưu khi tài khoản còn hoạt động hoặc khi cần thiết cho
        các mục đích nêu trong chính sách, xử lý sự cố và đáp ứng nghĩa vụ hợp
        pháp. Thời gian lưu nhật ký kỹ thuật có thể khác với dữ liệu tài khoản.
        Khi bạn yêu cầu xóa tài khoản, dữ liệu gắn với tài khoản sẽ được xóa
        hoặc ẩn danh trong phạm vi hệ thống hỗ trợ; một số bản sao lưu có thể
        cần thêm thời gian để hết chu kỳ lưu trữ.
      </p>
      <h2>7. Bảo mật thông tin</h2>
      <p>
        Chúng tôi áp dụng các biện pháp kỹ thuật và vận hành phù hợp với quy mô
        dịch vụ để hạn chế truy cập trái phép, mất mát và thay đổi dữ liệu.
        Không có phương thức truyền hoặc lưu trữ nào bảo đảm an toàn tuyệt đối.
        Bạn có thể góp phần bảo vệ thông tin bằng cách dùng mật khẩu khó đoán,
        không chia sẻ mã đăng nhập, cập nhật thiết bị và báo ngay nếu phát hiện
        hoạt động bất thường.
      </p>
      <h2>8. Quyền và lựa chọn của bạn</h2>
      <p>
        Bạn có thể xem và chỉnh sửa một số thông tin hồ sơ trong ứng dụng, lựa
        chọn không đăng nhập qua Google, đăng xuất khỏi phiên hiện tại và gửi
        yêu cầu truy cập, cập nhật hoặc xóa dữ liệu. Chúng tôi có thể cần xác
        minh danh tính trước khi xử lý yêu cầu để tránh tiết lộ dữ liệu cho
        người khác. Một số thông tin có thể cần được giữ lại nếu có nghĩa vụ hợp
        pháp hoặc lý do an toàn chính đáng.
      </p>
      <h2>9. Trẻ em và người dùng khác</h2>
      <p>
        Chi Tiêu được thiết kế cho người dùng có thể tự quản lý tài khoản và dữ
        liệu tài chính cá nhân. Nếu bạn cho rằng trẻ em đã cung cấp thông tin cá
        nhân mà không có sự cho phép phù hợp, vui lòng liên hệ hỗ trợ để chúng
        tôi xem xét.
      </p>
      <h2>10. Thay đổi chính sách</h2>
      <p>
        Chính sách có thể được cập nhật khi tính năng, nhà cung cấp hoặc cách xử
        lý dữ liệu thay đổi. Phiên bản hiện hành luôn được đăng tại trang này,
        kèm ngày cập nhật ở đầu tài liệu. Với thay đổi quan trọng, chúng tôi sẽ
        cố gắng thông báo trong ứng dụng hoặc qua phương thức liên hệ gắn với
        tài khoản.
      </p>
      <h2>11. Liên hệ và yêu cầu dữ liệu</h2>
      <p>
        Để hỏi về quyền riêng tư, yêu cầu hỗ trợ dữ liệu hoặc báo cáo vấn đề,
        hãy liên hệ qua mục hỗ trợ trong ứng dụng. Vui lòng không gửi mật khẩu
        hoặc toàn bộ thông tin tài chính trong yêu cầu hỗ trợ.
      </p>
    </div>
  );
}
