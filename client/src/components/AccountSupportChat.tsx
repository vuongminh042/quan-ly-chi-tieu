import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, CheckCheck, Headset, MessageCircle, Send, X } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import axios from "axios";
import { http } from "../lib/api";
import { sensitiveSupportContentWarning } from "../lib/support-content";
import "./support-chat.css";

type SupportConversation = {
  id: string;
  visitorName: string;
  visitorEmail: string;
  status: "open" | "closed";
  lastMessage: string;
  lastMessageAt: string;
  unreadByVisitor: number;
};
type SupportMessage = {
  id: string;
  conversationId: string;
  senderRole: "visitor" | "admin";
  senderName: string;
  content: string;
  createdAt: string;
  deliveryStatus: "sent" | "received" | "read";
};

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: string }>(error))
    return error.response?.data?.error ?? "Không thể kết nối hỗ trợ. Vui lòng thử lại.";
  return error instanceof Error ? error.message : "Không thể gửi tin nhắn.";
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AccountSupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const isOpenRef = useRef(isOpen);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const typingActiveRef = useRef(false);
  isOpenRef.current = isOpen;
  conversationIdRef.current = conversation?.id ?? null;

  async function loadConversationMessages() {
    const { data } = await http.get<{
      conversation: SupportConversation;
      messages: SupportMessage[];
    }>("/support/account/conversation/messages");
    setConversation(data.conversation);
    setMessages(data.messages);
    setError("");
  }

  async function loadConversationSummary() {
    const { data } = await http.get<{ conversation: SupportConversation | null }>(
      "/support/account/conversation",
    );
    setConversation(data.conversation);
  }

  useEffect(() => {
    void loadConversationSummary().catch((loadError: unknown) =>
      setError(errorMessage(loadError)),
    );
    const socket = io({
      path: "/socket.io",
      auth: { role: "user" },
      withCredentials: true,
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      void loadConversationSummary()
        .then(() => {
          const conversationId = conversationIdRef.current;
          if (conversationId)
            socket.emit("support:join-account-conversation", conversationId, (result: { ok: boolean }) => {
              if (!result.ok)
                setError("Không thể tham gia hội thoại realtime. Hãy tải lại khung chat.");
            });
        })
        .catch((syncError: unknown) => setError(errorMessage(syncError)));
    });
    socket.on("connect_error", () => {
      setError("Kết nối realtime bị gián đoạn. Bạn vẫn có thể tải lại hội thoại.");
    });
    socket.on("disconnect", () => setAdminTyping(false));
    socket.on("support:conversation-linked", (update: { conversationId: string }) => {
      if (update.conversationId !== conversationIdRef.current) {
        void loadConversationSummary().catch((syncError: unknown) =>
          setError(errorMessage(syncError)),
        );
      }
    });
    socket.on("support:conversation-deleted", (update: { conversationId: string }) => {
      if (update.conversationId !== conversationIdRef.current) return;
      conversationIdRef.current = null;
      setConversation(null);
      setMessages([]);
      setDraft("");
      setAdminTyping(false);
      setIsOpen(false);
    });
    socket.on("support:message", (message: SupportMessage) => {
      if (message.conversationId !== conversationIdRef.current) return;
      setMessages((current) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      );
      if (isOpenRef.current)
        void loadConversationMessages().catch((syncError: unknown) =>
          setError(errorMessage(syncError)),
        );
    });
    socket.on(
      "support:message-status",
      (update: { messageId: string; senderRole: "visitor" | "admin"; status: SupportMessage["deliveryStatus"] }) => {
        if (update.senderRole !== "visitor") return;
        setMessages((current) =>
          current.map((message) =>
            message.id === update.messageId
              ? { ...message, deliveryStatus: update.status }
              : message,
          ),
        );
      },
    );
    socket.on(
      "support:conversation-updated",
      (update: Partial<SupportConversation> & { id: string }) => {
        if (update.id !== conversationIdRef.current) return;
        setConversation((current) => current ? { ...current, ...update } : current);
        if (update.unreadByVisitor && isOpenRef.current)
          void loadConversationMessages().catch((syncError: unknown) =>
            setError(errorMessage(syncError)),
          );
      },
    );
    socket.on("support:status", (update: { conversationId: string; status: "open" | "closed" }) => {
      if (update.conversationId === conversationIdRef.current)
        setConversation((current) => current ? { ...current, status: update.status } : current);
    });
    socket.on("support:typing", (update: { senderRole: "admin" | "visitor"; isTyping: boolean }) => {
      if (update.senderRole === "admin") setAdminTyping(update.isTyping);
    });
    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isOpen && conversation) {
      setLoading(true);
      void loadConversationMessages()
        .catch((loadError: unknown) => setError(errorMessage(loadError)))
        .finally(() => setLoading(false));
    }
  }, [isOpen, conversation?.id]);

  useEffect(() => {
    if (conversation?.id && socketRef.current?.connected)
      socketRef.current.emit(
        "support:join-account-conversation",
        conversation.id,
        (result: { ok: boolean }) => {
        if (!result.ok) {
          setError("Không thể tham gia hội thoại realtime. Hãy tải lại khung chat.");
          return;
        }
        if (typingActiveRef.current)
          socketRef.current?.emit("support:typing", { isTyping: true });
        },
      );
  }, [conversation?.id]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container && shouldAutoScrollRef.current)
      container.scrollTop = container.scrollHeight;
  }, [messages, isOpen]);

  function startTyping() {
    if (!conversation || conversation.status !== "open" || typingActiveRef.current) return;
    socketRef.current?.emit("support:typing", { isTyping: true });
    typingActiveRef.current = true;
  }

  function stopTyping() {
    if (typingActiveRef.current)
      socketRef.current?.emit("support:typing", { isTyping: false });
    typingActiveRef.current = false;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending || !conversation || conversation.status !== "open") return;
    const sensitiveContentWarning = sensitiveSupportContentWarning(content);
    if (sensitiveContentWarning) {
      setError(sensitiveContentWarning);
      return;
    }
    stopTyping();
    setSending(true);
    setError("");
    try {
      const { data } = await http.post<{ message: SupportMessage }>(
        "/support/account/conversation/messages",
        { content },
      );
      setMessages((current) =>
        current.some((item) => item.id === data.message.id)
          ? current
          : [...current, data.message],
      );
      setDraft("");
    } catch (sendError) {
      setError(errorMessage(sendError));
    } finally {
      setSending(false);
    }
  }

  if (!conversation) return null;

  return (
    <div className="support-widget">
      {isOpen && (
        <section className="support-window" aria-label="Trò chuyện với quản trị viên">
          <header className="support-header">
            <span className="support-header-icon"><Headset size={19} /></span>
            <div>
              <strong>Hỗ trợ khách hàng</strong>
              <small className={adminTyping ? "support-header-typing" : ""} aria-live="polite">
                {adminTyping ? "Quản trị viên đang soạn tin…" : "Hội thoại được lưu trong tài khoản"}
              </small>
            </div>
            <button type="button" className="support-close" aria-label="Đóng cửa sổ hỗ trợ" onClick={() => { stopTyping(); setIsOpen(false); }}>
              <X size={18} />
            </button>
          </header>
          {loading ? (
            <div className="support-loading">Đang tải cuộc trò chuyện…</div>
          ) : (
            <>
              <div
                className="support-messages"
                aria-live="polite"
                ref={messagesContainerRef}
                onScroll={(event) => {
                  const container = event.currentTarget;
                  shouldAutoScrollRef.current =
                    container.scrollHeight - container.scrollTop - container.clientHeight < 80;
                }}
              >
                {messages.map((message) => (
                  <div
                    className={`support-message ${message.senderRole === "visitor" ? "mine" : ""}`}
                    key={message.id}
                  >
                    <small>{message.senderRole === "visitor" ? "Bạn" : "Quản trị viên"} · {timeLabel(message.createdAt)}</small>
                    <p>{message.content}</p>
                    {message.senderRole === "visitor" && (
                      <span className="support-message-status">
                        {message.deliveryStatus === "read" ? <CheckCheck size={12} /> : <Check size={12} />}
                        {message.deliveryStatus === "read" ? "Đã xem" : message.deliveryStatus === "received" ? "Đã nhận" : "Đã gửi"}
                      </span>
                    )}
                  </div>
                ))}
                {adminTyping && <div className="support-typing">Quản trị viên đang soạn tin…</div>}
              </div>
              {error && <div className="support-error" role="alert">{error}</div>}
              {conversation.status === "open" ? (
                <form className="support-compose" onSubmit={submit}>
                  <label className="support-message-input">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      onFocus={startTyping}
                      onBlur={stopTyping}
                      placeholder="Nhập tin nhắn…"
                      aria-label="Tin nhắn"
                      maxLength={2000}
                      rows={2}
                      required
                    />
                    <button type="submit" disabled={!draft.trim() || sending} aria-label="Gửi tin nhắn">
                      <Send size={17} />
                    </button>
                  </label>
                  <small className="support-privacy">Lịch sử hội thoại chỉ hiển thị với tài khoản của bạn.</small>
                </form>
              ) : (
                <div className="support-closed"><span>Cuộc trò chuyện đã kết thúc.</span></div>
              )}
            </>
          )}
        </section>
      )}
      <button
        type="button"
        className={`support-launcher ${isOpen ? "is-open" : ""}`}
        onClick={() => {
          if (isOpen) stopTyping();
          setIsOpen((value) => !value);
        }}
        aria-label={isOpen ? "Đóng hỗ trợ" : "Mở hội thoại hỗ trợ"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={21} /> : (
          <>
            <MessageCircle size={20} />
            <span>Hỗ trợ</span>
            {!!conversation.unreadByVisitor && <i className="support-launcher-badge">{conversation.unreadByVisitor > 99 ? "99+" : conversation.unreadByVisitor}</i>}
          </>
        )}
      </button>
    </div>
  );
}
