import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/core.js";

const tokenCookie = "chitieu_session";
const defaultDevSecret = "development-only-change-me";
export function isAdminEmail(email: string): boolean {
  const configuredEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configuredEmails.includes(email.trim().toLowerCase());
}

export function jwtSecret(): string {
  const value = process.env.JWT_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production")
    throw new Error("JWT_SECRET bắt buộc trong môi trường production.");
  return defaultDevSecret;
}

export function setSessionCookie(res: Response, userId: string): void {
  const sameSite = process.env.COOKIE_SAME_SITE === "lax" ? "lax" : "none";
  const secure = process.env.COOKIE_SECURE === "false" ? false : true;
  const token = jwt.sign({ sub: userId }, jwtSecret(), { expiresIn: "7d" });
  res.cookie(tokenCookie, token, {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  const sameSite = process.env.COOKIE_SAME_SITE === "lax" ? "lax" : "none";
  const secure = process.env.COOKIE_SECURE === "false" ? false : true;
  res.clearCookie(tokenCookie, { httpOnly: true, secure, sameSite, path: "/" });
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[tokenCookie] as string | undefined;
  if (!token) {
    res
      .status(401)
      .json({
        error: "Vui lòng đăng nhập để tiếp tục.",
        code: "AUTH_REQUIRED",
      });
    return;
  }
  let userId: string;
  try {
    const payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
    if (typeof payload.sub !== "string") throw new Error("Invalid session");
    userId = payload.sub;
  } catch {
    clearSessionCookie(res);
    res
      .status(401)
      .json({
        error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        code: "SESSION_EXPIRED",
      });
    return;
  }
  try {
    const user = await User.findById(userId).select("isActive");
    if (!user) {
      clearSessionCookie(res);
      res
        .status(401)
        .json({
          error: "Không tìm thấy tài khoản.",
          code: "ACCOUNT_NOT_FOUND",
        });
      return;
    }
    if (user.isActive === false) {
      clearSessionCookie(res);
      res
        .status(403)
        .json({
          error:
            "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.",
          code: "ACCOUNT_DEACTIVATED",
        });
      return;
    }
    req.userId = userId;
    next();
  } catch (error) {
    next(error);
  }
}
