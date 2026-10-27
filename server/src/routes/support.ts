import { randomBytes } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { Types } from "mongoose";
import { z } from "zod";
import { isAdminEmail, requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/http.js";
import { asyncRouter } from "../middleware/async-router.js";
import { publishAccountChanged } from "../services/support-socket.js";
import { AdminAction } from "../models/admin.js";
import { User } from "../models/core.js";
import { sensitiveSupportContentWarning } from "../services/support-content.js";
import {
  SupportConversation,
  SupportMessage,
  type SupportConversationRecord,
  type SupportMessageRecord,
} from "../models/support.js";
import {
  hashSupportToken,
  publishMessageStatus,
  publishSupportLinked,
  publishSupportDeleted,
  publishSupportMessage,
  publishSupportStatus,
  publishUnreadCount,
} from "../services/support-socket.js";

const router = asyncRouter();
const visitorLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Bạn gửi yêu cầu quá nhanh. Vui lòng chờ một chút rồi thử lại." },
});
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Bạn đã tạo quá nhiều cuộc trò chuyện. Vui lòng thử lại sau." },
});
const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(1).max(2000),
});
const messageSchema = z.object({ content: z.string().trim().min(1).max(2000) });

function rejectSensitiveContent(content: string, res: Response): boolean {
  const warning = sensitiveSupportContentWarning(content);
  if (!warning) return false;
  res.status(400).json({ error: warning, code: "SENSITIVE_SUPPORT_CONTENT" });
  return true;
}

function toMessage(
  message: SupportMessageRecord & { _id: Types.ObjectId },
) {
  return {
    id: String(message._id),
    conversationId: String(message.conversationId),
    senderRole: message.senderRole as "visitor" | "admin",
    senderName: message.senderName as string,
    content: message.content as string,
    createdAt: message.createdAt as Date,
    deliveryStatus: message.deliveryStatus ?? "received",
  };
}

function conversationSummary(
  conversation: SupportConversationRecord & { _id: Types.ObjectId },
  accountUser?: { id: string; avatar?: string },
) {
  return {
    id: String(conversation._id),
    visitorName: conversation.visitorName,
    visitorEmail: conversation.visitorEmail,
    status: conversation.status,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    unreadByAdmin: conversation.unreadByAdmin,
    unreadByVisitor: conversation.unreadByVisitor,
    isAccountLinked: Boolean(conversation.accountUserId),
    accountUserId: accountUser?.id ??
      (conversation.accountUserId ? String(conversation.accountUserId) : undefined),
    visitorAvatar: accountUser?.avatar,
  };
}

async function markIncomingMessagesRead(
  conversationId: Types.ObjectId,
  recipientRole: "visitor" | "admin",
) {
  const senderRole = recipientRole === "visitor" ? "admin" : "visitor";
  const pending = await SupportMessage.find({
    conversationId,
    senderRole,
    deliveryStatus: { $in: ["sent", "received"] },
  })
    .select("_id senderRole")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  const readAt = new Date();
  for (const item of pending) {
    const message = await SupportMessage.findOneAndUpdate(
      { _id: item._id, deliveryStatus: { $in: ["sent", "received"] } },
      { $set: { deliveryStatus: "read", readAt } },
      { new: true },
    );
    if (message)
      publishMessageStatus(
        String(message._id),
        String(message.conversationId),
        message.senderRole,
        "read",
        readAt,
      );
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await User.findById(req.userId).select("email name isActive");
    if (!admin || admin.isActive === false || !isAdminEmail(admin.email)) {
      res.status(403).json({ error: "Bạn không có quyền truy cập hộp thư hỗ trợ." });
      return;
    }
    res.locals.adminName = admin.name;
    res.locals.adminEmail = admin.email;
    next();
  } catch (error) {
    next(error);
  }
}

function validateConversationId(value: string | string[], res: Response): value is string {
  if (typeof value === "string" && Types.ObjectId.isValid(value)) return true;
  res.status(404).json({ error: "Không tìm thấy cuộc trò chuyện." });
  return false;
}

