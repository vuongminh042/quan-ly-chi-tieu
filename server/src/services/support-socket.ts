import { createHash, timingSafeEqual } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { User } from "../models/core.js";
import { SupportConversation, SupportMessage } from "../models/support.js";
import { isAdminEmail, jwtSecret } from "../middleware/auth.js";

const visitorRoom = (conversationId: string) => `support:conversation:${conversationId}`;
const guestRoom = (conversationId: string) => `support:guest:${conversationId}`;
const adminRoom = "support:admins";
const accountRoom = (userId: string) => `support:account:${userId}`;

export type SupportMessageEvent = {
  id: string;
  conversationId: string;
  senderRole: "visitor" | "admin";
  senderName: string;
  content: string;
  createdAt: Date;
  deliveryStatus: "sent" | "received" | "read";
  unreadByAdmin?: number;
  unreadByVisitor?: number;
};

let supportIo: Server | null = null;
const receiptTimers = new Map<string, NodeJS.Timeout>();
const receiptDelayMs = 10_000;
const onlineUserConnections = new Map<string, number>();

export function hashSupportToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeTokenMatch(expectedHash: string, token: string): boolean {
  const actual = Buffer.from(hashSupportToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sessionCookie(cookieHeader = ""): string | undefined {
  const item = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("chitieu_session="));
  if (!item) return undefined;
  try {
    return decodeURIComponent(item.slice("chitieu_session=".length));
  } catch {
    return undefined;
  }
}

export function initSupportSocket(server: HttpServer): Server {
  const io = new Server(server, { path: "/socket.io" });
  supportIo = io;

  io.use(async (socket, next) => {
    try {
      const role = socket.handshake.auth?.role;
      if (role === "admin" || role === "user") {
        const token = sessionCookie(socket.handshake.headers.cookie);
        if (!token) return next(new Error("AUTH_REQUIRED"));
        const secret = jwtSecret();
        let payload: jwt.JwtPayload;
        try {
          payload = jwt.verify(token, secret) as jwt.JwtPayload;
        } catch {
          return next(new Error("AUTH_REQUIRED"));
        }
        if (typeof payload.sub !== "string") return next(new Error("AUTH_REQUIRED"));
        const user = await User.findById(payload.sub).select("email isActive");
        if (!user || user.isActive === false)
          return next(new Error("FORBIDDEN"));
        if (role === "admin" && !isAdminEmail(user.email))
          return next(new Error("FORBIDDEN"));
        socket.data.role = role;
        socket.data.userId = String(user._id);
        return next();
      }

      const conversationId = socket.handshake.auth?.conversationId;
      const token = socket.handshake.auth?.visitorToken;
      if (
        typeof conversationId !== "string" ||
        typeof token !== "string" ||
        token.length < 40 ||
        !Types.ObjectId.isValid(conversationId)
      )
        return next(new Error("AUTH_REQUIRED"));
      const conversation = await SupportConversation.findOne({ _id: conversationId })
        .select("+visitorTokenHash status accountUserId")
        .lean();
      if (
        !conversation ||
        conversation.accountUserId ||
        !safeTokenMatch(conversation.visitorTokenHash, token)
      )
        return next(new Error("FORBIDDEN"));
      socket.data.role = "visitor";
      socket.data.conversationId = conversationId;
      return next();
    } catch (error) {
      console.error("Không thể xác thực kết nối chat hỗ trợ:", error);
      return next(new Error("SERVER_ERROR"));
    }
  });

  io.on("connection", (socket) => {
    if (socket.data.role === "admin") {
      socket.join(adminRoom);
      socket.on(
        "support:get-online-users",
        (acknowledge?: (value: { userIds: string[] }) => void) => {
          acknowledge?.({ userIds: [...onlineUserConnections.keys()] });
        },
      );
      socket.on(
        "support:join-conversation",
        async (conversationId: unknown, acknowledge?: (value: { ok: boolean }) => void) => {
          if (typeof conversationId !== "string" || !Types.ObjectId.isValid(conversationId)) {
            acknowledge?.({ ok: false });
            return;
          }
          try {
            const exists = await SupportConversation.exists({ _id: conversationId });
            if (!exists) {
              acknowledge?.({ ok: false });
              return;
            }
            const previousConversationId = socket.data.conversationId;
            if (typeof previousConversationId === "string" && previousConversationId !== conversationId)
              socket.leave(visitorRoom(previousConversationId));
            socket.join(visitorRoom(conversationId));
            socket.data.conversationId = conversationId;
            acknowledge?.({ ok: true });
          } catch (error) {
            console.error("Không thể tham gia phòng chat hỗ trợ:", error);
            acknowledge?.({ ok: false });
          }
        },
      );
      socket.on("support:typing", async (value: unknown) => {
        const conversationId = socket.data.conversationId;
        if (
          typeof conversationId !== "string" ||
          typeof value !== "object" ||
          value === null ||
          typeof (value as { isTyping?: unknown }).isTyping !== "boolean"
        )
          return;
        try {
          const conversation = await SupportConversation.exists({
            _id: conversationId,
            status: "open",
          });
          if (!conversation) return;
          socket.to(visitorRoom(conversationId)).emit("support:typing", {
            senderRole: "admin",
            isTyping: (value as { isTyping: boolean }).isTyping,
          });
        } catch (error) {
          console.error("Không thể gửi trạng thái soạn tin của quản trị viên:", error);
        }
      });
    } else if (socket.data.role === "user") {
      const userId = socket.data.userId as string;
      const wasOnline = onlineUserConnections.has(userId);
      onlineUserConnections.set(userId, (onlineUserConnections.get(userId) ?? 0) + 1);
      socket.join(accountRoom(userId));
      if (!wasOnline)
        io.to(adminRoom).emit("support:user-presence", { userId, isOnline: true });
      socket.on(
        "support:join-account-conversation",
        async (conversationId: unknown, acknowledge?: (value: { ok: boolean }) => void) => {
          if (typeof conversationId !== "string" || !Types.ObjectId.isValid(conversationId)) {
            acknowledge?.({ ok: false });
            return;
          }
          try {
            const ownsConversation = await SupportConversation.exists({
              _id: conversationId,
              accountUserId: userId,
            });
            if (!ownsConversation) {
              acknowledge?.({ ok: false });
              return;
            }
            socket.join(visitorRoom(conversationId));
            socket.data.conversationId = conversationId;
            acknowledge?.({ ok: true });
          } catch (error) {
            console.error("Không thể tham gia phòng chat tài khoản:", error);
            acknowledge?.({ ok: false });
          }
        },
      );
      socket.on("support:typing", async (value: unknown) => {
        const conversationId = socket.data.conversationId;
        if (
          typeof conversationId !== "string" ||
          typeof value !== "object" ||
          value === null ||
          typeof (value as { isTyping?: unknown }).isTyping !== "boolean"
        )
          return;
        try {
          const ownsConversation = await SupportConversation.exists({
            _id: conversationId,
            accountUserId: userId,
            status: "open",
          });
          if (!ownsConversation) return;
          socket.to(visitorRoom(conversationId)).emit("support:typing", {
            senderRole: "visitor",
            isTyping: (value as { isTyping: boolean }).isTyping,
          });
        } catch (error) {
          console.error("Không thể gửi trạng thái soạn tin của tài khoản:", error);
        }
      });
    } else {
      socket.join(visitorRoom(socket.data.conversationId));
      socket.join(guestRoom(socket.data.conversationId));
      socket.on("support:typing", async (value: unknown) => {
        const conversationId = socket.data.conversationId;
        if (
          typeof value !== "object" ||
          value === null ||
          typeof (value as { isTyping?: unknown }).isTyping !== "boolean"
        )
          return;
        try {
          const conversation = await SupportConversation.exists({
            _id: conversationId,
            status: "open",
            accountUserId: { $exists: false },
          });
          if (!conversation) return;
          socket.to(visitorRoom(conversationId)).emit("support:typing", {
            senderRole: "visitor",
            isTyping: (value as { isTyping: boolean }).isTyping,
          });
        } catch (error) {
          console.error("Không thể gửi trạng thái soạn tin của khách:", error);
        }
      });
    }

    socket.on("disconnecting", () => {
      if (socket.data.role === "user") {
        const userId = socket.data.userId as string;
        const remainingConnections = (onlineUserConnections.get(userId) ?? 1) - 1;
        if (remainingConnections <= 0) {
          onlineUserConnections.delete(userId);
          io.to(adminRoom).emit("support:user-presence", { userId, isOnline: false });
        } else {
          onlineUserConnections.set(userId, remainingConnections);
        }
      }
      const conversationId = socket.data.conversationId;
      if (typeof conversationId !== "string") return;
      socket.to(visitorRoom(conversationId)).emit("support:typing", {
        senderRole: socket.data.role === "admin" ? "admin" : "visitor",
        isTyping: false,
      });
    });
  });

  void restorePendingReceipts();
  return io;
}

export function publishSupportMessage(message: SupportMessageEvent): void {
  if (!supportIo) return;
  scheduleMessageReceipt(message.id);
  supportIo
    .to(visitorRoom(message.conversationId))
    .emit("support:message", message);
  if (message.senderRole === "visitor") {
    supportIo.to(adminRoom).emit("support:conversation-updated", {
      id: message.conversationId,
      lastMessage: message.content,
      lastMessageAt: message.createdAt,
      senderName: message.senderName,
      unreadByAdmin: message.unreadByAdmin ?? 1,
    });
  } else {
    supportIo.to(visitorRoom(message.conversationId)).emit("support:conversation-updated", {
      id: message.conversationId,
      lastMessage: message.content,
      lastMessageAt: message.createdAt,
      unreadByVisitor: message.unreadByVisitor ?? 1,
    });
  }
}

export function publishMessageStatus(
  messageId: string,
  conversationId: string,
  senderRole: "visitor" | "admin",
  status: "received" | "read",
  statusAt: Date,
): void {
  supportIo?.to(visitorRoom(conversationId)).emit("support:message-status", {
    messageId,
    conversationId,
    senderRole,
    status,
    statusAt,
  });
}

export function publishUnreadCount(
  conversationId: string,
  recipientRole: "visitor" | "admin",
  unreadCount: number,
): void {
  if (!supportIo) return;
  const room = recipientRole === "visitor" ? visitorRoom(conversationId) : adminRoom;
  supportIo.to(room).emit("support:conversation-updated", {
    id: conversationId,
    ...(recipientRole === "visitor"
      ? { unreadByVisitor: unreadCount }
      : { unreadByAdmin: unreadCount }),
  });
}

function scheduleMessageReceipt(messageId: string, delay = receiptDelayMs): void {
  const previous = receiptTimers.get(messageId);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    receiptTimers.delete(messageId);
    void SupportMessage.findOneAndUpdate(
      { _id: messageId, deliveryStatus: "sent" },
      { $set: { deliveryStatus: "received", receivedAt: new Date() } },
      { new: true },
    )
      .then((message) => {
        if (!message) return;
        publishMessageStatus(
          String(message._id),
          String(message.conversationId),
          message.senderRole,
          "received",
          message.receivedAt ?? new Date(),
        );
      })
      .catch((error: unknown) =>
        console.error("Không thể cập nhật trạng thái đã nhận của tin nhắn:", error),
      );
  }, Math.max(0, delay));
  timer.unref();
  receiptTimers.set(messageId, timer);
}

