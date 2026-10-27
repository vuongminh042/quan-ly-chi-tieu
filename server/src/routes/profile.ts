import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/core.js";
import { clearSessionCookie, isAdminEmail, requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/http.js";
import rateLimit from "express-rate-limit";
import {
  createAvatarUploadSignature,
  deleteCloudinaryAvatar,
  getCloudinaryConfig,
  isCloudinaryAvatarUrl,
  isUserAvatarPublicId,
} from "../services/cloudinary.js";
import { asyncRouter } from "../middleware/async-router.js";
import { publishAccountChanged } from "../services/support-socket.js";

const router = asyncRouter();
router.use(requireDatabase, requireAuth);
const avatarSignatureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Bạn tải ảnh quá nhiều lần. Hãy đợi ít phút rồi thử lại." },
});
router.get("/", async (req, res) => {
  const user = await User.findById(req.userId).select(
    "name email avatar avatarPublicId",
  );
  if (!user) {
    res.status(404).json({ error: "Không tìm thấy hồ sơ." });
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
router.post("/avatar-signature", avatarSignatureLimiter, (req, res) => {
  const config = getCloudinaryConfig();
  if (!config) {
    console.error("Cloudinary chưa được cấu hình trên máy chủ.");
    res.status(503).json({ error: "Hiện chưa thể tải ảnh đại diện. Vui lòng thử lại sau." });
    return;
  }
  res.json(createAvatarUploadSignature(req.userId!, config));
});
router.post("/avatar-discard", avatarSignatureLimiter, async (req, res) => {
  const input = z.object({ publicId: z.string().max(255) }).parse(req.body);
  const config = getCloudinaryConfig();
  if (!config) {
    console.error("Cloudinary chưa được cấu hình trên máy chủ.");
    res.status(503).json({ error: "Hiện chưa thể hoàn tất thao tác ảnh đại diện. Vui lòng thử lại sau." });
    return;
  }
  if (!isUserAvatarPublicId(input.publicId, req.userId!)) {
    res.status(400).json({ error: "Ảnh tải lên không thuộc tài khoản này." });
    return;
  }
  await deleteCloudinaryAvatar(input.publicId, config);
  res.status(204).end();
});
router.post("/deactivate", async (req, res) => {
  const input = z.object({ password: z.string().min(1).max(128) }).parse(req.body);
  const user = await User.findById(req.userId).select("+passwordHash isActive");
  if (!user) {
    res.status(404).json({ error: "Không tìm thấy tài khoản." });
    return;
  }
  if (!(await bcrypt.compare(input.password, user.passwordHash))) {
    res.status(400).json({ error: "Mật khẩu chưa chính xác." });
    return;
  }
  if (user.isActive === false) {
    clearSessionCookie(res);
    res.status(204).end();
    return;
  }
  await User.updateOne({ _id: user._id, isActive: { $ne: false } }, { $set: { isActive: false } });
  publishAccountChanged(String(user._id), "status");
  clearSessionCookie(res);
  res.status(204).end();
});
router.put("/", async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      avatar: z.string().url().max(2048).optional(),
      avatarPublicId: z.string().max(255).optional(),
    })
    .refine(
      (value) => value.name !== undefined || value.avatar !== undefined,
      "Cần có thông tin để cập nhật.",
    )
    .parse(req.body);
  if (input.avatar !== undefined || input.avatarPublicId !== undefined) {
    const config = getCloudinaryConfig();
    if (!config) {
      console.error("Cloudinary chưa được cấu hình trên máy chủ.");
      res.status(503).json({ error: "Hiện chưa thể lưu ảnh đại diện. Vui lòng thử lại sau." });
      return;
    }
    if (
      !input.avatar ||
      !input.avatarPublicId ||
      !isUserAvatarPublicId(input.avatarPublicId, req.userId!) ||
      !isCloudinaryAvatarUrl(input.avatar, input.avatarPublicId, config)
    ) {
      res
        .status(400)
        .json({
          error: "Ảnh tải lên không hợp lệ hoặc không thuộc tài khoản này.",
        });
      return;
    }
  }
  const currentUser = await User.findById(req.userId).select("avatarPublicId");
  if (!currentUser) {
    res.status(404).json({ error: "Không tìm thấy hồ sơ." });
    return;
  }
  const previousAvatarPublicId = currentUser.avatarPublicId;
  const user = await User.findByIdAndUpdate(req.userId, input, {
    new: true,
    runValidators: true,
  }).select("name email avatar");
  if (!user) {
    res.status(404).json({ error: "Không tìm thấy hồ sơ." });
    return;
  }
  publishAccountChanged(String(user._id), "profile");
  let warning: string | undefined;
  if (
    input.avatarPublicId &&
    previousAvatarPublicId &&
    previousAvatarPublicId !== input.avatarPublicId
  ) {
    const config = getCloudinaryConfig();
    if (config && isUserAvatarPublicId(previousAvatarPublicId, req.userId!)) {
      try {
        await deleteCloudinaryAvatar(previousAvatarPublicId, config);
      } catch (error) {
        console.error("Không thể xóa ảnh đại diện cũ khỏi Cloudinary:", error);
        warning =
          "Ảnh đã được cập nhật nhưng chưa thể xóa ảnh cũ khỏi Cloudinary.";
      }
    }
  }
  res.json({
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isAdmin: isAdminEmail(user.email),
    },
    warning,
  });
});
export default router;