async function requireVisitorConversation(req: Request, res: Response) {
  const token = req.get("x-support-token");
  if (!token || token.length < 40) {
    res.status(401).json({ error: "Phiên hỗ trợ không hợp lệ. Hãy bắt đầu cuộc trò chuyện mới." });
    return null;
  }
  const conversation = await SupportConversation.findOne({
    _id: req.params.id,
    visitorTokenHash: hashSupportToken(token),
  });
  if (!conversation) {
    res.status(404).json({ error: "Không tìm thấy cuộc trò chuyện hỗ trợ." });
    return null;
  }
  if (conversation.accountUserId) {
    res.status(409).json({
      error: "Cuộc trò chuyện đã được chuyển vào tài khoản. Hãy đăng nhập để tiếp tục.",
      code: "SUPPORT_CONVERSATION_LINKED",
    });
    return null;
  }
  return conversation;
}

router.use(requireDatabase);

router.post("/conversations", createLimiter, async (req, res) => {
  const input = createSchema.parse(req.body);
  if (rejectSensitiveContent(input.message, res)) return;
  const visitorToken = randomBytes(32).toString("base64url");
  const conversation = await SupportConversation.create({
    visitorName: input.name,
    visitorEmail: input.email.toLowerCase(),
    visitorTokenHash: hashSupportToken(visitorToken),
    status: "open",
    lastMessage: input.message,
  });
  try {
    const message = await SupportMessage.create({
      conversationId: conversation._id,
      senderRole: "visitor",
      senderName: input.name,
      content: input.message,
    });
    const result = toMessage(message);
    publishSupportMessage({
      ...result,
      unreadByAdmin: conversation.unreadByAdmin,
    });
    res.status(201).json({
      conversation: conversationSummary(conversation),
      visitorToken,
      messages: [result],
    });
  } catch (error) {
    await SupportConversation.deleteOne({ _id: conversation._id });
    throw error;
  }
});

router.get("/conversations/:id", visitorLimiter, async (req, res) => {
  if (!validateConversationId(req.params.id, res)) return;
  const conversation = await requireVisitorConversation(req, res);
  if (!conversation) return;
  res.json({ conversation: conversationSummary(conversation) });
});

