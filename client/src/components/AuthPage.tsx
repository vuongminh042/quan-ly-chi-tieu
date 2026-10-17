import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "./Toast";
import { Button } from "./UI";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isAdmin?: boolean;
};
type AuthField = "name" | "email" | "password";
type FieldErrors = Partial<Record<AuthField, string>>;

const emailPattern =
  /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const namePattern = /^[\p{L}\p{M}]+(?:[ .'\u2019-][\p{L}\p{M}]+)*$/u;

function validate(
  mode: "login" | "register",
  data: Record<string, FormDataEntryValue>,
): FieldErrors {
  const errors: FieldErrors = {};
  const name = String(data.name ?? "").trim();
  const email = String(data.email ?? "").trim();
  const password = String(data.password ?? "");

  if (mode === "register") {
    if (!name) errors.name = "Vui lòng nhập Họ và Tên.";
    else if (name.length < 2 || name.length > 80)
      errors.name = "Họ và Tên cần từ 2 đến 80 ký tự.";
    else if (!namePattern.test(name))
      errors.name =
        "Họ và Tên chỉ gồm chữ cái, dấu cách, dấu chấm, dấu nháy hoặc dấu gạch nối.";
    if (errors.name) return errors;
  }
  if (!email) errors.email = "Vui lòng nhập Email.";
  else if (email.length > 254 || !emailPattern.test(email))
    errors.email = "Vui lòng nhập đúng định dạng Email.";
  if (errors.email) return errors;

  if (!password) {
    errors.password = "Vui lòng nhập Mật khẩu.";
  } else if (!password.trim()) {
    errors.password = "Mật khẩu không được chỉ chứa khoảng trắng.";
  } else if (password.length > 128) {
    errors.password = "Mật khẩu không được vượt quá 128 ký tự.";
  } else if (mode === "register" && password.length < 8) {
    errors.password = "Mật khẩu phải có ít nhất 8 ký tự.";
  }
  return errors;
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { setUser, demo } = useAuth();
  const showToast = useToast();
  const nav = useNavigate();
  const location = useLocation();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [resendingVerification, setResendingVerification] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const handledAuthNotice = useRef<string | null>(null);
  const suppressAutofill =
    (location.state as { registered?: boolean } | null)?.registered === true;

  function clearFieldError(field: AuthField) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  useEffect(() => {
    if (demo)
      showToast(
        "Đang xem thử với dữ liệu minh họa. Kết nối MongoDB để dùng tài khoản thật.",
        "info",
      );
  }, [demo, showToast]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const result = params.get("google");
    const verificationResult = params.get("verified");
    if (!result && !verificationResult) return;
    if (handledAuthNotice.current === location.search) return;
    handledAuthNotice.current = location.search;
    const messages: Record<string, string> = {
      not_configured: "Đăng nhập Google chưa được cấu hình trên máy chủ.",
      invalid_state: "Phiên đăng nhập Google không hợp lệ. Vui lòng thử lại.",
      cancelled: "Bạn đã hủy đăng nhập Google.",
      email_unverified: "Tài khoản Google cần có email đã xác minh.",
      account_deactivated:
        "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
      failed: "Không thể đăng nhập bằng Google. Vui lòng thử lại.",
    };
    const verificationMessages: Record<string, { message: string; type: "success" | "error" }> = {
      success: { message: "Email đã được xác minh. Bạn có thể đăng nhập.", type: "success" },
      invalid: { message: "Liên kết xác minh không hợp lệ hoặc đã hết hạn. Hãy yêu cầu gửi email mới.", type: "error" },
    };
    if (result) showToast(messages[result] ?? "Không thể đăng nhập bằng Google.", "error");
    else if (verificationResult) {
      const message = verificationMessages[verificationResult] ?? verificationMessages.invalid;
      showToast(message.message, message.type);
    }
    nav(location.pathname, { replace: true });
  }, [location.pathname, location.search, nav, showToast]);

  async function resendVerification() {
    const email = emailInput.current?.value.trim().toLowerCase() ?? "";
    if (!emailPattern.test(email)) {
      showToast("Nhập địa chỉ email hợp lệ để gửi lại email xác minh.", "error");
      emailInput.current?.focus();
      return;
    }
    setResendingVerification(true);
    try {
      const result = await post<{ message: string }>("/auth/resend-verification", { email });
      showToast(result.message, "success");
      setShowResendVerification(false);
    } catch (error) {
      showToast(
        axios.isAxiosError<{ error?: string }>(error)
          ? error.response?.data?.error ?? "Chưa gửi được email xác minh. Vui lòng thử lại."
          : "Chưa gửi được email xác minh. Vui lòng thử lại.",
        "error",
      );
    } finally {
      setResendingVerification(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const validationErrors = validate(mode, payload);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length) {
      const firstInvalidField = Object.keys(validationErrors)[0] as AuthField;
      (
        event.currentTarget.elements.namedItem(firstInvalidField) as
          | HTMLInputElement
          | null
      )?.focus();
      return;
    }

    setBusy(true);
    try {
      const result = await post<{
        user?: AuthUser;
        message?: string;
        sessionExpiresAt?: number;
      }>(`/auth/${mode}`, {
        ...payload,
        ...(typeof payload.email === "string"
          ? { email: payload.email.trim().toLowerCase() }
          : {}),
        ...(typeof payload.name === "string"
          ? { name: payload.name.trim() }
          : {}),
      });
      if (mode === "register") {
        showToast(
          demo
            ? "Đăng ký thành công. Vui lòng đăng nhập để tiếp tục."
            : result.message ?? "Đăng ký thành công. Hãy xác minh email để đăng nhập.",
          "success",
        );
        nav("/login", { replace: true, state: { registered: true } });
      } else {
        if (!result.user) throw new Error("Máy chủ không trả về thông tin tài khoản.");
        showToast("Đăng nhập thành công.", "success");
        setUser(result.user, result.sessionExpiresAt);
        nav("/", { replace: true });
      }
    } catch (requestError) {
      if (axios.isAxiosError<{ error?: string }>(requestError)) {
        if (requestError.response?.data && "code" in requestError.response.data &&
            requestError.response.data.code === "EMAIL_NOT_VERIFIED") {
          setShowResendVerification(true);
        }
        showToast(
          requestError.response?.data?.error ??
            "Không thể kết nối máy chủ. Vui lòng thử lại.",
          "error",
        );
      } else {
        showToast(
          requestError instanceof Error
            ? requestError.message
            : "Không thể xử lý yêu cầu.",
          "error",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-story">
        <div className="brand auth-brand">
          <div className="brand-mark">
            <span></span>
            <i></i>
          </div>
          <div className="brand-text">
            chi<span>tiêu</span>
            <small>TÀI CHÍNH CỦA BẠN</small>
          </div>
        </div>
        <div className="auth-story-copy">
          <span className="eyebrow">RÕ TỪNG ĐỒNG, NHẸ ĐẦU MỖI THÁNG</span>
          <h1>
            Hiểu dòng tiền.
            <br />
            <em>Chủ động</em> tương lai.
          </h1>
          <p>
            Một nơi bình tĩnh để nhìn lại tiền đang đi đâu — và dành chỗ cho
            điều bạn thật sự muốn.
          </p>
          <div className="story-proof">
            <span>
              <ShieldCheck size={17} /> Riêng tư theo từng tài khoản
            </span>
            <span>
              <ArrowRight size={17} /> Ghi chép trong vài giây
            </span>
          </div>
        </div>
        <div className="story-note">“Mỗi khoản nhỏ, một bức tranh rõ hơn.”</div>
      </section>
      <section className="auth-form-area">
        <div className="auth-form-wrap">
          <div className="eyebrow">
            {mode === "login" ? "CHÀO MỪNG TRỞ LẠI" : "BẮT ĐẦU TỪ HÔM NAY"}
          </div>
          <h2>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h2>
          <p>
            {mode === "login"
              ? "Nhập thông tin để tiếp tục theo dõi tài chính."
              : "Tài khoản của bạn sẽ có không gian dữ liệu riêng."}
          </p>
          <form
            onSubmit={submit}
            className="form-stack"
            noValidate
            autoComplete={suppressAutofill ? "off" : undefined}
          >
            {mode === "register" && (
              <label>
                Họ và Tên
                <input
                  name="name"
                  placeholder="Nguyễn Minh Anh"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                  onChange={() => clearFieldError("name")}
                />
                {fieldErrors.name && (
                  <small id="name-error" className="field-error">
                    {fieldErrors.name}
                  </small>
                )}
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                placeholder="ban@email.com"
                autoComplete={
                  mode === "register" || suppressAutofill ? "off" : "email"
                }
                ref={emailInput}
                maxLength={254}
                required
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                onChange={() => clearFieldError("email")}
              />
              {fieldErrors.email && (
                <small id="email-error" className="field-error">
                  {fieldErrors.email}
                </small>
              )}
            </label>
            <label>
              Mật khẩu
              <span className="password-wrap">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  minLength={mode === "register" ? 8 : 1}
                  maxLength={128}
                  autoComplete={
                    suppressAutofill
                      ? "new-password"
                      : mode === "login"
                        ? "current-password"
                        : "new-password"
                  }
                  placeholder={
                    mode === "register" ? "Từ 8 đến 128 ký tự" : "Nhập mật khẩu"
                  }
                  required
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={
                    fieldErrors.password ? "password-error" : undefined
                  }
                  onChange={() => clearFieldError("password")}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              {fieldErrors.password && (
                <small id="password-error" className="field-error">
                  {fieldErrors.password}
                </small>
              )}
            </label>
            <Button type="submit" disabled={busy}>
              {busy
                ? "Đang xử lý…"
                : mode === "login"
                  ? "Đăng nhập"
                  : "Tạo tài khoản"}
              <ArrowRight size={17} />
            </Button>
          </form>
          {mode === "login" && showResendVerification && (
            <button
              className="text-link"
              type="button"
              onClick={() => void resendVerification()}
              disabled={resendingVerification}
            >
              {resendingVerification ? "Đang gửi email…" : "Gửi lại email xác minh"}
            </button>
          )}
          {!demo && (
            <>
              <div className="auth-divider"><span>hoặc tiếp tục với</span></div>
              <button
                className="google-signin-button"
                type="button"
                onClick={() => window.location.assign("/api/auth/google")}
              >
                <svg
                  className="google-signin-mark"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M43.6 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11a9.4 9.4 0 0 1-4.2 6.2v5.5h7.1c4.2-3.9 6.7-9.5 6.7-15.7Z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 44c5.9 0 10.8-2 14.4-5.4l-7.1-5.5c-2 1.3-4.4 2.1-7.3 2.1-5.6 0-10.3-3.8-12-8.9H4.7v5.6A21.7 21.7 0 0 0 24 44Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M12 26.3a13 13 0 0 1 0-8.3v-5.6H4.7a21.7 21.7 0 0 0 0 19.5l7.3-5.6Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M24 9.1c3.2 0 6.1 1.1 8.3 3.3l6.2-6.2A20.8 20.8 0 0 0 24 0 21.7 21.7 0 0 0 4.7 12.4L12 18c1.7-5.1 6.4-8.9 12-8.9Z"
                  />
                </svg>
                Tiếp tục với Google
              </button>
            </>
          )}
          <div className="auth-switch">
            {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
            <Link to={mode === "login" ? "/register" : "/login"}>
              {mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
            </Link>
          </div>
          <small className="auth-legal">
            Dữ liệu tài chính được giới hạn theo tài khoản của bạn.
          </small>
        </div>
      </section>
    </div>
  );
}
