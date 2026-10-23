import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, KeyRound, Mail } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { Button } from "../components/UI";

export function ForgotPasswordPage() {
  const { demo } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const showToast = useToast();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await post<{ message: string }>("/auth/forgot-password", { email });
      setSent(true);
      showToast(result.message, "success");
    } catch (error: any) {
      showToast(error?.response?.data?.error ?? "Không thể gửi yêu cầu. Vui lòng thử lại.", "error");
    } finally {
      setBusy(false);
    }
  }
  return <AuthUtilityPage icon={<Mail size={20} />} eyebrow="KHÔI PHỤC TÀI KHOẢN" title="Quên mật khẩu?" description={sent ? "Nếu email thuộc tài khoản có mật khẩu, hướng dẫn khôi phục sẽ được gửi đến hộp thư của bạn." : "Nhập email đăng ký. Chúng tôi sẽ gửi cho bạn liên kết đặt mật khẩu mới."}>
    {demo ? <div className="recovery-sent">Chế độ xem thử không có tài khoản máy chủ hoặc email khôi phục. Kết nối MongoDB để sử dụng chức năng này.</div> : !sent ? <form className="form-stack" onSubmit={submit}>
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} placeholder="ban@email.com" required /></label>
      <Button type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Gửi liên kết khôi phục"}<ArrowRight size={16} /></Button>
    </form> : <div className="recovery-sent"><Mail size={18} /> Hãy kiểm tra cả thư mục spam nếu chưa thấy email.</div>}
    <Link className="recovery-back" to="/login"><ArrowLeft size={15} /> Quay lại đăng nhập</Link>
  </AuthUtilityPage>;
}

export function ResetPasswordPage() {
  const { demo } = useAuth();
  const [search] = useSearchParams();
  const token = search.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const showToast = useToast();
  const navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      showToast("Mật khẩu xác nhận chưa khớp.", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await post<{ message: string }>("/auth/reset-password", { token, password });
      showToast(result.message, "success");
      navigate("/login", { replace: true });
    } catch (error: any) {
      showToast(error?.response?.data?.error ?? "Liên kết không hợp lệ hoặc đã hết hạn.", "error");
    } finally {
      setBusy(false);
    }
  }
  return <AuthUtilityPage icon={<KeyRound size={20} />} eyebrow="BẢO MẬT TÀI KHOẢN" title="Tạo mật khẩu mới" description="Mật khẩu mới cần có ít nhất 8 ký tự.">
    {demo ? <div className="recovery-sent">Chế độ xem thử không thể đặt lại mật khẩu tài khoản thật.</div> : token.length === 64 ? <form className="form-stack" onSubmit={submit}>
      <label>Mật khẩu mới<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      <label>Nhập lại mật khẩu<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      <Button type="submit" disabled={busy}>{busy ? "Đang cập nhật…" : "Đặt mật khẩu mới"}<ArrowRight size={16} /></Button>
    </form> : <div className="recovery-sent">Liên kết không hợp lệ. Hãy yêu cầu một liên kết khôi phục mới.</div>}
    <Link className="recovery-back" to="/forgot-password"><ArrowLeft size={15} /> Yêu cầu liên kết mới</Link>
  </AuthUtilityPage>;
}

function AuthUtilityPage({ icon, eyebrow, title, description, children }: { icon: ReactNode; eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <main className="recovery-page"><section className="recovery-card"><Link to="/login" className="brand auth-brand"><div className="brand-mark"><span /><i /></div><div className="brand-text">chi<span>tiêu</span><small>TÀI CHÍNH CỦA BẠN</small></div></Link><span className="recovery-icon">{icon}</span><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p>{children}</section></main>;
}
