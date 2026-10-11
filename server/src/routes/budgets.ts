import { Router } from 'express';
import { Types } from 'mongoose';
import { Category } from '../models/core.js';
import { Budget, Transaction } from '../models/finance.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/http.js';
import { budgetSchema } from './validation.js';

const router = Router();
router.use(requireDatabase, requireAuth);
router.get('/', async (req, res) => {
  const period = typeof req.query.period === 'string' ? req.query.period : new Date().toISOString().slice(0, 7);
  const items = await Budget.find({ userId: req.userId, period }).populate('categoryId', 'name icon color').lean();
  const categoryIds = items.map(item => item.categoryId && typeof item.categoryId === 'object' && '_id' in item.categoryId ? item.categoryId._id : item.categoryId).filter(Boolean);
  const [year, month] = period.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const spentRows = await Transaction.aggregate([
    { $match: { userId: new Types.ObjectId(req.userId), kind: 'expense', categoryId: { $in: categoryIds }, date: { $gte: start, $lt: end } } },
    { $group: { _id: '$categoryId', spent: { $sum: '$amount' } } },
  ]);
  const spent = new Map(spentRows.map(row => [String(row._id), row.spent]));
  res.json({ items: items.map(item => ({ ...item, spent: spent.get(String((item.categoryId as { _id?: unknown })?._id ?? item.categoryId)) ?? 0 })) });
});
router.post('/', async (req, res) => {
  const input = budgetSchema.parse(req.body);
  if (!(await Category.exists({ _id: input.categoryId, userId: req.userId, kind: 'expense' }))) { res.status(400).json({ error: 'Chỉ có thể đặt ngân sách cho danh mục chi tiêu của bạn.' }); return; }
  const item = await Budget.findOneAndUpdate({ userId: req.userId, categoryId: input.categoryId, period: input.period }, { $set: input }, { new: true, upsert: true, runValidators: true }).populate('categoryId', 'name icon color');
  res.status(201).json({ item });
});
router.delete('/:id', async (req, res) => {
  const item = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!item) { res.status(404).json({ error: 'Không tìm thấy ngân sách.' }); return; }
  res.status(204).end();
});
export default router;
