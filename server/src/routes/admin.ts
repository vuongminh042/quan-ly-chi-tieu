import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { AdminAction } from "../models/admin.js";
import { User } from "../models/core.js";
import { requireAuth, isAdminEmail } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/http.js";

const router = Router();
const pageSize = 20;
const listQuery = z.object({
  search: z.string().trim().max(120).optional().default(""),
  status: z.enum(["all", "active", "deactivated"]).optional().default("all"),
  page: z.coerce.number().int().min(1).optional().default(1),
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
      .select("name email isActive createdAt")
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
      isActive: user.isActive !== false,
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
