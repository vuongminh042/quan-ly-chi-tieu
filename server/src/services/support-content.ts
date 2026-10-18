const sensitiveContentPatterns = [
  /\b(mat khau|password|passcode|pwd)\b/,
  /\b(otp|ma xac thuc|ma bao mat|verification code)\b/,
  /\b(so tai khoan|tai khoan ngan hang|bank account|account number|so the|the tin dung|the ghi no|credit card|debit card|cvv|cvc|pin)\b/,
  /\b\d{13,19}\b/,
];

function normalizeContent(content: string): string {
  return content
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

export function sensitiveSupportContentWarning(content: string): string | null {
  const normalized = normalizeContent(content);
  return sensitiveContentPatterns.some((pattern) => pattern.test(normalized))
    ? "Không thể gửi tin nhắn có mật khẩu, mã xác thực hoặc thông tin tài chính nhạy cảm. Hãy xóa thông tin đó rồi gửi lại."
    : null;
}
