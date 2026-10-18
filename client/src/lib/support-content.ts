const sensitiveContentPatterns = [
  /\b(mat khau|password|passcode|pwd)\b/,
  /\b(otp|ma xac thuc|ma bao mat|verification code)\b/,
  /\b(so tai khoan|tai khoan ngan hang|bank account|account number|so the|the tin dung|the ghi no|credit card|debit card|cvv|cvc|pin)\b/,
  /\b\d{13,19}\b/,
];

export function sensitiveSupportContentWarning(content: string): string | null {
  const normalized = content
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
  return sensitiveContentPatterns.some((pattern) => pattern.test(normalized))
    ? "Tin nhắn có vẻ chứa mật khẩu, mã xác thực hoặc thông tin tài chính nhạy cảm. Vì an toàn, hệ thống không gửi tin này. Hãy xóa thông tin đó rồi thử lại."
    : null;
}
