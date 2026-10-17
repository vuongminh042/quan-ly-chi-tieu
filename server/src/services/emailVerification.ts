import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";

const tokenLifetimeMs = 24 * 60 * 60 * 1000;

export function isEmailDeliveryConfigured(): boolean {
  const port = Number(process.env.SMTP_PORT || 587);
  const appUrl =
    process.env.EMAIL_VERIFICATION_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000";
  try {
    const parsedUrl = new URL(appUrl);
    return Boolean(
      process.env.SMTP_HOST?.trim() &&
        process.env.EMAIL_FROM?.trim() &&
        Number.isInteger(port) &&
        port >= 1 &&
        port <= 65535 &&
        Boolean(process.env.SMTP_USER?.trim()) === Boolean(process.env.SMTP_PASSWORD) &&
        ["http:", "https:"].includes(parsedUrl.protocol) &&
        (process.env.NODE_ENV !== "production" || Boolean(process.env.APP_URL?.trim())),
    );
  } catch {
    return false;
  }
}

export function createEmailVerificationToken() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + tokenLifetimeMs),
  };
}

export async function sendEmailVerification(
  email: string,
  name: string,
  token: string,
): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!host || !from) {
    throw new Error("SMTP_HOST and EMAIL_FROM are required to send email.");
  }

  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }

  const username = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  if (Boolean(username) !== Boolean(password)) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must be configured together.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    ...(username && password ? { auth: { user: username, pass: password } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  const verificationBaseUrl =
    process.env.EMAIL_VERIFICATION_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000";
  const verificationUrl = new URL("/api/auth/verify-email", verificationBaseUrl);
  verificationUrl.searchParams.set("token", token);

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: "Xác nhận địa chỉ email của bạn",
      text: `Xin chào ${name},\n\nVui lòng mở liên kết sau để xác nhận email cho tài khoản Chi Tiêu. Liên kết có hiệu lực trong 24 giờ:\n${verificationUrl.toString()}\n\nNếu bạn không tạo tài khoản này, hãy bỏ qua email.`,
      html: `<p>Xin chào ${escapeHtml(name)},</p><p>Vui lòng xác nhận địa chỉ email cho tài khoản Chi Tiêu bằng liên kết dưới đây. Liên kết có hiệu lực trong 24 giờ.</p><p><a href="${escapeHtml(verificationUrl.toString())}">Xác nhận email</a></p><p>Nếu bạn không tạo tài khoản này, hãy bỏ qua email.</p>`,
    });
  } finally {
    transporter.close();
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}
