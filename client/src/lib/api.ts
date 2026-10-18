import axios, { type AxiosRequestConfig } from 'axios';
import type { DemoStore } from './demo';
import { demoReport, readStore, writeStore } from './demo';
import { monthKey } from './format';

export const http = axios.create({ baseURL: '/api', withCredentials: true, headers: { 'Content-Type': 'application/json' } });
let demoMode = false;
export const setDemoMode = (enabled: boolean) => { demoMode = enabled; };
export const isDemoMode = () => demoMode;

function id() { return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function getId(value: unknown): string { return typeof value === 'string' ? value : String((value as { _id?: string })?._id ?? ''); }
function ensureDemoBalance(accountId: string, amount: number, kind: unknown, excludeTransactionId?: string) {
  if (kind !== 'expense') return;
  const store = readStore();
  const account = store.accounts.find(item => item._id === accountId);
  if (!account) throw new Error('Tài khoản tiền không tồn tại.');
  const movement = store.transactions
    .filter(item => getId(item.accountId) === accountId && item._id !== excludeTransactionId)
    .reduce((sum, item) => sum + (item.kind === 'income' ? item.amount : -item.amount), 0);
  if (amount > account.openingBalance + movement) throw new Error('Số dư của bạn không đủ.');
}
function demoRequest(method: string, path: string, data?: Record<string, unknown>, params: Record<string, unknown> = {}): unknown {
  const store = readStore();
  const clean = path.replace(/^\//, '').replace(/\?.*$/, '');
  if (clean === 'health') return { ok: true, database: false, storage: 'mongodb' };
  if (clean.startsWith('auth/')) {
    if (clean.endsWith('register') && data?.name) store.user.name = String(data.name);
    writeStore(store);
    return { user: store.user };
  }
  if (clean === 'profile') {
    if (method !== 'GET' && data?.name) store.user.name = String(data.name);
    if (method !== 'GET' && typeof data?.avatar === 'string') store.user.avatar = data.avatar;
    writeStore(store); return { user: store.user };
  }
  if (clean.startsWith('reports/summary')) return demoReport(store.transactions, store.categories, store.accounts, params);
  if (clean.startsWith('transactions/export.')) throw new Error('Xuất tệp cần kết nối MongoDB. Hãy thiết lập MONGODB_URI trong .env.');
  if (clean === 'transactions') {
    if (method === 'GET') {
      const rows = store.transactions.filter(t => {
        const categoryId = getId(t.categoryId); const accountId = getId(t.accountId);
        const date = t.date.slice(0, 10);
        return (!params.kind || t.kind === params.kind) && (!params.categoryId || categoryId === params.categoryId) && (!params.accountId || accountId === params.accountId) && (!params.from || date >= String(params.from)) && (!params.to || date <= String(params.to)) && (!params.search || `${t.note} ${store.categories.find(c => c._id === categoryId)?.name ?? ''}`.toLowerCase().includes(String(params.search).toLowerCase()));
      }).sort((a, b) => params.sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
      const page = Math.max(1, Number(params.page ?? 1)); const limit = Math.max(1, Number(params.limit ?? 10)); const total = rows.length;
      return {
        items: rows.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        totals: rows.reduce((sum, row) => {
          sum[row.kind] += row.amount;
          return sum;
        }, { income: 0, expense: 0 }),
      };
    }
    if (method === 'POST' && data) {
      ensureDemoBalance(String(data.accountId ?? ''), Number(data.amount), data.kind);
      const item = { ...data, _id: id() } as any;
      store.transactions.unshift(item);
      writeStore(store);
      return { item };
    }
  }
  const transactionMatch = clean.match(/^transactions\/([^/]+)$/);
  if (transactionMatch) {
    const index = store.transactions.findIndex(item => item._id === transactionMatch[1]);
    if (index < 0) throw new Error('Không tìm thấy giao dịch.');
    if (method === 'PATCH' && data) {
      const updated = { ...store.transactions[index], ...data };
      ensureDemoBalance(
        getId(updated.accountId),
        Number(updated.amount),
        updated.kind,
        updated._id,
      );
      store.transactions[index] = updated;
      writeStore(store);
      return { item: updated };
    }
    if (method === 'DELETE') { store.transactions.splice(index, 1); writeStore(store); return {}; }
  }
  const collectionName = clean.split('/')[0] as keyof Pick<DemoStore, 'accounts' | 'categories' | 'budgets' | 'goals'>;
  const allowed: (keyof Pick<DemoStore, 'accounts' | 'categories' | 'budgets' | 'goals'>)[] = ['accounts', 'categories', 'budgets', 'goals'];
  if (allowed.includes(collectionName)) {
    const collection = store[collectionName] as any[];
    if (!clean.includes('/')) {
      if (method === 'GET') {
        const items = collectionName === 'budgets' ? collection.filter(item => item.period === String(params.period ?? monthKey())).map(item => {
          const categoryId = getId(item.categoryId);
          const spent = store.transactions.filter(t => t.kind === 'expense' && getId(t.categoryId) === categoryId && t.date.slice(0, 7) === item.period).reduce((sum, t) => sum + t.amount, 0);
          return { ...item, spent };
        }) : collectionName === 'accounts' ? collection.map(item => {
          const movement = store.transactions.filter(t => getId(t.accountId) === item._id).reduce((sum, t) => sum + (t.kind === 'income' ? t.amount : -t.amount), 0);
          return { ...item, balance: item.openingBalance + movement };
        }) : collection;
        return { items };
      }
      if (method === 'POST' && data) {
        const item: any = { ...data, _id: id() };
        if (collectionName === 'budgets') item.spent = 0;
        if (collectionName === 'goals') item.savedAmount = 0;
        collection.push(item); writeStore(store); return { item };
      }
    }
    const match = clean.match(new RegExp(`^${collectionName}/([^/]+)(?:/(contributions))?$`));
    if (match) {
      const index = collection.findIndex(item => item._id === match[1]);
      if (index < 0) throw new Error('Không tìm thấy dữ liệu.');
      if (match[2] === 'contributions' && data) collection[index].savedAmount += Number(data.amount ?? 0);
      else if (method === 'PATCH' && data) {
        if (collectionName === 'accounts' && typeof data.balance === 'number') {
          const account = collection[index];
          const movement = store.transactions.filter(t => getId(t.accountId) === account._id).reduce((sum, t) => sum + (t.kind === 'income' ? t.amount : -t.amount), 0);
          account.openingBalance = data.balance - movement;
          const fields = { ...data };
          delete fields.balance;
          collection[index] = { ...account, ...fields };
        } else collection[index] = { ...collection[index], ...data };
      }
      else if (method === 'DELETE') collection.splice(index, 1);
      writeStore(store); return { item: collection[index] };
    }
  }
  return {};
}

async function request<T>(method: string, path: string, data?: Record<string, unknown>, params?: Record<string, unknown>): Promise<T> {
  if (demoMode) return demoRequest(method, path, data, params) as T;
  const config: AxiosRequestConfig = { method, url: path, params, data };
  const response = await http.request<T>(config);
  return response.data;
}
export const get = <T>(path: string, params?: Record<string, unknown>) => request<T>('GET', path, undefined, params);
export const post = <T>(path: string, data?: Record<string, unknown>) => request<T>('POST', path, data);
export const patch = <T>(path: string, data?: Record<string, unknown>) => request<T>('PATCH', path, data);
export const put = <T>(path: string, data?: Record<string, unknown>) => request<T>('PUT', path, data);
export const del = <T = void>(path: string) => request<T>('DELETE', path);
