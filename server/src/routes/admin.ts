import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { Types } from "mongoose";
import mongoose from "mongoose";
import { z } from "zod";
import { AdminAction } from "../models/admin.js";
import { Account, Category, User } from "../models/core.js";
import { Goal, Transaction } from "../models/finance.js";
import { SupportConversation, SupportMessage } from "../models/support.js";
import { requireAuth, isAdminEmail } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/http.js";
import { asyncRouter } from "../middleware/async-router.js";
import { publishAccountChanged } from "../services/support-socket.js";
import { deleteCloudinaryAvatar, getCloudinaryConfig, isUserAvatarPublicId } from "../services/cloudinary.js";

const router = asyncRouter();
const pageSize = 20;
const listQuery = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(["all", "active", "deactivated"]).optional().default("all"),
  page: z.coerce.number().int().min(1).max(1_000_000).optional().default(1),
});

async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const admin = await User.findById(req.userId).select("email");
    if (!admin || !isAdminEmail(admin.email)) {
      res
        .status(403)
        .json({ error: "Bạn không có quyền truy cập trang quản trị." });
      return;
    }
    res.locals.adminEmail = admin.email;
    next();
  } catch (error) {
    next(error);
  }
}

router.use(requireDatabase, requireAuth, requireAdmin);

router.get("/users", async (req, res) => {
  const query = listQuery.parse(req.query);
  const filter: Record<string, unknown> = {};
  if (query.status === "active") filter.isActive = { $ne: false };
  if (query.status === "deactivated") filter.isActive = false;
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
    ];
  }
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select("name email avatar isActive createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);
  res.json({
    items: users.map((user) => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isActive: user.isActive !== false,
      isAdmin: isAdminEmail(user.email),
      createdAt: user.createdAt,
    })),
    pagination: {
      page: query.page,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

router.post("/users/:id/restore", async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ error: "Không tìm thấy tài khoản." });
    return;
  }
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, isActive: false },
    { $set: { isActive: true } },
    { new: true },
  ).select("name email");
  if (!user) {
    if (!(await User.exists({ _id: req.params.id }))) {
      res.status(404).json({ error: "Không tìm thấy tài khoản." });
      return;
    }
    res.status(409).json({ error: "Tài khoản này đang hoạt động." });
    return;
  }
  publishAccountChanged(String(user._id), "status");
  let warning: string | undefined;
  try {
    await AdminAction.create({
      adminUserId: req.userId,
      targetUserId: user._id,
      adminEmail: res.locals.adminEmail,
      targetEmail: user.email,
      action: "account_restored",
    });
  } catch (error) {
    console.error(
      "Đã khôi phục tài khoản nhưng không ghi được nhật ký quản trị:",
      error,
    );
    warning =
      "Tài khoản đã được khôi phục nhưng chưa ghi được nhật ký thao tác.";
  }
  res.json({
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      isActive: true,
    },
    warning,
  });
});

router.delete("/users/:id", async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ error: "Không tìm thấy tài khoản." });
    return;
  }
  const targetId = new Types.ObjectId(req.params.id);
  const target = await User.findById(targetId).select("email avatarPublicId");
  if (!target) {
    res.status(404).json({ error: "Không tìm thấy tài khoản." });
    return;
  }
  if (String(target._id) === req.userId) {
    res.status(409).json({ error: "Bạn không thể xóa tài khoản quản trị đang sử dụng." });
    return;
  }
  if (isAdminEmail(target.email)) {
    res.status(409).json({ error: "Không thể xóa tài khoản quản trị được cấu hình trên máy chủ." });
    return;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const conversations = await SupportConversation.find({
        $or: [{ accountUserId: targetId }, { visitorEmail: target.email }],
      }).select("_id").session(session).lean();
      const conversationIds = conversations.map((conversation) => conversation._id);
      if (conversationIds.length)
        await SupportMessage.deleteMany({ conversationId: { $in: conversationIds } }).session(session);
      await SupportConversation.deleteMany({
        $or: [{ accountUserId: targetId }, { visitorEmail: target.email }],
      }).session(session);
      await Transaction.deleteMany({ userId: targetId }).session(session);
      await Account.deleteMany({ userId: targetId }).session(session);
      await Category.deleteMany({ userId: targetId }).session(session);
      await Goal.deleteMany({ userId: targetId }).session(session);
      await AdminAction.deleteMany({
        $or: [{ adminUserId: targetId }, { targetUserId: targetId }],
      }).session(session);
      const result = await User.deleteOne({ _id: targetId }).session(session);
      if (result.deletedCount !== 1) throw new Error("Không thể xóa tài khoản.");
    });
  } finally {
    await session.endSession();
  }

  publishAccountChanged(String(targetId), "deleted");
  let warning: string | undefined;
  const cloudinary = getCloudinaryConfig();
  if (target.avatarPublicId && isUserAvatarPublicId(target.avatarPublicId, String(targetId)) && !cloudinary) {
    warning = "Tài khoản và dữ liệu đã được xóa, nhưng ảnh đại diện chưa thể xóa vì Cloudinary chưa được cấu hình.";
  } else if (cloudinary && target.avatarPublicId && isUserAvatarPublicId(target.avatarPublicId, String(targetId))) {
    try {
      await deleteCloudinaryAvatar(target.avatarPublicId, cloudinary);
    } catch (error) {
      console.error("Không thể xóa ảnh đại diện khỏi Cloudinary sau khi xóa tài khoản:", error);
      warning = "Tài khoản và dữ liệu đã được xóa, nhưng ảnh đại diện trên Cloudinary chưa xóa được.";
    }
  }
  res.json({ deleted: true, warning });
});

router.get("/actions", async (_req, res) => {
  const actions = await AdminAction.find({ action: "account_restored" })
    .select("adminEmail targetEmail action createdAt")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json({
    items: actions.map((action) => ({
      adminEmail: action.adminEmail,
      targetEmail: action.targetEmail,
      action: action.action,
      createdAt: action.createdAt,
    })),
  });
});

export default router;
