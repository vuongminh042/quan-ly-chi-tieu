import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  Car,
  Circle,
  Gift,
  HeartPulse,
  House,
  LoaderCircle,
  Plane,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Kind } from "../types";
import { currency } from "../lib/format";

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title-row">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-title-action">{action}</div>}
    </div>
  );
}
export function Panel({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        {title && <h2>{title}</h2>}
        {action}
      </div>
      {children}
    </section>
  );
}
export function StatCard({
  label,
  amount,
  tone,
  delta,
  icon,
}: {
  label: string;
  amount: number;
  tone: "green" | "coral" | "ink" | "amber";
  delta?: string;
  icon: ReactNode;
}) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{currency(amount)}</strong>
      {delta && <small>{delta}</small>}
    </div>
  );
}
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Loading() {
  return (
    <div className="loading-state">
      <LoaderCircle className="spin" size={24} />
      <span>Đang tải dữ liệu…</span>
    </div>
  );
}
export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="empty-state">
      <span className="empty-mark">
        <Circle size={18} />
      </span>
      <strong>{title}</strong>
      <p>{hint}</p>
    </div>
  );
}
const iconMap: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  "shopping-bag": ShoppingBag,
  house: House,
  "heart-pulse": HeartPulse,
  sparkles: Sparkles,
  receipt: Receipt,
  "book-open": BookOpen,
  circle: Circle,
  "briefcase-business": BriefcaseBusiness,
  gift: Gift,
  "chart-no-axes-combined": ArrowUpRight,
  plane: Plane,
  "shield-check": ShieldCheck,
  target: Target,
  bank: Banknote,
  wallet: Wallet,
  "arrow-up": ArrowUpRight,
  "arrow-down": ArrowDownRight,
};
export function CategoryIcon({
  name,
  size = 17,
}: {
  name?: string;
  size?: number;
}) {
  const Icon = iconMap[name ?? "circle"] ?? BadgeCheck;
  return <Icon size={size} strokeWidth={1.8} />;
}
export function TransactionAmount({
  amount,
  kind,
}: {
  amount: number;
  kind: Kind;
}) {
  return (
    <strong className={`amount ${kind}`}>
      {kind === "income" ? "+" : "−"}
      {currency(amount)}
    </strong>
  );
}
