import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, MessageCircle, Send, RefreshCw, Trash2 } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import axios from "axios";
import { get, http, patch, post } from "../lib/api";
import { sensitiveSupportContentWarning } from "../lib/support-content";
import { useConfirm } from "./ConfirmDialog";

type Conversation = {
  id: string;
  visitorName: string;
  visitorEmail: string;
  status: "open" | "closed";
  lastMessage: string;
  lastMessageAt: string;
  unreadByAdmin: number;
  unreadByVisitor: number;
  isAccountLinked?: boolean;
  accountUserId?: string;
  visitorAvatar?: string;
};
type Message = {
  id: string;
  conversationId: string;
  senderRole: "visitor" | "admin";
  senderName: string;
  content: string;
  createdAt: string;
  deliveryStatus: "sent" | "received" | "read";
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function apiError(error: unknown) {
  return axios.isAxiosError<{ error?: string }>(error)
    ? error.response?.data?.error ?? "Không thể tải hộp thư hỗ trợ."
    : error instanceof Error
      ? error.message
      : "Không thể xử lý yêu cầu.";
}

export function AdminSupportInbox() {
  const confirm = useConfirm();
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [linking, setLinking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const conversationRequestId = useRef(0);
  const messageRequestId = useRef(0);
  const typingActiveRef = useRef(false);
  const [visitorTyping, setVisitorTyping] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set());
  const threadMessagesRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const loadConversations = useCallback(async () => {
    const currentRequestId = ++conversationRequestId.current;
    const result = await get<{ items: Conversation[] }>("/support/admin/conversations", { status });
    if (currentRequestId !== conversationRequestId.current) return;
    setConversations(result.items);
    setSelected((current) => {
      if (!current) return result.items[0] ?? null;
      return result.items.find((item) => item.id === current.id) ?? result.items[0] ?? null;
    });
  }, [status]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const currentRequestId = ++messageRequestId.current;
    const result = await get<{ conversation: Conversation; messages: Message[] }>(
      `/support/admin/conversations/${conversationId}/messages`,
    );
    if (currentRequestId !== messageRequestId.current) return;
    setSelected((current) =>
      current?.id === conversationId ? result.conversation : current,
    );
    setMessages(result.messages);
    setConversations((current) =>
      current.map((item) =>
        item.id === conversationId ? { ...item, unreadByAdmin: 0 } : item,
      ),
    );
  }, []);

  const addMessage = useCallback((message: Message) => {
    setMessages((current) =>
      current.some((item) => item.id === message.id)
        ? current
        : [...current, message],
    );
  }, []);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    void loadConversations()
      .catch((loadError: unknown) => {
        if (active) setError(apiError(loadError));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [loadConversations]);

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      auth: { role: "admin" },
      withCredentials: true,
    });
    socketRef.current = socket;
    socket.on("support:conversation-updated", (update: { id: string; unreadByAdmin?: number }) => {
      if (update.id === selected?.id && update.unreadByAdmin && selected.status === "open") {
        void loadMessages(selected.id).catch((loadError: unknown) => setError(apiError(loadError)));
        return;
      }
      void loadConversations().catch((loadError: unknown) => setError(apiError(loadError)));
    });
    socket.on("support:message", (message: Message) => {
      if (message.conversationId === selected?.id) addMessage(message);
    });
    socket.on(
      "support:message-status",
      (update: {
        messageId: string;
        senderRole: "visitor" | "admin";
        status: Message["deliveryStatus"];
      }) => {
        if (update.senderRole !== "admin") return;
        setMessages((current) =>
          current.map((message) =>
            message.id === update.messageId
              ? { ...message, deliveryStatus: update.status }
              : message,
          ),
        );
      },
    );
    socket.on("support:typing", (update: { senderRole: "admin" | "visitor"; isTyping: boolean }) => {
      if (update.senderRole !== "visitor") return;
      setVisitorTyping(update.isTyping);
    });
    socket.on("support:status", (update: { conversationId: string; status: "open" | "closed" }) => {
      if (update.conversationId !== selected?.id) return;
      setSelected((current) => current ? { ...current, status: update.status } : current);
      void loadConversations().catch((loadError: unknown) => setError(apiError(loadError)));
    });
    socket.on("support:conversation-linked", (update: { conversationId: string }) => {
      void loadConversations().catch((loadError: unknown) => setError(apiError(loadError)));
      if (update.conversationId === selected?.id)
        void loadMessages(update.conversationId).catch((loadError: unknown) => setError(apiError(loadError)));
    });
    socket.on("support:conversation-deleted", (update: { conversationId: string }) => {
      if (update.conversationId === selected?.id) {
        setMessages([]);
        setDraft("");
        setSelected(null);
      }
      void loadConversations().catch((loadError: unknown) => setError(apiError(loadError)));
    });
    socket.on(
      "support:user-presence",
      (update: { userId: string; isOnline: boolean }) => {
        setOnlineUserIds((current) => {
          const next = new Set(current);
          if (update.isOnline) next.add(update.userId);
          else next.delete(update.userId);
          return next;
        });
      },
    );
    socket.on("connect_error", () => {
      setError("Kết nối realtime bị gián đoạn. Hộp thư vẫn có thể tải lại thủ công.");
    });
    socket.on("disconnect", () => setVisitorTyping(false));
    socket.on("connect", () => {
      setError("");
      socket.emit(
        "support:get-online-users",
        (result: { userIds: string[] }) => setOnlineUserIds(new Set(result.userIds)),
      );
      void loadConversations().catch((loadError: unknown) => setError(apiError(loadError)));
      if (selected) {
        socket.emit("support:join-conversation", selected.id, (result: { ok: boolean }) => {
          if (!result.ok)
            setError("Không thể tham gia cuộc trò chuyện realtime. Hãy chọn lại hội thoại.");
          else if (typingActiveRef.current)
            socket.emit("support:typing", { isTyping: true });
        });
        void loadMessages(selected.id).catch((loadError: unknown) => setError(apiError(loadError)));
      }
    });
    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [addMessage, loadConversations, loadMessages, selected?.id, selected?.status]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      setVisitorTyping(false);
      return;
    }
    setVisitorTyping(false);
    shouldAutoScrollRef.current = true;
    let active = true;
    setMessages([]);
    void loadMessages(selected.id).catch((loadError: unknown) => {
      if (active) setError(apiError(loadError));
    });
    if (socketRef.current?.connected)
      socketRef.current.emit("support:join-conversation", selected.id, (result: { ok: boolean }) => {
        if (!result.ok)
          setError("Không thể tham gia cuộc trò chuyện realtime. Hãy chọn lại hội thoại.");
      });
    return () => {
      stopTyping();
      active = false;
      messageRequestId.current += 1;
    };
  }, [loadMessages, selected?.id]);

  useEffect(() => {
    const container = threadMessagesRef.current;
    if (container && shouldAutoScrollRef.current)
      container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const container = threadMessagesRef.current;
    if (visitorTyping && container) {
      shouldAutoScrollRef.current = true;
      container.scrollTop = container.scrollHeight;
    }
  }, [visitorTyping]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !draft.trim() || sending) return;
    const sensitiveContentWarning = sensitiveSupportContentWarning(draft.trim());
    if (sensitiveContentWarning) {
      setError(sensitiveContentWarning);
      return;
    }
    stopTyping();
    setSending(true);
    setError("");
    try {
      const result = await post<{ message: Message }>(
        `/support/admin/conversations/${selected.id}/messages`,
        { content: draft.trim() },
      );
      addMessage(result.message);
      setDraft("");
      await loadConversations();
    } catch (sendError) {
      setError(apiError(sendError));
    } finally {
      setSending(false);
    }
  }

  function stopTyping() {
    if (typingActiveRef.current)
      socketRef.current?.emit("support:typing", { isTyping: false });
    typingActiveRef.current = false;
  }

  function startTyping() {
    if (!selected || selected.status !== "open" || typingActiveRef.current) return;
    socketRef.current?.emit("support:typing", { isTyping: true });
    typingActiveRef.current = true;
  }

  function updateDraft(value: string) {
    setDraft(value);
  }

  async function changeStatus(nextStatus: "open" | "closed") {
    if (!selected) return;
    stopTyping();
    setError("");
    try {
      const result = await patch<{ conversation: Conversation }>(
        `/support/admin/conversations/${selected.id}/status`,
        { status: nextStatus },
      );
      setSelected(result.conversation);
      await loadConversations();
    } catch (statusError) {
      setError(apiError(statusError));
    }
  }

  async function linkConversationToAccount() {
    if (!selected || selected.isAccountLinked) return;
    if (!await confirm({
      title: "Chuyển hội thoại vào tài khoản?",
      message: `Tài khoản đăng ký bằng ${selected.visitorEmail} sẽ được khôi phục nếu đang vô hiệu hóa, rồi hội thoại được chuyển sang tài khoản đó. Khách sẽ không còn truy cập được bằng phiên chat ẩn danh; chỉ tài khoản đã đăng nhập mới xem và nhắn tiếp được. Chỉ xác nhận nếu bạn đã xác minh đúng chủ tài khoản.`,
      confirmLabel: "Chuyển hội thoại",
    })) return;
    setLinking(true);
    setError("");
    try {
      const result = await post<{ warning?: string }>(
        `/support/admin/conversations/${selected.id}/restore-and-link-account`,
      );
      if (result.warning) setError(result.warning);
      await Promise.all([loadMessages(selected.id), loadConversations()]);
    } catch (linkError) {
      setError(apiError(linkError));
    } finally {
      setLinking(false);
    }
  }

  async function deleteConversation() {
    if (!selected || deleting) return;
    if (!await confirm({
      title: "Xóa toàn bộ đoạn chat?",
      message: `Toàn bộ hội thoại với ${selected.visitorName} (${selected.visitorEmail}) và tất cả tin nhắn sẽ bị xóa vĩnh viễn. Người dùng đang mở đoạn chat này cũng sẽ bị ngắt khỏi hội thoại. Không thể hoàn tác.`,
      confirmLabel: "Xóa toàn bộ chat",
    })) return;
    setDeleting(true);
    setError("");
    try {
      await http.delete(`/support/admin/conversations/${selected.id}`);
      setSelected(null);
      setMessages([]);
      setDraft("");
      await loadConversations();
    } catch (deleteError) {
      setError(apiError(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  const totalUnread = conversations.reduce(
    (sum, conversation) => sum + conversation.unreadByAdmin,
    0,
  );

  return (
    <section className="support-inbox panel">
      <div className="support-inbox-title">
        <div>
          <span className="eyebrow">CHĂM SÓC KHÁCH HÀNG</span>
          <h2>
            <MessageCircle size={17} /> Hộp thư hỗ trợ
            {totalUnread > 0 && <span className="support-inbox-badge" aria-label={`${totalUnread} tin chưa đọc`}>{totalUnread > 99 ? "99+" : totalUnread}</span>}
          </h2>
        </div>
        <button
          className="support-refresh"
          type="button"
          onClick={() => void loadConversations().catch((loadError: unknown) => setError(apiError(loadError)))}
          aria-label="Làm mới hộp thư"
        >
          <RefreshCw size={15} />
        </button>
      </div>
      <div className="support-inbox-tabs" role="tablist" aria-label="Lọc cuộc trò chuyện">
        <button className={status === "open" ? "active" : ""} onClick={() => setStatus("open")} type="button">
          Đang mở
        </button>
        <button className={status === "closed" ? "active" : ""} onClick={() => setStatus("closed")} type="button">
          Đã đóng
        </button>
      </div>
      {error && <div className="support-admin-error" role="alert">{error}</div>}
      <div className="support-inbox-body">
        <aside className="support-conversation-list" aria-label="Danh sách hội thoại">
          {busy ? <div className="support-inbox-empty">Đang tải…</div> : conversations.length ? conversations.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              className={`support-conversation-item ${selected?.id === conversation.id ? "selected" : ""}`}
              onClick={() => setSelected(conversation)}
            >
              <span className="support-conversation-avatar">
                {conversation.visitorName.slice(0, 1).toUpperCase()}
                {conversation.visitorAvatar && (
                  <img
                    src={conversation.visitorAvatar}
                    alt=""
                    onError={(event) => { event.currentTarget.style.display = "none"; }}
                  />
                )}
              </span>
              <span className="support-conversation-copy">
                <strong>{conversation.visitorName}</strong>
                <small>{conversation.lastMessage}</small>
              </span>
              <span className="support-conversation-meta">
                <small>{formatTime(conversation.lastMessageAt)}</small>
                {!!conversation.unreadByAdmin && <i>{conversation.unreadByAdmin}</i>}
              </span>
            </button>
          )) : <div className="support-inbox-empty">Chưa có cuộc trò chuyện {status === "open" ? "đang mở" : "đã đóng"}.</div>}
        </aside>
        {selected ? (
          <div className="support-thread">
            <header className="support-thread-header">
              <div>
                <span className="support-thread-identity">
                  <span className="support-thread-avatar">
                    {selected.visitorName.slice(0, 1).toUpperCase()}
                    {selected.visitorAvatar && (
                      <img
                        src={selected.visitorAvatar}
                        alt=""
                        onError={(event) => { event.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </span>
                  <span className="support-thread-user">
                    <strong>{selected.visitorName}</strong>
                    <small
                      className={`support-presence ${selected.accountUserId && onlineUserIds.has(selected.accountUserId) ? "online" : "offline"}`}
                      aria-label={selected.accountUserId && onlineUserIds.has(selected.accountUserId) ? "Khách hàng đang trực tuyến" : "Khách hàng đang ngoại tuyến"}
                    >
                      <i />
                      {selected.accountUserId && onlineUserIds.has(selected.accountUserId) ? "Đang online" : "Đang offline"}
                    </small>
                  </span>
                </span>
              </div>
              <div className="support-thread-actions">
                {!selected.isAccountLinked && (
                  <button
                    type="button"
                    className="support-link-account-button"
                    onClick={() => void linkConversationToAccount()}
                    disabled={linking}
                  >
                    {linking ? "Đang khôi phục…" : "Khôi phục & chuyển chat"}
                  </button>
                )}
                {selected.isAccountLinked && <small className="support-account-linked">Đã liên kết tài khoản</small>}
                <button
                  type="button"
                  className={`support-status-button ${selected.status}`}
                  onClick={() => void changeStatus(selected.status === "open" ? "closed" : "open")}
                >
                  {selected.status === "open" ? "Đóng hội thoại" : "Mở lại"}
                </button>
                <button
                  type="button"
                  className="support-delete-button"
                  onClick={() => void deleteConversation()}
                  disabled={deleting}
                  aria-label={`Xóa toàn bộ chat với ${selected.visitorName}`}
                  title="Xóa toàn bộ đoạn chat"
                >
                  <Trash2 size={14} />
                  {deleting ? "Đang xóa…" : "Xóa chat"}
                </button>
              </div>
            </header>
            <div
              className="support-thread-messages"
              aria-live="polite"
              ref={threadMessagesRef}
              onScroll={(event) => {
                const container = event.currentTarget;
                shouldAutoScrollRef.current =
                  container.scrollHeight - container.scrollTop - container.clientHeight < 80;
              }}
            >
              {messages.map((message) => (
                <div key={message.id} className={`support-thread-message ${message.senderRole}`}>
                  <small>{message.senderName} · {formatTime(message.createdAt)}</small>
                  <p>{message.content}</p>
                  {message.senderRole === "admin" && (
                    <span className="support-message-status">
                      {message.deliveryStatus === "read" ? (
                        <span
                          className="support-read-avatar"
                          title={`Đã xem bởi ${selected.visitorName}`}
                          aria-label={`Đã xem bởi ${selected.visitorName}`}
                        >
                          {selected.visitorName.slice(0, 1).toUpperCase()}
                          {selected.visitorAvatar && (
                            <img
                              src={selected.visitorAvatar}
                              alt=""
                              onError={(event) => { event.currentTarget.style.display = "none"; }}
                            />
                          )}
                        </span>
                      ) : (
                        <>
                          <Check size={12} />
                          {message.deliveryStatus === "received" ? "Đã nhận" : "Đã gửi"}
                        </>
                      )}
                    </span>
                  )}
                </div>
              ))}
              {visitorTyping && <div className="support-typing">{selected.visitorName} đang soạn tin…</div>}
            </div>
            {selected.status === "open" && (
              <form className="support-admin-compose" onSubmit={sendMessage}>
                <textarea
                  value={draft}
                  onChange={(event) => updateDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  onFocus={startTyping}
                  onBlur={stopTyping}
                  placeholder="Trả lời khách hàng…"
                  aria-label="Tin nhắn trả lời"
                  maxLength={2000}
                  rows={2}
                  required
                />
                <button type="submit" disabled={!draft.trim() || sending} aria-label="Gửi phản hồi">
                  <Send size={17} />
                </button>
              </form>
            )}
          </div>
        ) : <div className="support-thread-empty">Chọn một cuộc trò chuyện để xem nội dung.</div>}
      </div>
    </section>
  );
}
