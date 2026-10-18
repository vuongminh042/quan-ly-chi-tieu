import { Types, type FilterQuery } from 'mongoose';
import { Category } from '../models/core.js';
import { Transaction } from '../models/finance.js';

type QueryInput = Record<string, unknown>;

export async function transactionFilter(userId: string, query: QueryInput): Promise<FilterQuery<Record<string, unknown>>> {
  const filter: FilterQuery<Record<string, unknown>> = { userId };
  if (query.kind === 'income' || query.kind === 'expense') filter.kind = query.kind;
  if (typeof query.categoryId === 'string' && query.categoryId) filter.categoryId = query.categoryId;
  if (typeof query.accountId === 'string' && query.accountId) filter.accountId = query.accountId;
  const date: Record<string, Date> = {};
  if (typeof query.from === 'string' && query.from) date.$gte = new Date(`${query.from.slice(0, 10)}T00:00:00.000Z`);
  if (typeof query.to === 'string' && query.to) date.$lte = new Date(`${query.to.slice(0, 10)}T23:59:59.999Z`);
  if (Object.keys(date).length) filter.date = date;
  if (typeof query.search === 'string' && query.search.trim()) {
    const pattern = new RegExp(escapeRegex(query.search.trim().slice(0, 80)), 'i');
    const matchingCategories = await Category.find({ userId, name: pattern }).distinct('_id');
    filter.$or = [{ note: pattern }, { categoryId: { $in: matchingCategories } }];
  }
  return filter;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function queryTransactions(userId: string, query: QueryInput) {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 10)));
  const filter = await transactionFilter(userId, query);
  const totalsFilter: FilterQuery<Record<string, unknown>> = {
    ...filter,
    userId: new Types.ObjectId(userId),
  };
  if (typeof filter.categoryId === 'string')
    totalsFilter.categoryId = new Types.ObjectId(filter.categoryId);
  if (typeof filter.accountId === 'string')
    totalsFilter.accountId = new Types.ObjectId(filter.accountId);
  const [items, total, totals] = await Promise.all([
    Transaction.find(filter).populate('categoryId', 'name icon color').populate('accountId', 'name kind color')
      .sort({ date: query.sort === 'oldest' ? 1 : -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Transaction.countDocuments(filter),
    Transaction.aggregate<{ _id: 'income' | 'expense'; amount: number }>([
      { $match: totalsFilter },
      { $group: { _id: '$kind', amount: { $sum: '$amount' } } },
    ]),
  ]);
  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    totals: {
      income: totals.find((item) => item._id === 'income')?.amount ?? 0,
      expense: totals.find((item) => item._id === 'expense')?.amount ?? 0,
    },
  };
}
