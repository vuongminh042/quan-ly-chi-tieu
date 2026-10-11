import { Router } from 'express';
import { Types } from 'mongoose';
import { Account } from '../models/core.js';
import { Transaction } from '../models/finance.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/http.js';
import { accountSchema, accountUpdateSchema } from './validation.js';

const router = Router();
router.use(requireDatabase, requireAuth);

router.get('/', async (req, res) => {
  const rows = await Account.find({ userId: req.userId }).sort({ createdAt: 1 }).lean();
  const sums = await Transaction.aggregate([
    { $match: { userId: new Types.ObjectId(req.userId), accountId: { $in: rows.map(row => row._id) } } },
    { $group: { _id: { accountId: '$accountId', kind: '$kind' }, amount: { $sum: '$amount' } } },
  ]);
  const totals = new Map<string, { income: number; expense: number }>();
  for (const sum of sums) {
    const id = String(sum._id.accountId);
    const value = totals.get(id) ?? { income: 0, expense: 0 };
    value[sum._id.kind as 'income' | 'expense'] = sum.amount;
    totals.set(id, value);
  }
  res.json({ items: rows.map(row => {
    const amount = totals.get(String(row._id)) ?? { income: 0, expense: 0 };
    return { ...row, balance: row.openingBalance + amount.income - amount.expense };
  }) });
});

router.post('/', async (req, res) => {
  const input = accountSchema.parse(req.body);
  const item = await Account.create({ ...input, userId: req.userId });
  res.status(201).json({ item });
});

router.patch('/:id', async (req, res) => {
  const input = accountUpdateSchema.parse(req.body);
  const account = await Account.findOne({ _id: req.params.id, userId: req.userId });
  if (!account) { res.status(404).json({ error: 'Không tìm thấy tài khoản.' }); return; }
  const { balance, ...fields } = input;
  if (balance !== undefined) {
    const sums = await Transaction.aggregate([
      { $match: { userId: new Types.ObjectId(req.userId), accountId: account._id } },
      { $group: { _id: '$kind', amount: { $sum: '$amount' } } },
    ]);
    const netMovement = sums.reduce((net, sum) => net + (sum._id === 'income' ? sum.amount : -sum.amount), 0);
    account.openingBalance = balance - netMovement;
  }
  Object.assign(account, fields);
  const item = await account.save();
  res.json({ item: { ...item.toObject(), ...(balance === undefined ? {} : { balance }) } });
});

router.delete('/:id', async (req, res) => {
  if (await Transaction.exists({ userId: req.userId, accountId: req.params.id })) {
    res.status(409).json({ error: 'Tài khoản đang có giao dịch. Hãy chuyển hoặc xóa giao dịch trước.' });
    return;
  }
  const item = await Account.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!item) { res.status(404).json({ error: 'Không tìm thấy tài khoản.' }); return; }
  res.status(204).end();
});

export default router;
