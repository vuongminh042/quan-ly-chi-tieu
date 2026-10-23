import { ArrowRight, Compass, Home, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import "./not-found.css";

export default function NotFound() {
  const { user } = useAuth();
  const home = user ? "/" : "/login";

  return (
    <main className="not-found-page">
      <div className="not-found-glow not-found-glow-one" aria-hidden="true" />
      <div className="not-found-glow not-found-glow-two" aria-hidden="true" />

      <Link
        to={home}
        className="not-found-brand"
        aria-label="Chi Tiêu – về trang chủ"
      >
        <span className="not-found-brand-mark">
          <span />
          <i />
        </span>
        <span>
          chi<span>tiêu</span>
          <small>QUẢN LÝ TÀI CHÍNH</small>
        </span>
      </Link>

      <section className="not-found-content" aria-labelledby="not-found-title">
        <div className="not-found-art" aria-hidden="true">
          <div className="not-found-orbit not-found-orbit-outer" />
          <div className="not-found-orbit not-found-orbit-inner" />
          <span className="not-found-star star-one">
            <Sparkles size={17} />
          </span>
          <span className="not-found-star star-two">✦</span>
          <span className="not-found-404">404</span>
          <span className="not-found-planet">
            <Compass size={28} strokeWidth={1.5} />
          </span>
        </div>

        <h1 id="not-found-title">
          Ôi rất tiếc! 🥲
          <br />
          <span>Không tìm thấy trang</span>
        </h1>

        <p className="not-found-copy">
          Đường dẫn này có thể đã thay đổi hoặc không còn tồn tại.
          Hãy quay về trang chính để tiếp tục nhé.
        </p>

        <div className="not-found-actions">
          <Link to={home} className="not-found-home">
            <Home size={16} /> Về trang chủ <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <div className="not-found-bottom" aria-hidden="true">
        <span>CHI TIÊU</span>
        <i /> <span>CHI TIÊU THÔNG MINH, SỐNG AN TÂM</span>
      </div>
    </main>
  );
}
