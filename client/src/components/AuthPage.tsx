import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
    if (name.length < 2 || name.length > 80)
      errors.name = "Tên hiển thị cần từ 2 đến 80 ký tự.";
    else if (!namePattern.test(name))
      errors.name =
        "Tên chỉ gồm chữ cái, dấu cách, dấu chấm, dấu nháy hoặc dấu gạch nối.";
  }
  if (!email || email.length > 254 || !emailPattern.test(email))
    errors.email = "Vui lòng nhập địa chỉ email hợp lệ (tối đa 254 ký tự).";
  if (mode === "register" && (password.length < 8 || password.length > 128)) {
    errors.password = "Mật khẩu cần từ 8 đến 128 ký tự.";
  } else if (mode === "login" && (!password || password.length > 128)) {
    errors.password = "Vui lòng nhập mật khẩu (tối đa 128 ký tự).";
  } else if (!password.trim()) {
    errors.password = "Mật khẩu không được chỉ chứa khoảng trắng.";
  }
  return errors;
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { setUser, demo } = useAuth();
  const showToast = useToast();
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (demo)
      showToast(
        "Đang xem thử với dữ liệu minh họa. Kết nối MongoDB để dùng tài khoản thật.",
        "info",
      );
  }, [demo, showToast]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const validationErrors = validate(mode, payload);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length) {
      showToast("Vui lòng kiểm tra lại thông tin đã nhập.", "error");
      return;
    }

    setBusy(true);
    try {
      const result = await post<{ user: AuthUser }>(`/auth/${mode}`, {
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
          "Đăng ký thành công. Vui lòng đăng nhập để tiếp tục.",
          "success",
        );
        nav("/login", { replace: true });
      } else {
        showToast("Đăng nhập thành công.", "success");
        setUser(result.user);
        nav("/", { replace: true });
      }
    } catch (requestError) {
      if (axios.isAxiosError<{ error?: string }>(requestError)) {
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
          <form onSubmit={submit} className="form-stack" noValidate>
            {mode === "register" && (
              <label>
                Tên hiển thị
                <input
                  name="name"
                  placeholder="Nguyễn Minh Anh"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
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
                autoComplete="email"
                maxLength={254}
                required
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
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
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder={
                    mode === "register" ? "Từ 8 đến 128 ký tự" : "Nhập mật khẩu"
                  }
                  required
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={
                    fieldErrors.password ? "password-error" : undefined
                  }
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
