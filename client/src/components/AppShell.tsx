import { createContext, useContext, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Target,
  Wallet,
  X,
  ChartNoAxesCombined,
  ShieldCheck,
  Moon,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { post } from "../lib/api";
import { TransactionDialog } from "./TransactionDialog";
import { useToast } from "./Toast";
import type { Transaction } from "../types";

export type AppOutlet = {
  refresh: number;
  notify: (message: string) => void;
  addTransaction: () => void;
  editTransaction: (transaction: Transaction) => void;
};
type UIValue = {
  refresh: number;
  addTransaction: () => void;
  notify: (message: string) => void;
};
const FinanceUI = createContext<UIValue | null>(null);
export const useFinanceUI = () => {
  const value = useContext(FinanceUI);
  if (!value) throw new Error("FinanceUI provider is missing");
  return value;
};
const links = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/transactions", label: "Giao dịch", icon: CreditCard },
  { to: "/budgets", label: "Ngân sách", icon: BarChart3 },
  { to: "/goals", label: "Mục tiêu", icon: Target },
  { to: "/accounts", label: "Tài khoản", icon: Wallet },
  { to: "/reports", label: "Báo cáo", icon: ChartNoAxesCombined },
  { to: "/admin", label: "Quản trị", icon: ShieldCheck, adminOnly: true },
];
const titles: Record<string, string> = {
  "/": "Tổng quan",
  "/transactions": "Giao dịch",
  "/budgets": "Ngân sách",
  "/goals": "Mục tiêu tiết kiệm",
  "/accounts": "Tài khoản của tôi",
  "/reports": "Báo cáo thu chi",
  "/settings": "Cài đặt",
  "/admin": "Quản trị tài khoản",
};
const THEME_KEY = "chitieu-theme";
export function AppShell() {
  const { user, demo, setUser } = useAuth();
  const showToast = useToast();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => document.documentElement.dataset.theme === "dark",
  );
  const loc = useLocation();
  const nav = useNavigate();
  const notify = (message: string) => showToast(message);
  const value = useMemo(
    () => ({
      refresh,
      addTransaction: () => {
        setEditing(null);
        setDialog(true);
      },
      notify,
    }),
    [refresh],
  );
  async function signOut() {
    try {
      await post("/auth/logout");
    } catch {
      notify(
        "Không thể đăng xuất. Vui lòng kiểm tra kết nối máy chủ rồi thử lại.",
      );
      return;
    }
    setUser(null);
    nav("/login");
  }
  const title = titles[loc.pathname] ?? "Chi Tiêu";
  function toggleTheme() {
    const nextDarkMode = !darkMode;
    setDarkMode(nextDarkMode);
    document.documentElement.dataset.theme = nextDarkMode ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", nextDarkMode ? "#101714" : "#f6f8f5");
    try {
      localStorage.setItem(THEME_KEY, nextDarkMode ? "dark" : "light");
    } catch {
      // The selected theme remains active for the current page.
    }
  }
  return (
    <FinanceUI.Provider value={value}>
      <div className="app-frame">
        <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
          <div className="brand">
            <div className="brand-mark">
              <span></span>
              <i></i>
            </div>
            <div className="brand-text">
              Quản<span> lý </span> chi <span> tiêu </span>
              <small>TÀI CHÍNH CỦA BẠN</small>
            </div>
            <button
              className="icon-button mobile-close"
              onClick={() => setMobileNav(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="workspace-label">KHÔNG GIAN CỦA BẠN</div>
          <nav className="side-nav">
            {links
              .filter((link) => !link.adminOnly || user?.isAdmin)
              .map(({ to, label, icon: Icon }) => (
                <NavLink
                  onClick={() => setMobileNav(false)}
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `side-link ${isActive ? "active" : ""}`
                  }
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                  {to === "/transactions" && <span className="nav-dot" />}
                </NavLink>
              ))}
          </nav>
          <div className="side-spacer" />
          <div className="sidebar-promo">
            <div className="promo-orb">
              <Sparkles size={16} />
            </div>
            <strong>
              Mỗi khoản nhỏ,
              <br />
              một bức tranh rõ hơn.
            </strong>
            <span>Quản lý tiền theo cách nhẹ nhàng.</span>
          </div>
          <NavLink
            onClick={() => setMobileNav(false)}
            to="/settings"
            className={({ isActive }) =>
              `side-link settings-link ${isActive ? "active" : ""}`
            }
          >
            <Settings size={18} />
            <span>Cài đặt</span>
          </NavLink>
          <button className="profile-chip" onClick={() => nav("/settings")}>
            <div className="avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt="" />
              ) : (
                (user?.name?.slice(0, 1).toUpperCase() ?? "L")
              )}
            </div>
            <span>
              <strong>{user?.name ?? "Tài khoản"}</strong>
              <small>{demo ? "Tài khoản xem thử" : "Tài khoản cá nhân"}</small>
            </span>
            <span className="profile-chevron">···</span>
          </button>
          <button className="signout" onClick={signOut}>
            <LogOut size={15} /> Đăng xuất
          </button>
        </aside>
        {mobileNav && (
          <button
            aria-label="Đóng menu"
            className="mobile-scrim"
            onClick={() => setMobileNav(false)}
          />
        )}
        <main className="main-column">
          <header className="topbar">
            <button
              className="icon-button menu-trigger"
              onClick={() => setMobileNav(true)}
              aria-label="Mở menu"
            >
              <Menu size={20} />
            </button>
            <div className="crumb">
              <span>TÀI CHÍNH CÁ NHÂN</span>
              <b>{title}</b>
            </div>
            <div className="top-actions">
              <button
                className="icon-button theme-toggle"
                onClick={toggleTheme}
                aria-label={darkMode ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
                title={darkMode ? "Chế độ sáng" : "Chế độ tối"}
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                className="icon-button help-button"
                aria-label="Trợ giúp"
                title="Tất cả số tiền dùng đơn vị VND"
              >
                <CircleHelp size={18} />
              </button>
              <button
                className="icon-button notify-button"
                aria-label="Thông báo"
              >
                <Bell size={18} />
                <i />
              </button>
              <button
                className="button button-primary top-add"
                onClick={() => {
                  setEditing(null);
                  setDialog(true);
                }}
              >
                <Plus size={17} />
                Thêm giao dịch
              </button>
              <button
                className="mobile-add"
                onClick={() => {
                  setEditing(null);
                  setDialog(true);
                }}
                aria-label="Thêm giao dịch"
              >
                <Plus size={20} />
              </button>
            </div>
          </header>
          <div className="content-area">
            <Outlet
              context={{
                refresh,
                notify,
                addTransaction: () => {
                  setEditing(null);
                  setDialog(true);
                },
                editTransaction: (t: Transaction) => {
                  setEditing(t);
                  setDialog(true);
                },
              }}
            />
          </div>
        </main>
        <nav className="mobile-nav">
          {links.slice(0, 5).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `mobile-nav-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} />
              <small>{label}</small>
            </NavLink>
          ))}
        </nav>
        <TransactionDialog
          open={dialog}
          initial={editing}
          onClose={() => {
            setDialog(false);
            setEditing(null);
          }}
          onSaved={() => {
            setRefresh((x) => x + 1);
            notify("Đã lưu giao dịch.");
          }}
        />
      </div>
    </FinanceUI.Provider>
  );
}
export function usePageUI() {
  // The outlet's context is accessed through a small custom hook in page files via useOutletContext.
  return useFinanceUI();
}
