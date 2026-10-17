import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { User, Account, Category } from "../models/core.js";
import {
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
  isAdminEmail,
} from "../middleware/auth.js";
import { requireDatabase } from "../middleware/http.js";
import { loginSchema, registerSchema } from "./validation.js";
import {
  createEmailVerificationToken,
  isEmailDeliveryConfigured,
  sendEmailVerification,
} from "../services/emailVerification.js";

const router = Router();
router.use(requireDatabase);
const googleStateCookie = "chitieu_google_state";
const loginAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Có quá nhiều lần đăng nhập không thành công từ kết nối này. Vui lòng thử lại sau ít phút.",
  },
});
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Bạn đã đăng ký quá nhiều lần từ kết nối này. Vui lòng thử lại sau.",
  },
});
const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Bạn đã yêu cầu gửi email quá nhiều lần. Vui lòng thử lại sau ít phút.",
  },
});

function verificationUnavailable(res: import("express").Response): void {
  res.status(503).json({
    error: "Chức năng xác minh email chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
    code: "EMAIL_DELIVERY_UNAVAILABLE",
  });
}

async function seedStarterData(userId: string): Promise<void> {
  await Promise.all([
    Account.create({
      userId,
      name: "Tiền mặt",
      kind: "cash",
      openingBalance: 0,
      color: "#087F6A",
    }),
    Category.insertMany([
      ...[
        ["Ăn uống", "utensils", "#F18D65"],
        ["Di chuyển", "car", "#6998D5"],
        ["Mua sắm", "shopping-bag", "#C17FB3"],
        ["Nhà cửa", "house", "#D2A149"],
        ["Sức khỏe", "heart-pulse", "#E47783"],
        ["Giải trí", "sparkles", "#8A79C2"],
        ["Hóa đơn", "receipt", "#4E9A91"],
        ["Giáo dục", "book-open", "#6090B9"],
        ["Khác", "circle", "#92999A"],
      ].map(([name, icon, color]) => ({
        userId,
        name,
        icon,
        color,
        kind: "expense",
        isDefault: true,
      })),
      ...[
        ["Lương", "briefcase-business", "#087F6A"],
        ["Thưởng", "gift", "#55A68D"],
        ["Đầu tư", "chart-no-axes-combined", "#78985F"],
        ["Khác", "circle", "#92999A"],
      ].map(([name, icon, color]) => ({
        userId,
        name,
        icon,
        color,
        kind: "income",
        isDefault: true,
      })),
    ]),
  ]);
}

function googleRedirectUri(req: import("express").Request): string {
  return (
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${req.protocol}://${req.get("host")}/api/auth/google/callback`
  );
}

function googleCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "false" ? false : true,
    sameSite: (process.env.COOKIE_SAME_SITE === "lax" ? "lax" : "none") as
      | "lax"
      | "none",
    path: "/api/auth/google",
    maxAge: 10 * 60 * 1000,
  };
}

router.get("/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    res.redirect("/login?google=not_configured");
    return;
  }
  const state = randomBytes(32).toString("hex");
  res.cookie(googleStateCookie, state, googleCookieOptions());
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  res.redirect(authorizationUrl.toString());
});

router.get("/google/callback", async (req, res) => {
  const stateCookie = req.cookies?.[googleStateCookie] as string | undefined;
  res.clearCookie(googleStateCookie, googleCookieOptions());
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!stateCookie || !state || stateCookie !== state) {
    res.redirect("/login?google=invalid_state");
    return;
  }
  if (typeof req.query.error === "string") {
    res.redirect("/login?google=cancelled");
    return;
  }
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!code || !clientId || !clientSecret) {
    res.redirect("/login?google=failed");
    return;
  }
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleRedirectUri(req),
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) {
      console.error("Google OAuth token exchange failed:", tokenResponse.status);
      res.redirect("/login?google=failed");
      return;
    }
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) {
      res.redirect("/login?google=failed");
      return;
    }
    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!profileResponse.ok) {
      console.error("Google OAuth profile request failed:", profileResponse.status);
      res.redirect("/login?google=failed");
      return;
    }
    const profile = (await profileResponse.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!profile.sub || !profile.email || profile.email_verified !== true) {
      res.redirect("/login?google=email_unverified");
      return;
    }

    const email = profile.email.trim().toLowerCase();
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: profile.name?.trim().slice(0, 80) || email.slice(0, 80),
        email,
        ...(profile.picture ? { avatar: profile.picture } : {}),
      });
      try {
        await seedStarterData(String(user._id));
      } catch (error) {
        await Promise.all([
          Account.deleteMany({ userId: user._id }),
          Category.deleteMany({ userId: user._id }),
          User.deleteOne({ _id: user._id }),
        ]);
        throw error;
      }
    }
    if (user.emailVerified === false) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: { emailVerified: true },
          $unset: {
            emailVerificationTokenHash: 1,
            emailVerificationExpiresAt: 1,
          },
        },
      );
    }
    if (user.isActive === false) {
      res.redirect("/login?google=account_deactivated");
      return;
    }
    setSessionCookie(res, String(user._id));
    res.redirect("/");
  } catch (error) {
    console.error("Google sign-in failed:", error);
    res.redirect("/login?google=failed");
  }
});

