import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { User, Account, Category } from "../models/core.js";
import {
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
  isAdminEmail,
} from "../middleware/auth.js";
import { requireDatabase } from "../middleware/http.js";
import { loginSchema, registerSchema } from "./validation.js";

const router = Router();
router.use(requireDatabase);
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

router.post("/register", async (req, res) => {
  const input = registerSchema.parse(req.body);
  const email = input.email.toLowerCase();
  if (await User.exists({ email })) {
    res.status(409).json({ error: "Email này đã được sử dụng." });
    return;
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({ name: input.name, email, passwordHash });
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
  res
    .status(201)
    .json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isAdmin: isAdminEmail(user.email),
      },
    });
});

router.post("/login", loginAttemptLimiter, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    "+passwordHash",
  );
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    res.status(401).json({ error: "Email hoặc mật khẩu chưa chính xác." });
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
  setSessionCookie(res, String(user._id));
  res.json({
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