router.get("/conversations/:id/messages", visitorLimiter, async (req, res) => {
  if (!validateConversationId(req.params.id, res)) return;
  const conversation = await requireVisitorConversation(req, res);
  if (!conversation) return;
  const updatedConversation = await SupportConversation.findOneAndUpdate(
    { _id: conversation._id, accountUserId: { $exists: false } },
    { $set: { unreadByVisitor: 0 } },
    { new: true },
  );
  if (!updatedConversation) {
    if (await SupportConversation.exists({ _id: conversation._id, accountUserId: { $exists: true } })) {
      res.status(409).json({
        error: "Cuộc trò chuyện đã được chuyển vào tài khoản. Hãy đăng nhập để tiếp tục.",
        code: "SUPPORT_CONVERSATION_LINKED",
      });
      return;
    }
    res.status(404).json({ error: "Không tìm thấy cuộc trò chuyện hỗ trợ." });
    return;
  }
  await markIncomingMessagesRead(updatedConversation._id, "visitor");
  publishUnreadCount(String(updatedConversation._id), "visitor", 0);
  const messages = await SupportMessage.find({ conversationId: updatedConversation._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({
    conversation: conversationSummary(updatedConversation),
    messages: messages.reverse().map(toMessage),
  });
});

router.post("/conversations/:id/messages", visitorLimiter, async (req, res) => {
  if (!validateConversationId(req.params.id, res)) return;
  const conversation = await requireVisitorConversation(req, res);
  if (!conversation) return;
  if (conversation.status !== "open") {
    res.status(409).json({ error: "Cuộc trò chuyện đã kết thúc. Hãy bắt đầu cuộc trò chuyện mới." });
    return;
  }
  const { content } = messageSchema.parse(req.body);
  if (rejectSensitiveContent(content, res)) return;
  const message = await SupportMessage.create({
    conversationId: conversation._id,
    senderRole: "visitor",
    senderName: conversation.visitorName,
    content,
  });
  const updatedConversation = await SupportConversation.findOneAndUpdate(
    { _id: conversation._id, status: "open", accountUserId: { $exists: false } },
    {
      $set: { lastMessage: content, lastMessageAt: message.createdAt },
      $inc: { unreadByAdmin: 1 },
    },
    { new: true },
  );
  if (!updatedConversation) {
    await SupportMessage.deleteOne({ _id: message._id });
    if (await SupportConversation.exists({ _id: conversation._id, accountUserId: { $exists: true } })) {
      res.status(409).json({
        error: "Cuộc trò chuyện đã được chuyển vào tài khoản. Hãy đăng nhập để tiếp tục.",
        code: "SUPPORT_CONVERSATION_LINKED",
      });
      return;
    }
    res.status(409).json({ error: "Cuộc trò chuyện đã kết thúc. Hãy bắt đầu cuộc trò chuyện mới." });
    return;
  }
  const result = toMessage(message);
  publishSupportMessage({
    ...result,
    unreadByAdmin: updatedConversation.unreadByAdmin,
  });
  res.status(201).json({ message: result });
});

router.use("/account", requireAuth);

router.get("/account/conversation", async (req, res) => {
  const conversation = await SupportConversation.findOne({ accountUserId: req.userId })
    .sort({ lastMessageAt: -1 })
    .lean();
  res.json({ conversation: conversation ? conversationSummary(conversation) : null });
});

router.get("/account/conversation/messages", async (req, res) => {
  const conversation = await SupportConversation.findOne({ accountUserId: req.userId });
  if (!conversation) {
    res.status(404).json({ error: "Tài khoản chưa có hội thoại hỗ trợ." });
    return;
  }
  const updatedConversation = await SupportConversation.findOneAndUpdate(
    { _id: conversation._id, accountUserId: req.userId },
    { $set: { unreadByVisitor: 0 } },
    { new: true },
  );
  if (!updatedConversation) {
    res.status(404).json({ error: "Không tìm thấy hội thoại hỗ trợ." });
    return;
  }
  await markIncomingMessagesRead(updatedConversation._id, "visitor");
  publishUnreadCount(String(updatedConversation._id), "visitor", 0);
  const messages = await SupportMessage.find({ conversationId: updatedConversation._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({
    conversation: conversationSummary(updatedConversation),
    messages: messages.reverse().map(toMessage),
  });
});

router.post("/account/conversation/messages", async (req, res) => {
  const { content } = messageSchema.parse(req.body);
  if (rejectSensitiveContent(content, res)) return;
  const accountUser = await User.findById(req.userId).select("name");
  if (!accountUser) {
    res.status(404).json({ error: "Không tìm thấy tài khoản." });
    return;
  }
  const conversation = await SupportConversation.findOne({
    accountUserId: req.userId,
    status: "open",
  });
  if (!conversation) {
    res.status(409).json({ error: "Hội thoại hỗ trợ đã đóng." });
    return;
  }
  const message = await SupportMessage.create({
    conversationId: conversation._id,
    senderRole: "visitor",
    senderName: accountUser.name,
    content,
  });
  const updatedConversation = await SupportConversation.findOneAndUpdate(
    { _id: conversation._id, accountUserId: req.userId, status: "open" },
    {
      $set: { lastMessage: content, lastMessageAt: message.createdAt },
      $inc: { unreadByAdmin: 1 },
    },
    { new: true },
  );
  if (!updatedConversation) {
    await SupportMessage.deleteOne({ _id: message._id });
    res.status(409).json({ error: "Hội thoại hỗ trợ đã đóng." });
    return;
  }
  const result = toMessage(message);
  publishSupportMessage({
    ...result,
    unreadByAdmin: updatedConversation.unreadByAdmin,
  });
  res.status(201).json({ message: result });
});

router.use("/admin", requireAuth, requireAdmin);

router.get("/admin/conversations", async (req, res) => {
  const status = req.query.status === "closed" ? "closed" : "open";
  const conversations = await SupportConversation.find({ status })
    .sort({ lastMessageAt: -1, _id: -1 })
    .limit(100)
    .lean();
  const accountUsers = await User.find({
    email: { $in: conversations.map((conversation) => conversation.visitorEmail) },
  })
    .select("_id email avatar")
    .lean();
  const accountsByEmail = new Map(
    accountUsers.map((user) => [
      user.email,
      { id: String(user._id), avatar: user.avatar },
    ]),
  );
  res.json({
    items: conversations.map((conversation) =>
      conversationSummary(
        conversation,
        accountsByEmail.get(conversation.visitorEmail),
      ),
    ),
  });
});

router.get("/admin/conversations/:id/messages", async (req, res) => {
  if (!validateConversationId(req.params.id, res)) return;
  const conversation = await SupportConversation.findById(req.params.id);
  if (!conversation) {
    res.status(404).json({ error: "Không tìm thấy cuộc trò chuyện." });
    return;
  }
  const updatedConversation = await SupportConversation.findByIdAndUpdate(
    conversation._id,
    { $set: { unreadByAdmin: 0 } },
    { new: true },
  );
  if (!updatedConversation) {
    res.status(404).json({ error: "Không tìm thấy cuộc trò chuyện." });
    return;
  }
  await markIncomingMessagesRead(updatedConversation._id, "admin");
  publishUnreadCount(String(updatedConversation._id), "admin", 0);
  const messages = await SupportMessage.find({ conversationId: updatedConversation._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  const accountUser = await User.findOne({ email: updatedConversation.visitorEmail })
    .select("_id avatar");
  res.json({
    conversation: conversationSummary(
      updatedConversation,
      accountUser
        ? { id: String(accountUser._id), avatar: accountUser.avatar }
        : undefined,
    ),
    messages: messages.reverse().map(toMessage),
  });
});

router.post("/admin/conversations/:id/restore-and-link-account", async (req, res) => {
  if (!validateConversationId(req.params.id, res)) return;
  const conversation = await SupportConversation.findById(req.params.id);
  if (!conversation) {
    res.status(404).json({ error: "Không tìm thấy cuộc trò chuyện." });
    return;
  }
  if (conversation.accountUserId) {
    res.status(409).json({ error: "Cuộc trò chuyện đã được liên kết với tài khoản." });
    return;
  }
  const user = await User.findOne({
    email: conversation.visitorEmail.toLowerCase(),
  }).select("_id name email isActive");
  if (!user) {
    res.status(404).json({
      error: "Không tìm thấy tài khoản đã đăng ký với email trong hội thoại.",
    });
    return;
  }
  if (await SupportConversation.exists({ accountUserId: user._id })) {
    res.status(409).json({
      error: "Tài khoản này đã có hội thoại hỗ trợ được liên kết.",
    });
    return;
  }
  const restored = user.isActive === false;
  if (restored) {
    const activatedUser = await User.findOneAndUpdate(
      { _id: user._id, isActive: false },
      { $set: { isActive: true } },
      { new: true },
    );
    if (!activatedUser && (await User.exists({ _id: user._id, isActive: false }))) {
      res.status(409).json({ error: "Không thể khôi phục tài khoản lúc này. Hãy thử lại." });
      return;
    }
    if (activatedUser) publishAccountChanged(String(user._id), "status");
  }
  let warning: string | undefined;
  if (restored) {
    try {
      await AdminAction.create({
        adminUserId: req.userId,
        targetUserId: user._id,
        adminEmail: res.locals.adminEmail,
        targetEmail: user.email,
        action: "account_restored",
      });
    } catch (error) {
      console.error("Đã khôi phục tài khoản nhưng không ghi được nhật ký quản trị:", error);
      warning = "Tài khoản đã được khôi phục nhưng chưa ghi được nhật ký thao tác.";
    }
  }
  let linkedConversation;
  try {
    linkedConversation = await SupportConversation.findOneAndUpdate(
      { _id: conversation._id, accountUserId: { $exists: false } },
      { $set: { accountUserId: user._id, status: "open" } },
      { new: true },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        error: "Tài khoản vừa được liên kết với một hội thoại khác.",
        warning,
      });
      return;
    }
    throw error;
  }
  if (!linkedConversation) {
    res.status(409).json({
      error: restored
        ? "Tài khoản đã được khôi phục, nhưng hội thoại chưa được chuyển. Hãy tải lại và thử chuyển lại."
        : "Cuộc trò chuyện vừa được liên kết ở nơi khác.",
      warning,
    });
    return;
  }
  publishSupportStatus(String(linkedConversation._id), "open");
  publishSupportLinked(String(linkedConversation._id), String(user._id));
  res.json({
    conversation: conversationSummary(linkedConversation),
    user: { id: String(user._id), name: user.name, email: user.email, isActive: true },
    warning,
  });
});

router.delete("/admin/conversations/:id", async (req, res) => {
  if (!validateConversationId(req.params.id, res)) return;
  const conversation = await SupportConversation.findOneAndUpdate(
    { _id: req.params.id },
    { $set: { status: "closed" } },
    { new: true },
  );
  if (!conversation) {
    res.status(404).json({ error: "Không tìm thấy cuộc trò chuyện." });
    return;
  }

  await SupportMessage.deleteMany({ conversationId: conversation._id });
  const deleted = await SupportConversation.deleteOne({ _id: conversation._id });
  if (deleted.deletedCount !== 1) {
    res.status(409).json({
      error: "Tin nhắn đã được xóa nhưng không thể xóa hội thoại. Hãy thử lại.",
    });
    return;
  }

  publishSupportDeleted(
    String(conversation._id),
    conversation.accountUserId ? String(conversation.accountUserId) : undefined,
  );
  res.status(204).end();
});

router.post("/admin/conversations/:id/messages", async (req, res) => {
  if (!validateConversationId(req.params.id, res)) return;
  const conversation = await SupportConversation.findById(req.params.id);
  if (!conversation) {
    res.status(404).json({ error: "Không tìm thấy cuộc trò chuyện." });
    return;
  }
  if (conversation.status !== "open") {
    res.status(409).json({ error: "Cuộc trò chuyện đã đóng. Hãy mở lại trước khi trả lời." });
    return;
  }
  const { content } = messageSchema.parse(req.body);
  if (rejectSensitiveContent(content, res)) return;
  const message = await SupportMessage.create({
    conversationId: conversation._id,
    senderRole: "admin",
    senderName: res.locals.adminName,
    content,
  });
  const updatedConversation = await SupportConversation.findOneAndUpdate(
    { _id: conversation._id, status: "open" },
    {
      $set: { lastMessage: content, lastMessageAt: message.createdAt },
      $inc: { unreadByVisitor: 1 },
    },
    { new: true },
  );
  if (!updatedConversation) {
    await SupportMessage.deleteOne({ _id: message._id });
    res.status(409).json({ error: "Cuộc trò chuyện đã đóng. Hãy bắt đầu cuộc trò chuyện mới." });
    return;
  }
  const result = toMessage(message);
  publishSupportMessage({
    ...result,
    unreadByVisitor: updatedConversation.unreadByVisitor,
  });
  res.status(201).json({ message: result });
});

router.patch("/admin/conversations/:id/status", async (req, res) => {
  if (!validateConversationId(req.params.id, res)) return;
  const { status } = z.object({ status: z.enum(["open", "closed"]) }).parse(req.body);
  const conversation = await SupportConversation.findByIdAndUpdate(
    req.params.id,
    { $set: { status, ...(status === "open" ? { unreadByAdmin: 0 } : {}) } },
    { new: true },
  );
  if (!conversation) {
    res.status(404).json({ error: "Không tìm thấy cuộc trò chuyện." });
    return;
  }
  publishSupportStatus(String(conversation._id), status);
  res.json({ conversation: conversationSummary(conversation) });
});

export default router;
