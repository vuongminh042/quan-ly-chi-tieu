import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { get } from "../lib/api";
import { currency, dateShort, monthKey, money } from "../lib/format";
import type {
  Account,
  PageResult,
  Report,
  Transaction,
} from "../types";
import {
  Button,
  CategoryIcon,
  EmptyState,
  PageTitle,
  Panel,
  StatCard,
  TransactionAmount,
} from "../components/UI";
import type { AppOutlet } from "../components/AppShell";
import { useAuth } from "../lib/auth";

export default function Dashboard() {
  const { refresh, editTransaction, notify } = useOutletContext<AppOutlet>();
  const { user } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [busy, setBusy] = useState(true);
  const nav = useNavigate();
  useEffect(() => {
    let active = true;
    setBusy(true);
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      .toISOString()
      .slice(0, 10);
    Promise.all([
      get<Report>("/reports/summary", {
        from,
        to: now.toISOString().slice(0, 10),
      }),
      get<{ items: Account[] }>("/accounts"),
      get<PageResult<Transaction>>("/transactions", {
        from: new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .slice(0, 10),
        to: now.toISOString().slice(0, 10),
        page: 1,
        limit: 5,
      }),
    ])
      .then(([r, a, t]) => {
        if (active) {
          setReport(r);
          setAccounts(a.items);
          setRecent(t.items);
        }
      })
      .catch(() => notify("Chưa tải được dữ liệu tổng quan."))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [refresh]);
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const expenseCategories =
    report?.categories.filter((x) => x.kind === "expense").slice(0, 5) ?? [];
  const todayLabel = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
    .format(new Date())
    .toLocaleUpperCase("vi-VN");
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow={todayLabel}
        title={`Xin chào ${user?.name?.trim() || "bạn"}`}
        description=""
        action={
          <Button variant="secondary" onClick={() => nav("/reports")}>
            <CalendarDays size={16} /> Tháng này
          </Button>
        }
      />
      <div className="stats-grid">
        <StatCard
          label="Tổng số dư"
          amount={totalBalance}
          tone="green"
          icon={<Wallet size={18} />}
        />
        <StatCard
          label="Tổng thu · 6 tháng"
          amount={report?.totalIncome ?? 0}
          tone="ink"
          icon={<TrendingUp size={18} />}
          delta="Tổng thu trong kỳ"
        />
        <StatCard
          label="Tổng chi · 6 tháng"
          amount={report?.totalExpense ?? 0}
          tone="coral"
          icon={<TrendingDown size={18} />}
          delta="Tổng chi trong kỳ"
        />
      </div>
      <div className="dashboard-main-grid">
        <Panel
          title="Dòng tiền của bạn"
          className="trend-panel"
          action={
            <span className="panel-period">
              6 tháng gần đây <ArrowRight size={14} />
            </span>
          }
        >
          <div className="chart-legend">
            <span>
              <i className="legend-dot income-dot" />
              Thu vào
            </span>
            <span>
              <i className="legend-dot expense-dot" />
              Chi ra
            </span>
          </div>
          <div className="line-chart-wrap">
            {report?.monthly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={report.monthly}
                  margin={{ top: 8, right: 8, bottom: 0, left: 2 }}
                >
                  <CartesianGrid
                    stroke="#e8ece8"
                    strokeDasharray="3 5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#8b9690" }}
                    dy={9}
                  />
                  <YAxis
                    tickFormatter={(v) => money(v / 1000000) + "tr"}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "#8b9690" }}
                    width={39}
                  />
                  <Tooltip
                    formatter={(v: any) => currency(Number(v))}
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid #e7ebe7",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Thu vào"
                    stroke="#087f6a"
                    strokeWidth={3}
                    dot={{
                      r: 3,
                      fill: "#087f6a",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    name="Chi ra"
                    stroke="#e78b72"
                    strokeWidth={2.5}
                    dot={{
                      r: 3,
                      fill: "#e78b72",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="Chưa có dữ liệu biểu đồ"
                hint="Thêm giao dịch để xem dòng tiền theo tháng."
              />
            )}
          </div>
          <div className="chart-foot">
            <span>
              <span className="chart-foot-mark">↑</span> Thu chi được cập nhật
              theo giao dịch
            </span>
            <button className="text-link" onClick={() => nav("/reports")}>
              Xem báo cáo <ArrowRight size={14} />
            </button>
          </div>
        </Panel>
        <Panel
          title="Chi tiêu theo nhóm"
          className="category-panel"
          action={
            <button className="text-link" onClick={() => nav("/reports")}>
              Chi tiết <ArrowRight size={14} />
            </button>
          }
        >
          {expenseCategories.length ? (
            <>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategories}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={89}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {expenseCategories.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => currency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <span>CHI TIÊU</span>
                  <strong>{currency(report?.totalExpense ?? 0, true)}</strong>
                  <small>6 tháng</small>
                </div>
              </div>
              <div className="category-legend">
                {expenseCategories.slice(0, 4).map((item) => (
                  <div key={item.name}>
                    <span className="legend-name">
                      <i style={{ background: item.color }} />
                      {item.name}
                    </span>
                    <strong>{currency(item.amount, true)}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="Chưa có khoản chi"
              hint="Biểu đồ sẽ xuất hiện khi bạn ghi chép."
            />
          )}
        </Panel>
      </div>
      <div className="dashboard-bottom-grid">
        <Panel
          title="Giao dịch gần đây"
          className="recent-panel"
          action={
            <button className="text-link" onClick={() => nav("/transactions")}>
              Tất cả giao dịch <ArrowRight size={14} />
            </button>
          }
        >
          {recent.length ? (
            <div className="transaction-list">
              {recent.map((t) => (
                <button
                  className="transaction-row"
                  key={t._id}
                  onClick={() => editTransaction(t)}
                >
                  <span className={`transaction-icon ${t.kind}`}>
                    <CategoryIcon
                      name={
                        typeof t.categoryId === "string"
                          ? "circle"
                          : t.categoryId.icon
                      }
                    />
                  </span>
                  <span className="transaction-description">
                    <strong>
                      {typeof t.categoryId === "string"
                        ? "Giao dịch"
                        : t.categoryId.name}
                    </strong>
                    <small>
                      {t.note || "Không có ghi chú"} · {dateShort(t.date)}
                    </small>
                  </span>
                  <TransactionAmount amount={t.amount} kind={t.kind} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có giao dịch"
              hint="Ghi lại khoản thu hoặc chi đầu tiên của bạn."
            />
          )}
        </Panel>
      </div>
      {busy && <div className="subtle-loading">Đang đồng bộ số liệu…</div>}
    </div>
  );
}