async function restorePendingReceipts(): Promise<void> {
  try {
    const now = Date.now();
    const cutoff = new Date(now - receiptDelayMs);
    await SupportMessage.updateMany(
      { deliveryStatus: "sent", createdAt: { $lte: cutoff } },
      { $set: { deliveryStatus: "received", receivedAt: cutoff } },
    );
    const pending = await SupportMessage.find({
      deliveryStatus: "sent",
      createdAt: { $gt: cutoff },
    })
      .select("_id createdAt")
      .limit(1000)
      .lean();
    for (const message of pending) {
      scheduleMessageReceipt(
        String(message._id),
        receiptDelayMs - (now - message.createdAt.getTime()),
      );
    }
  } catch (error) {
    console.error("Không thể khôi phục bộ hẹn trạng thái tin nhắn:", error);
  }
}

export function publishSupportStatus(
  conversationId: string,
  status: "open" | "closed",
): void {
  supportIo?.to(visitorRoom(conversationId)).emit("support:status", {
    conversationId,
    status,
  });
  supportIo?.to(adminRoom).emit("support:status", { conversationId, status });
}

export function publishSupportLinked(
  conversationId: string,
  userId: string,
): void {
  if (!supportIo) return;
  supportIo.to(guestRoom(conversationId)).emit("support:linked", { conversationId });
  supportIo.in(guestRoom(conversationId)).socketsLeave(visitorRoom(conversationId));
  supportIo.to(accountRoom(userId)).emit("support:conversation-linked", { conversationId });
  supportIo.to(adminRoom).emit("support:conversation-linked", { conversationId });
}

export function publishSupportDeleted(
  conversationId: string,
  userId?: string,
): void {
  if (!supportIo) return;
  supportIo.to(guestRoom(conversationId)).emit("support:conversation-deleted", {
    conversationId,
  });
  if (userId)
    supportIo.to(accountRoom(userId)).emit("support:conversation-deleted", {
      conversationId,
    });
  supportIo.to(adminRoom).emit("support:conversation-deleted", { conversationId });
  supportIo.in(visitorRoom(conversationId)).socketsLeave(visitorRoom(conversationId));
}