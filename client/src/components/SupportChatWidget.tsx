import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  CheckCheck,
  Headset,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
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
type StoredConversation = { id: string; visitorToken: string };
const STORAGE_KEY = "chitieu-support-conversation";

function readStoredConversation(): StoredConversation | null {
  try {
    localStorage.removeItem(STORAGE_KEY);
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const stored = JSON.parse(value) as Partial<StoredConversation>;
    return typeof stored.id === "string" &&
      typeof stored.visitorToken === "string" &&
      stored.visitorToken.length >= 40
      ? { id: stored.id, visitorToken: stored.visitorToken }
      : null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: string }>(error))
    return (
      error.response?.data?.error ??
      "Không thể kết nối hỗ trợ. Vui lòng thử lại."
    );
  return error instanceof Error ? error.message : "Không thể gửi tin nhắn.";
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [stored, setStored] = useState<StoredConversation | null>(
    readStoredConversation,
  );
  const [conversation, setConversation] = useState<SupportConversation | null>(
    null,
  );
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isOpenRef = useRef(isOpen);
  const typingActiveRef = useRef(false);
  const linkedCheckRef = useRef(false);
  isOpenRef.current = isOpen;

  const addMessage = useCallback((message: SupportMessage) => {
    setMessages((current) =>
      current.some((item) => item.id === message.id)
        ? current
        : [...current, message],
    );
  }, []);

  const clearTransferredConversation = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      setError("");
    } catch {
      setError(
        "Không thể xóa phiên chat khỏi tab hiện tại. Hãy đóng tab này sau khi chuyển hội thoại.",
      );
    }
    setStored(null);
    setConversation(null);
    setMessages([]);
    setName("");
    setEmail("");
    setDraft("");
    setAdminTyping(false);
  }, []);

  const reloadConversation = useCallback(
    async (current: StoredConversation) => {
      const { data } = await http.get<{
        conversation: SupportConversation;
        messages: SupportMessage[];
      }>(`/support/conversations/${current.id}/messages`, {
        headers: { "x-support-token": current.visitorToken },
      });
      setConversation(data.conversation);
      setMessages(data.messages);
      setError("");
    },
    [],
  );

  const reloadSummary = useCallback(async (current: StoredConversation) => {
    const { data } = await http.get<{ conversation: SupportConversation }>(
      `/support/conversations/${current.id}`,
      { headers: { "x-support-token": current.visitorToken } },
    );
    setConversation(data.conversation);
  }, []);

  useEffect(() => {
    if (!stored) return;
    let active = true;
    void reloadSummary(stored).catch((loadError: unknown) => {
      if (!active) return;
      setError(errorMessage(loadError));
      if (
        axios.isAxiosError<{ code?: string }>(loadError) &&
        loadError.response?.data?.code === "SUPPORT_CONVERSATION_LINKED"
      ) {
        clearTransferredConversation();
        return;
      }
      if (axios.isAxiosError(loadError) && loadError.response?.status === 404) {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          setError(
            "Cuộc trò chuyện không còn khả dụng. Hãy bắt đầu cuộc trò chuyện mới.",
          );
        }
        setStored(null);
        setConversation(null);
        setMessages([]);
      }
    });
    return () => {
      active = false;
    };
  }, [clearTransferredConversation, reloadSummary, stored]);

  useEffect(() => {
    if (!isOpen || !stored) return;
    let active = true;
    setLoading(true);
    void reloadConversation(stored)
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(errorMessage(loadError));
        if (
          axios.isAxiosError<{ code?: string }>(loadError) &&
          loadError.response?.data?.code === "SUPPORT_CONVERSATION_LINKED"
        ) {
          clearTransferredConversation();
          return;
        }
        if (
          axios.isAxiosError(loadError) &&
          loadError.response?.status === 404
        ) {
          try {
            sessionStorage.removeItem(STORAGE_KEY);
          } catch {
            setError(
              "Cuộc trò chuyện không còn khả dụng. Hãy bắt đầu cuộc trò chuyện mới.",
            );
          }
          setStored(null);
          setConversation(null);
          setMessages([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clearTransferredConversation, isOpen, reloadConversation, stored]);

  useEffect(() => {
    if (!stored || !conversation) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }
    const socket = io({
      path: "/socket.io",
      auth: {
        conversationId: stored.id,
        visitorToken: stored.visitorToken,
      },
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      linkedCheckRef.current = false;
      setConnected(true);
      if (typingActiveRef.current)
        socket.emit("support:typing", { isTyping: true });
      const reload = isOpenRef.current ? reloadConversation : reloadSummary;
      void reload(stored).catch((syncError: unknown) =>
        setError(errorMessage(syncError)),
      );
    });
    socket.on("disconnect", () => {
      setConnected(false);
      setAdminTyping(false);
    });
    socket.on("connect_error", () => {
      setConnected(false);
      setAdminTyping(false);
      if (linkedCheckRef.current) return;
      linkedCheckRef.current = true;
      void reloadSummary(stored).catch((syncError: unknown) => {
        if (
          axios.isAxiosError<{ code?: string }>(syncError) &&
          syncError.response?.data?.code === "SUPPORT_CONVERSATION_LINKED"
        ) {
          clearTransferredConversation();
          return;
        }
        setError(errorMessage(syncError));
      });
    });
    socket.on("support:message", (message: SupportMessage) => {
      addMessage(message);
    });
    socket.on("support:linked", (update: { conversationId: string }) => {
      if (update.conversationId === stored.id) clearTransferredConversation();
    });
    socket.on(
      "support:conversation-deleted",
      (update: { conversationId: string }) => {
        if (update.conversationId === stored.id) clearTransferredConversation();
      },
    );
    socket.on(
      "support:message-status",
      (update: {
        messageId: string;
        senderRole: "visitor" | "admin";
        status: SupportMessage["deliveryStatus"];
      }) => {
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
        if (update.id !== stored.id) return;
        if (update.unreadByVisitor && isOpenRef.current) {
          void reloadConversation(stored).catch((syncError: unknown) =>
            setError(errorMessage(syncError)),
          );
          return;
        }
        setConversation((current) =>
          current ? { ...current, ...update } : current,
        );
      },
    );
    socket.on("support:status", (value: { status: "open" | "closed" }) => {
      setConversation((current) =>
        current ? { ...current, status: value.status } : current,
      );
    });
    socket.on(
      "support:typing",
      (value: { senderRole: "admin" | "visitor"; isTyping: boolean }) => {
        if (value.senderRole !== "admin") return;
        setAdminTyping(value.isTyping);
      },
    );
    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [
    addMessage,
    clearTransferredConversation,
    conversation?.id,
    reloadConversation,
    reloadSummary,
    stored,
  ]);

  const stopTyping = useCallback(() => {
    if (typingActiveRef.current)
      socketRef.current?.emit("support:typing", { isTyping: false });
    typingActiveRef.current = false;
  }, []);

  const startTyping = useCallback(() => {
    if (!stored || conversation?.status !== "open" || typingActiveRef.current)
      return;
    socketRef.current?.emit("support:typing", { isTyping: true });
    typingActiveRef.current = true;
  }, [conversation?.status, stored]);

  function updateDraft(value: string) {
    setDraft(value);
  }

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container && shouldAutoScrollRef.current)
      container.scrollTop = container.scrollHeight;
  }, [messages, isOpen]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (adminTyping && container) {
      shouldAutoScrollRef.current = true;
      container.scrollTop = container.scrollHeight;
    }
  }, [adminTyping]);

  useEffect(() => {
    if (!isOpen || conversation?.status !== "open") stopTyping();
  }, [conversation?.status, isOpen, stopTyping]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    const sensitiveContentWarning = sensitiveSupportContentWarning(content);
    if (sensitiveContentWarning) {
      setError(sensitiveContentWarning);
      return;
    }
    stopTyping();
    setSending(true);
    setError("");
    try {
      if (!stored || !conversation) {
        const { data } = await http.post<{
          conversation: SupportConversation;
          visitorToken: string;
          messages: SupportMessage[];
        }>("/support/conversations", { name, email, message: content });
        const nextStored = {
          id: data.conversation.id,
          visitorToken: data.visitorToken,
        };
        let persisted = true;
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextStored));
        } catch {
          persisted = false;
        }
        setStored(nextStored);
        setConversation(data.conversation);
        setMessages(data.messages);
        if (!persisted)
          setError(
            "Tin nhắn đã được gửi, nhưng trình duyệt không thể lưu phiên chat. Hãy giữ trang này mở để tiếp tục.",
          );
      } else {
        const { data } = await http.post<{ message: SupportMessage }>(
          `/support/conversations/${stored.id}/messages`,
          { content },
          { headers: { "x-support-token": stored.visitorToken } },
        );
        addMessage(data.message);
      }
      setDraft("");
    } catch (sendError) {
      setError(errorMessage(sendError));
    } finally {
      setSending(false);
    }
  }

  function startNewConversation() {
    stopTyping();
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      setError("Không thể xóa phiên chat đã lưu trong trình duyệt.");
    }
    setStored(null);
    setConversation(null);
    setMessages([]);
    setError("");
    setDraft("");
  }

  return (
    <div className="support-widget">
      {isOpen && (
        <section
          className="support-window"
          aria-label="Trò chuyện với quản trị viên"
        >
          <header className="support-header">
            <span className="support-header-icon">
              <Headset size={19} />
            </span>
            <div>
              <strong>Hỗ trợ khách hàng</strong>
              <small
                className={adminTyping ? "support-header-typing" : ""}
                aria-live="polite"
              >
                {adminTyping
                  ? "Quản trị viên đang soạn tin…"
                  : connected
                    ? "Đang kết nối trực tuyến"
                    : "Quản trị viên sẽ phản hồi sớm"}
              </small>
            </div>
            <button
              type="button"
              className="support-close"
              aria-label="Đóng cửa sổ hỗ trợ"
              onClick={() => {
                stopTyping();
                setIsOpen(false);
              }}
            >
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
                    container.scrollHeight -
                      container.scrollTop -
                      container.clientHeight <
                    80;
                }}
              >
                {!conversation && (
                  <div className="support-intro">
                    Xin chào! Để đội ngũ quản trị có thể phản hồi, bạn vui lòng
                    cho biết tên, email và nội dung cần hỗ trợ.
                  </div>
                )}
                {messages.map((message) => (
                  <div
                    className={`support-message ${message.senderRole === "visitor" ? "mine" : ""}`}
                    key={message.id}
                  >
                    <small>
                      {message.senderRole === "visitor"
                        ? "Bạn"
                        : "Quản trị viên"}{" "}
                      · {timeLabel(message.createdAt)}
                    </small>
                    <p>{message.content}</p>
                    {message.senderRole === "visitor" && (
                      <span className="support-message-status">
                        {message.deliveryStatus === "read" ? (
                          <CheckCheck size={12} />
                        ) : (
                          <Check size={12} />
                        )}
                        {message.deliveryStatus === "read"
                          ? "Đã xem"
                          : message.deliveryStatus === "received"
                            ? "Đã nhận"
                            : "Đã gửi"}
                      </span>
                    )}
                  </div>
                ))}
                {adminTyping && (
                  <div className="support-typing">
                    Quản trị viên đang soạn tin…
                  </div>
                )}
              </div>
              {error && (
                <div className="support-error" role="alert">
                  {error}
                </div>
              )}
              {conversation?.status === "closed" ? (
                <div className="support-closed">
                  <span>Cuộc trò chuyện đã kết thúc.</span>
                  <button type="button" onClick={startNewConversation}>
                    Bắt đầu cuộc trò chuyện mới
                  </button>
                </div>
              ) : (
                <form className="support-compose" onSubmit={submit}>
                  {!conversation && (
                    <div className="support-identity">
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Tên của bạn"
                        aria-label="Tên của bạn"
                        minLength={2}
                        maxLength={80}
                        required
                      />
                      <input
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Email liên hệ"
                        aria-label="Email liên hệ"
                        type="email"
                        maxLength={254}
                        required
                      />
                    </div>
                  )}
                  <label className="support-message-input">
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
                      placeholder="Nhập tin nhắn…"
                      aria-label="Tin nhắn"
                      maxLength={2000}
                      rows={2}
                      required
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || sending}
                      aria-label="Gửi tin nhắn"
                    >
                      <Send size={17} />
                    </button>
                  </label>
                </form>
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
        aria-label={isOpen ? "Đóng hỗ trợ" : "Liên hệ quản trị viên"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X size={21} />
        ) : (
          <>
            <MessageCircle size={20} />
            <span>Liên hệ hỗ trợ</span>
            {!!conversation?.unreadByVisitor && (
              <i className="support-launcher-badge">
                {conversation.unreadByVisitor > 99
                  ? "99+"
                  : conversation.unreadByVisitor}
              </i>
            )}
          </>
        )}
      </button>
    </div>
  );
}
