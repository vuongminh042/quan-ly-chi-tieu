import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BarChart, Bar, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line } from 'recharts';
import { Download, FileSpreadsheet, TrendingDown, TrendingUp } from 'lucide-react';
import { get, http } from '../lib/api';
import { currency, money } from '../lib/format';
import type { Report } from '../types';
import { Button, EmptyState, PageTitle, Panel } from '../components/UI';
import type { AppOutlet } from '../components/AppShell';

const percentChange = (current: number, previous: number) => previous === 0 ? (current === 0 ? 0 : 100) : Math.round(((current - previous) / previous) * 100);
function ChangeNote({ current, previous }: { current: number; previous: number }) {
  const change = percentChange(current, previous);
  return <span className={`change-note ${change > 0 ? 'change-up' : change < 0 ? 'change-down' : ''}`}>{change > 0 ? '↑ ' : change < 0 ? '↓ ' : ''}{Math.abs(change)}% so với kỳ trước</span>;
}

export default function Reports() {
  const { refresh, notify } = useOutletContext<AppOutlet>();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(today);
  const [groupBy, setGroupBy] = useState<'day' | 'month' | 'year'>('month');
  const [report, setReport] = useState<Report | null>(null);
  const [previous, setPrevious] = useState<Report | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    if (!from || !to || from > to) {
      setReport(null); setPrevious(null); setBusy(false);
      return () => { active = false; };
    }
    setBusy(true);
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T23:59:59.999Z`);
    const span = Math.max(86_400_000, end.getTime() - start.getTime() + 1);
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(start.getTime() - span);
    const date = (value: Date) => value.toISOString().slice(0, 10);
    Promise.all([
      get<Report>('/reports/summary', { from, to, groupBy }),
      get<Report>('/reports/summary', { from: date(previousStart), to: date(previousEnd), groupBy }),
    ]).then(([current, prior]) => {
      if (active) { setReport(current); setPrevious(prior); }
    }).catch(() => notify('Không tải được báo cáo.')).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [from, to, groupBy, refresh]);

  async function exportFile(type: 'xlsx' | 'csv') {
    try {
      const response = await http.get(`/transactions/export.${type}`, { params: { from, to }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; link.download = `bao-cao-thu-chi_${from}_${to}.${type}`; link.click(); URL.revokeObjectURL(url);
      notify(`Đã tải báo cáo ${type.toUpperCase()}.`);
    } catch { notify('Hãy kết nối MongoDB để xuất báo cáo thu chi thật.'); }
  }

  const expenses = report?.categories.filter(category => category.kind === 'expense').slice(0, 8) ?? [];
  const incomes = report?.categories.filter(category => category.kind === 'income').slice(0, 5) ?? [];
  const months = Math.max(1, report?.monthly.length ?? 1);
  const accounts = report?.accounts ?? [];

  return <div className="page-stack">
    <PageTitle eyebrow="NHÌN RÕ XU HƯỚNG" title="Báo cáo thu chi." description="Dữ liệu được tổng hợp theo thời gian, danh mục và tài khoản."
      action={<div className="report-downloads"><Button variant="secondary" onClick={() => void exportFile('csv')}><Download size={15}/> CSV</Button><Button onClick={() => void exportFile('xlsx')}><FileSpreadsheet size={16}/> Xuất Excel</Button></div>}/>
    <Panel className="report-filter-panel"><div className="report-filters">
      <div><span>Từ ngày</span><input type="date" value={from} onChange={event => setFrom(event.target.value)}/></div>
      <div><span>Đến ngày</span><input type="date" value={to} onChange={event => setTo(event.target.value)}/></div>
      <div><span>Nhóm theo</span><select value={groupBy} onChange={event => setGroupBy(event.target.value as typeof groupBy)}><option value="day">Ngày</option><option value="month">Tháng</option><option value="year">Năm</option></select></div>
      <div className="report-preset"><button onClick={() => { setFrom(`${new Date().getFullYear()}-01-01`); setTo(today); }}>Năm nay</button><button onClick={() => { const date = new Date(); date.setMonth(date.getMonth() - 5, 1); setFrom(date.toISOString().slice(0, 10)); setTo(today); }}>6 tháng</button></div>
    </div></Panel>
    <div className="report-metric-grid">
      <div className="report-metric income-metric"><span><TrendingUp size={16}/> Tổng thu</span><strong>{currency(report?.totalIncome ?? 0)}</strong><small>{report?.transactionCount ?? 0} giao dịch trong kỳ · {previous && <ChangeNote current={report?.totalIncome ?? 0} previous={previous.totalIncome}/>}</small></div>
      <div className="report-metric expense-metric"><span><TrendingDown size={16}/> Tổng chi</span><strong>{currency(report?.totalExpense ?? 0)}</strong><small>Chênh lệch {currency(report?.net ?? 0)} · {previous && <ChangeNote current={report?.totalExpense ?? 0} previous={previous.totalExpense}/>}</small></div>
      <div className="report-metric neutral-metric"><span>Trung bình chi / tháng</span><strong>{currency((report?.totalExpense ?? 0) / months)}</strong><small>{report?.monthly.length ?? 0} tháng có giao dịch trong kỳ</small></div>
    </div>
    <div className="report-charts">
      <Panel title={`So sánh thu và chi theo ${groupBy === 'day' ? 'ngày' : groupBy === 'year' ? 'năm' : 'tháng'}`} className="report-main-chart">
        <div className="report-chart-area">{busy ? <div className="table-loading">Đang tổng hợp…</div> : report?.trend?.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={report.trend} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}><CartesianGrid stroke="#e8ece8" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#87928c' }}/><YAxis tickFormatter={value => `${money(value / 1_000_000)}tr`} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#87928c' }} width={42}/><Tooltip formatter={(value: unknown) => currency(Number(value))}/><Legend/><Line type="monotone" dataKey="income" name="Thu" stroke="#087f6a" strokeWidth={3} dot={false}/><Line type="monotone" dataKey="expense" name="Chi" stroke="#e78b72" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer> : <EmptyState title="Chưa có giao dịch trong kỳ" hint="Thử chọn khoảng thời gian khác."/>}</div>
      </Panel>
      <Panel title="Cơ cấu chi tiêu" className="report-donut-panel">{expenses.length ? <><div className="report-pie"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenses} dataKey="amount" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3}>{expenses.map((item, index) => <Cell key={index} fill={item.color}/>)}</Pie><Tooltip formatter={(value: unknown) => currency(Number(value))}/></PieChart></ResponsiveContainer></div><div className="report-category-list">{expenses.slice(0, 5).map(item => <div key={item.name}><span><i style={{ background: item.color }}/>{item.name}</span><strong>{currency(item.amount, true)}</strong></div>)}</div></> : <EmptyState title="Chưa có khoản chi" hint="Thêm giao dịch để xem cơ cấu chi tiêu."/>}</Panel>
    </div>
    <div className="report-lower-grid">
      <Panel title="Thu nhập theo danh mục"><div className="bar-chart-area">{incomes.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={incomes} layout="vertical" margin={{ left: 5, right: 12 }}><CartesianGrid stroke="#e8ece8" strokeDasharray="3 5" horizontal={false}/><XAxis type="number" tickFormatter={value => `${money(value / 1_000_000)}tr`} tickLine={false} axisLine={false} tick={{ fontSize: 10 }}/><YAxis type="category" dataKey="name" width={72} tickLine={false} axisLine={false} tick={{ fontSize: 11 }}/><Tooltip formatter={(value: unknown) => currency(Number(value))}/><Bar dataKey="amount" name="Tổng thu" fill="#087f6a" radius={[0, 6, 6, 0]} barSize={17}/></BarChart></ResponsiveContainer> : <EmptyState title="Chưa có khoản thu" hint="Chưa có dữ liệu trong kỳ."/>}</div></Panel>
      <Panel title="Dòng tiền theo tài khoản"><div className="account-chart-area">{accounts.length ? <ResponsiveContainer width="100%" height={Math.max(220, accounts.length * 48)}><BarChart data={accounts} layout="vertical" margin={{ top: 6, right: 16, bottom: 4, left: 4 }}><CartesianGrid stroke="#e8ece8" strokeDasharray="3 5" horizontal={false}/><XAxis type="number" tickFormatter={value => `${money(value / 1_000_000)}tr`} tickLine={false} axisLine={false} tick={{ fontSize: 10 }}/><YAxis type="category" dataKey="name" width={94} tickLine={false} axisLine={false} tick={{ fontSize: 10 }}/><Tooltip formatter={(value: unknown) => currency(Number(value))}/><Legend/><Bar dataKey="income" name="Thu" fill="#087f6a" radius={[0, 5, 5, 0]} barSize={12}/><Bar dataKey="expense" name="Chi" fill="#e78b72" radius={[0, 5, 5, 0]} barSize={12}/></BarChart></ResponsiveContainer> : <EmptyState title="Chưa có dòng tiền theo tài khoản" hint="Thêm giao dịch hoặc chọn khoảng thời gian khác."/>}</div></Panel>
    </div>
  </div>;
}