router.post("/register", registrationLimiter, async (req, res) => {
  const input = registerSchema.parse(req.body);
  const email = input.email.toLowerCase();
  if (!isEmailDeliveryConfigured()) {
    verificationUnavailable(res);
    return;
  }
  if (await User.exists({ email })) {
    res.status(409).json({ error: "Email này đã được sử dụng." });
    return;
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  const verification = createEmailVerificationToken();
  const user = await User.create({
    name: input.name,
    email,
    passwordHash,
    emailVerified: false,
    emailVerificationTokenHash: verification.tokenHash,
    emailVerificationExpiresAt: verification.expiresAt,
  });
  try {
    await seedStarterData(String(user._id));
  } catch (error) {
    await Promise.all([
      Account.deleteMany({ userId: user._id }),
      Category.deleteMany({ userId: user._id }),
    ]);
    await User.deleteOne({ _id: user._id });
    throw error;
  }
  try {
    await sendEmailVerification(user.email, user.name, verification.token);
  } catch (error) {
    console.error("Không thể gửi email xác minh:", error);
    res.status(503).json({
      error: "Tài khoản đã được tạo nhưng chưa gửi được email xác minh. Hãy đăng nhập để yêu cầu gửi lại.",
      code: "VERIFICATION_EMAIL_FAILED",
    });
    return;
  }
  res.status(201).json({
    message: "Tài khoản đã được tạo. Vui lòng xác nhận email để đăng nhập.",
  });
});

router.post("/resend-verification", resendVerificationLimiter, async (req, res) => {
  const { email } = z.object({ email: z.string().trim().email().max(254) }).parse(req.body);
  if (!isEmailDeliveryConfigured()) {
    verificationUnavailable(res);
    return;
  }
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user && user.emailVerified === false) {
    const verification = createEmailVerificationToken();
    await User.updateOne(
      { _id: user._id, emailVerified: false },
      {
        $set: {
          emailVerificationTokenHash: verification.tokenHash,
          emailVerificationExpiresAt: verification.expiresAt,
        },
      },
    );
    try {
      await sendEmailVerification(user.email, user.name, verification.token);
    } catch (error) {
      console.error("Không thể gửi lại email xác minh:", error);
      res.status(503).json({
        error: "Chưa gửi được email xác minh. Vui lòng thử lại sau.",
        code: "VERIFICATION_EMAIL_FAILED",
      });
      return;
    }
  }
  res.json({
    message: "Nếu địa chỉ này có tài khoản chưa xác minh, email xác nhận sẽ được gửi.",
  });
});

router.get("/verify-email", async (req, res, next) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      res.redirect("/login?verified=invalid");
      return;
    }
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = await User.findOneAndUpdate(
      {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: { $gt: new Date() },
        emailVerified: false,
      },
      {
        $set: { emailVerified: true },
        $unset: {
          emailVerificationTokenHash: 1,
          emailVerificationExpiresAt: 1,
        },
      },
      { new: true },
    );
    res.redirect(user ? "/login?verified=success" : "/login?verified=invalid");
  } catch (error) {
    next(error);
  }
});

router.post("/login", loginAttemptLimiter, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    "+passwordHash",
  );
  if (!user) {
    res.status(404).json({ error: "Tài khoản chưa được đăng ký." });
    return;
  }
  if (!user.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
    res.status(401).json({ error: "Email hoặc mật khẩu chưa chính xác." });
    return;
  }
  if (user.emailVerified === false) {
    res.status(403).json({
      error: "Email của bạn chưa được xác minh. Hãy xác nhận email trước khi đăng nhập.",
      code: "EMAIL_NOT_VERIFIED",
    });
    return;
  }
  if (user.isActive === false) {
    res
      .status(403)
      .json({
        error:
          "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.",
        code: "ACCOUNT_DEACTIVATED",
      });
    return;
  }
  const sessionExpiresAt = setSessionCookie(res, String(user._id));
  res.json({
    sessionExpiresAt,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isAdmin: isAdminEmail(user.email),
    },
  });
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select("name email avatar");
  if (!user) {
    clearSessionCookie(res);
    res.status(401).json({ error: "Không tìm thấy tài khoản." });
    return;
  }
  res.json({
    sessionExpiresAt: req.sessionExpiresAt,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isAdmin: isAdminEmail(user.email),
    },
  });
});

router.put("/profile", requireAuth, async (req, res) => {
  const input = z
    .object({ name: z.string().trim().min(2).max(80) })
    .parse(req.body);
  const user = await User.findByIdAndUpdate(
    req.userId,
    { name: input.name },
    { new: true },
  ).select("name email avatar");
  res.json({
    user: {
      id: String(user?._id),
      name: user?.name,
      email: user?.email,
      avatar: user?.avatar,
      isAdmin: isAdminEmail(user?.email ?? ""),
    },
  });
});

export default router;
