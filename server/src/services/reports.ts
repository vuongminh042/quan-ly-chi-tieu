import ExcelJS from 'exceljs';
import { Transaction } from '../models/finance.js';
import { transactionFilter } from './transactions.js';

type ReportRow = {
  _id: unknown;
  kind: 'income' | 'expense';
  amount: number;
  date: Date;
  note?: string;
  paymentMethod: string;
  categoryId?: { _id?: unknown; name?: string; color?: string } | null;
  accountId?: { _id?: unknown; name?: string; kind?: string } | null;
};

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${month}/${year}`;
}

export async function buildReport(userId: string, query: Record<string, unknown>) {
  const filter = await transactionFilter(userId, query);
  const items = await Transaction.find(filter)
    .populate('categoryId', 'name color').populate('accountId', 'name kind').sort({ date: 1, _id: 1 }).lean() as unknown as ReportRow[];
  let totalIncome = 0;
  let totalExpense = 0;
  const categories = new Map<string, { name: string; kind: string; amount: number; color: string }>();
  const accounts = new Map<string, { name: string; income: number; expense: number }>();
  const months = new Map<string, { month: string; income: number; expense: number }>();
  const granularity = query.groupBy === 'day' || query.groupBy === 'year' ? query.groupBy : 'month';
  const periods = new Map<string, { period: string; label: string; income: number; expense: number }>();
  const transactions = items.map(row => {
    const amount = Number(row.amount) || 0;
    const categoryName = row.categoryId?.name ?? 'Chưa phân loại';
    const categoryId = String(row.categoryId?._id ?? 'unknown');
    const category = categories.get(categoryId) ?? { name: categoryName, kind: row.kind, amount: 0, color: row.categoryId?.color ?? '#92999A' };
    category.amount += amount;
    categories.set(categoryId, category);
    const accountName = row.accountId?.name ?? 'Tài khoản';
    const accountId = String(row.accountId?._id ?? 'unknown');
    const account = accounts.get(accountId) ?? { name: accountName, income: 0, expense: 0 };
    account[row.kind] += amount;
    accounts.set(accountId, account);
    const month = monthKey(new Date(row.date));
    const bucket = months.get(month) ?? { month, income: 0, expense: 0 };
    bucket[row.kind] += amount;
    months.set(month, bucket);
    const date = new Date(row.date);
    const period = granularity === 'day' ? date.toISOString().slice(0, 10) : granularity === 'year' ? String(date.getUTCFullYear()) : month;
    const label = granularity === 'day' ? date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : granularity === 'year' ? period : monthLabel(month);
    const periodBucket = periods.get(period) ?? { period, label, income: 0, expense: 0 };
    periodBucket[row.kind] += amount;
    periods.set(period, periodBucket);
    if (row.kind === 'income') totalIncome += amount;
    else totalExpense += amount;
    return { date: new Date(row.date), kind: row.kind, amount, categoryName, accountName, note: row.note ?? '', paymentMethod: row.paymentMethod };
  });
  return {
    totalIncome, totalExpense, net: totalIncome - totalExpense, transactionCount: transactions.length,
    categories: [...categories.values()].sort((a, b) => b.amount - a.amount),
    accounts: [...accounts.values()],
    monthly: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map(item => ({ ...item, label: monthLabel(item.month) })),
    trend: [...periods.values()].sort((a, b) => a.period.localeCompare(b.period)),
    transactions,
  };
}

export async function exportWorkbook(userId: string, query: Record<string, unknown>): Promise<ExcelJS.Workbook> {
  const data = await buildReport(userId, query);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Chi Tiêu';
  workbook.created = new Date();
  workbook.subject = 'Báo cáo thu chi cá nhân';

  const summary = workbook.addWorksheet('Tổng quan');
  summary.columns = [{ width: 30 }, { width: 24 }];
  summary.addRow(['BÁO CÁO THU CHI']);
  summary.addRow(['Ngày xuất', new Date().toLocaleDateString('vi-VN')]);
  summary.addRow(['Số giao dịch', data.transactionCount]);
  summary.addRow(['Tổng thu (VND)', data.totalIncome]);
  summary.addRow(['Tổng chi (VND)', data.totalExpense]);
  summary.addRow(['Chênh lệch (VND)', data.net]);
  summary.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF087F6A' } };
  summary.getColumn(2).numFmt = '#,##0;[Red]-#,##0';
  summary.views = [{ state: 'frozen', ySplit: 1 }];

  const rows = workbook.addWorksheet('Giao dịch');
  rows.columns = [
    { header: 'Ngày', key: 'date', width: 16 }, { header: 'Loại', key: 'kind', width: 12 },
    { header: 'Danh mục', key: 'category', width: 22 }, { header: 'Tài khoản', key: 'account', width: 22 },
    { header: 'Ghi chú', key: 'note', width: 36 }, { header: 'Hình thức', key: 'method', width: 20 },
    { header: 'Số tiền (VND)', key: 'amount', width: 20 },
  ];
  for (const row of data.transactions) rows.addRow({ date: row.date, kind: row.kind === 'income' ? 'Thu' : 'Chi', category: row.categoryName, account: row.accountName, note: row.note, method: row.paymentMethod, amount: row.amount });
  rows.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rows.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087F6A' } };
  rows.getColumn(1).numFmt = 'dd/mm/yyyy';
  rows.getColumn(7).numFmt = '#,##0;[Red]-#,##0';
  rows.autoFilter = { from: 'A1', to: 'G1' };
  rows.views = [{ state: 'frozen', ySplit: 1 }];

  const categorySheet = workbook.addWorksheet('Theo danh mục');
  categorySheet.columns = [{ header: 'Danh mục', key: 'name', width: 28 }, { header: 'Loại', key: 'kind', width: 16 }, { header: 'Tổng tiền (VND)', key: 'amount', width: 24 }];
  for (const row of data.categories) categorySheet.addRow({ name: row.name, kind: row.kind === 'income' ? 'Thu' : 'Chi', amount: row.amount });
  categorySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  categorySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087F6A' } };
  categorySheet.getColumn(3).numFmt = '#,##0;[Red]-#,##0';
  categorySheet.autoFilter = { from: 'A1', to: 'C1' };

  const monthly = workbook.addWorksheet('Theo tháng');
  monthly.columns = [{ header: 'Tháng', key: 'label', width: 18 }, { header: 'Tổng thu (VND)', key: 'income', width: 22 }, { header: 'Tổng chi (VND)', key: 'expense', width: 22 }, { header: 'Chênh lệch (VND)', key: 'net', width: 25 }];
  for (const row of data.monthly) monthly.addRow({ ...row, net: row.income - row.expense });
  monthly.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  monthly.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087F6A' } };
  for (const column of [2, 3, 4]) monthly.getColumn(column).numFmt = '#,##0;[Red]-#,##0';
  return workbook;
}
