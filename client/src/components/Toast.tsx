import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; message: string; type: ToastType };
type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};
const ToastContext = createContext<ToastContextValue | null>(null);
let nextId = 0;

function inferType(message: string): ToastType {
  if (/^(Đã|Đăng nhập thành công|Đăng ký thành công)/i.test(message))
    return "success";
  if (/^(Không|Chưa|Hãy|Nhập|Vui lòng|Kết nối)/i.test(message)) return "error";
  return "info";
}

function ToastViewport({
  items,
  dismiss,
}: {
  items: ToastItem[];
  dismiss: (id: number) => void;
}) {
  return (
    <div
      className="toast-viewport"
      aria-label="Thông báo"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((item) => {
        const Icon =
          item.type === "success"
            ? CheckCircle2
            : item.type === "error"
              ? AlertCircle
              : Info;
        return (
          <div
            key={item.id}
            className={`toast-card toast-${item.type}`}
            role={item.type === "error" ? "alert" : "status"}
          >
            <span className="toast-icon">
              <Icon size={20} />
            </span>
            <span className="toast-message">{item.message}</span>
            <button
              className="toast-close"
              onClick={() => dismiss(item.id)}
              aria-label="Đóng thông báo"
            >
              <X size={16} />
            </button>
            <span className="toast-progress" />
          </div>
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);
  const showToast = useCallback(
    (message: string, type = inferType(message)) => {
      const id = ++nextId;
      setItems((current) => [...current.slice(-3), { id, message, type }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast phải nằm trong ToastProvider");
  return context.showToast;
}
