import type { Account, Budget, Category, Goal, Kind, Report, Transaction, User } from '../types';
import { monthKey } from './format';

const categories: Category[] = [
  { _id: 'c-food', name: 'Ăn uống', kind: 'expense', icon: 'utensils', color: '#ef8d64' },
  { _id: 'c-home', name: 'Nhà cửa', kind: 'expense', icon: 'house', color: '#d3a34a' },
  { _id: 'c-move', name: 'Di chuyển', kind: 'expense', icon: 'car', color: '#7098cc' },
  { _id: 'c-shop', name: 'Mua sắm', kind: 'expense', icon: 'shopping-bag', color: '#b983b2' },
  { _id: 'c-fun', name: 'Giải trí', kind: 'expense', icon: 'sparkles', color: '#9279c6' },
  { _id: 'c-health', name: 'Sức khỏe', kind: 'expense', icon: 'heart-pulse', color: '#df7681' },
  { _id: 'c-other', name: 'Khác', kind: 'expense', icon: 'circle', color: '#98a09d' },
  { _id: 'c-salary', name: 'Lương', kind: 'income', icon: 'briefcase-business', color: '#087f6a' },
  { _id: 'c-bonus', name: 'Thưởng', kind: 'income', icon: 'gift', color: '#63a58b' },
  { _id: 'c-invest', name: 'Đầu tư', kind: 'income', icon: 'chart-no-axes-combined', color: '#809962' },
];
const accounts: Account[] = [
  { _id: 'a-bank', name: 'Tài khoản ngân hàng', kind: 'bank', openingBalance: 0, balance: 18_450_000, color: '#087f6a' },
  { _id: 'a-cash', name: 'Tiền mặt', kind: 'cash', openingBalance: 0, balance: 2_150_000, color: '#d3a34a' },
  { _id: 'a-wallet', name: 'Ví MoMo', kind: 'ewallet', openingBalance: 0, balance: 780_000, color: '#b983b2' },
];
const expenseNotes = [
  ['Ăn sáng cùng đồng nghiệp', 'c-food', 65000, 'a-cash'], ['Tiền thuê nhà tháng này', 'c-home', 6500000, 'a-bank'],
  ['Cà phê cuối tuần', 'c-food', 89000, 'a-wallet'], ['Gửi xe và xăng', 'c-move', 210000, 'a-cash'],
  ['Mua sách thiết kế', 'c-shop', 320000, 'a-bank'], ['Xem phim tối thứ sáu', 'c-fun', 180000, 'a-wallet'],
  ['Mua rau củ cuối tuần', 'c-food', 365000, 'a-bank'], ['Phí internet', 'c-home', 220000, 'a-bank'],
  ['Yoga tháng này', 'c-health', 450000, 'a-bank'], ['Ăn trưa', 'c-food', 95000, 'a-cash'],
  ['Gọi xe về nhà', 'c-move', 145000, 'a-wallet'], ['Đồ dùng trong nhà', 'c-home', 285000, 'a-bank'],
] as const;
function createTransactions(): Transaction[] {
  const now = new Date();
  const rows: Transaction[] = [];
  for (let offset = 5; offset >= 0; offset--) {
    const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    rows.push({ _id: `t-salary-${offset}`, kind: 'income', amount: 28_000_000 + (offset % 2) * 1_500_000, date: new Date(month.getFullYear(), month.getMonth(), 2).toISOString(), categoryId: 'c-salary', accountId: 'a-bank', note: 'Lương tháng', paymentMethod: 'transfer' });
    if (offset === 1) rows.push({ _id: `t-bonus-${offset}`, kind: 'income', amount: 2_400_000, date: new Date(month.getFullYear(), month.getMonth(), 15).toISOString(), categoryId: 'c-bonus', accountId: 'a-bank', note: 'Thưởng dự án', paymentMethod: 'transfer' });
    expenseNotes.forEach((item, index) => {
      const [note, categoryId, amount, accountId] = item;
      const day = Math.min(3 + index * 2, new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
      rows.push({ _id: `t-${offset}-${index}`, kind: 'expense', amount: amount + (offset % 3) * 10000, date: new Date(month.getFullYear(), month.getMonth(), day).toISOString(), categoryId, accountId, note, paymentMethod: index % 3 === 0 ? 'cash' : 'transfer' });
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export type DemoStore = { categories: Category[]; accounts: Account[]; transactions: Transaction[]; budgets: Budget[]; goals: Goal[]; user: User };
const demoUser: User = { id: 'demo-user', name: 'Linh Nguyễn', email: 'linh@example.com' };
const current = monthKey();
const defaults: DemoStore = {
  categories, accounts, transactions: createTransactions(),
  budgets: [
    { _id: 'b-food', period: current, amount: 4500000, spent: 0, categoryId: 'c-food' },
    { _id: 'b-home', period: current, amount: 7500000, spent: 0, categoryId: 'c-home' },
    { _id: 'b-move', period: current, amount: 1800000, spent: 0, categoryId: 'c-move' },
    { _id: 'b-shop', period: current, amount: 2200000, spent: 0, categoryId: 'c-shop' },
  ],
  goals: [
    { _id: 'g-trip', name: 'Du lịch Đà Lạt', targetAmount: 15000000, savedAmount: 9200000, deadline: new Date(new Date().getFullYear(), new Date().getMonth() + 3, 20).toISOString(), icon: 'plane', color: '#7098cc' },
    { _id: 'g-emergency', name: 'Quỹ dự phòng', targetAmount: 50000000, savedAmount: 32750000, deadline: new Date(new Date().getFullYear(), new Date().getMonth() + 10, 1).toISOString(), icon: 'shield-check', color: '#087f6a' },
  ], user: demoUser,
};
for (const budget of defaults.budgets) budget.spent = defaults.transactions.filter(t => t.kind === 'expense' && t.categoryId === budget.categoryId && t.date.startsWith(current)).reduce((sum, t) => sum + t.amount, 0);
const STORE_KEY = 'chitieu-demo-v1';
let memory: DemoStore | null = null;
export function readStore(): DemoStore {
  if (memory) return memory;
  try {
    const saved = localStorage.getItem(STORE_KEY);
    memory = saved ? JSON.parse(saved) as DemoStore : structuredClone(defaults);
  } catch { memory = structuredClone(defaults); }
  return memory;
}
export function writeStore(store: DemoStore): DemoStore {
  memory = store;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* storage may be blocked; current tab still works */ }
  return store;
}
export function demoReport(transactions: Transaction[], categoriesList: Category[], accountsList: Account[], query: Record<string, unknown> = {}): Report {
  const from = String(query.from ?? '');
  const to = String(query.to ?? '');
  const selected = transactions.filter(t => (!from || t.date.slice(0, 10) >= from) && (!to || t.date.slice(0, 10) <= to));
  const totalIncome = selected.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = selected.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
  const byCategory = new Map<string, { name: string; kind: Kind; amount: number; color: string }>();
  const byMonth = new Map<string, { month: string; label: string; income: number; expense: number }>();
  const groupBy = query.groupBy === 'day' || query.groupBy === 'year' ? query.groupBy : 'month';
  const byPeriod = new Map<string, { period: string; label: string; income: number; expense: number }>();
  for (const row of selected) {
    const catId = typeof row.categoryId === 'string' ? row.categoryId : row.categoryId._id;
    const cat = categoriesList.find(c => c._id === catId);
    const category = byCategory.get(catId) ?? { name: cat?.name ?? 'Khác', kind: row.kind, amount: 0, color: cat?.color ?? '#92999a' };
    category.amount += row.amount; byCategory.set(catId, category);
    const month = row.date.slice(0, 7);
    const bucket = byMonth.get(month) ?? { month, label: `${month.slice(5)}/${month.slice(0, 4)}`, income: 0, expense: 0 };
    bucket[row.kind] += row.amount; byMonth.set(month, bucket);
    const period = groupBy === 'day' ? row.date.slice(0, 10) : groupBy === 'year' ? row.date.slice(0, 4) : month;
    const label = groupBy === 'day' ? new Date(row.date).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}) : groupBy === 'year' ? period : `${month.slice(5)}/${month.slice(0,4)}`;
    const periodBucket = byPeriod.get(period) ?? { period, label, income: 0, expense: 0 };
    periodBucket[row.kind] += row.amount; byPeriod.set(period, periodBucket);
  }
  return { totalIncome, totalExpense, net: totalIncome - totalExpense, transactionCount: selected.length, categories: [...byCategory.values()].sort((a,b)=>b.amount-a.amount), accounts: accountsList.map(a => ({ name: a.name, income: selected.filter(t => t.kind === 'income' && (typeof t.accountId === 'string' ? t.accountId : t.accountId._id) === a._id).reduce((s,t)=>s+t.amount,0), expense: selected.filter(t => t.kind === 'expense' && (typeof t.accountId === 'string' ? t.accountId : t.accountId._id) === a._id).reduce((s,t)=>s+t.amount,0) })), monthly: [...byMonth.values()].sort((a,b)=>a.month.localeCompare(b.month)), trend:[...byPeriod.values()].sort((a,b)=>a.period.localeCompare(b.period)) };
}
