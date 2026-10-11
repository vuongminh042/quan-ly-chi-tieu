import { Router } from 'express';
import { Types } from 'mongoose';
import { Account, Category } from '../models/core.js';
import { Transaction } from '../models/finance.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/http.js';
import { queryTransactions } from '../services/transactions.js';
import { transactionSchema } from './validation.js';
import { buildReport, exportWorkbook } from '../services/reports.js';

const router = Router();
router.use(requireDatabase, requireAuth);

async function validateReferences(userId: string, categoryId: string, accountId: string, kind: string): Promise<void> {
  const [category, account] = await Promise.all([
    Category.findOne({ _id: categoryId, userId, kind }).select('_id'),
    Account.findOne({ _id: accountId, userId }).select('_id'),
  ]);
  if (!category) throw Object.assign(new Error('Danh mục không tồn tại hoặc không đúng loại giao dịch.'), { status: 400 });
  if (!account) throw Object.assign(new Error('Tài khoản tiền không tồn tại.'), { status: 400 });
}

async function ensureSufficientBalance(
  userId: string,
  accountId: string,
  amount: number,
  kind: string,
  excludeTransactionId?: Types.ObjectId,
): Promise<void> {
  if (kind !== 'expense') return;
  const account = await Account.findOne({ _id: accountId, userId }).select('openingBalance');
  if (!account) throw Object.assign(new Error('Tài khoản tiền không tồn tại.'), { status: 400 });
  const match: Record<string, unknown> = {
    userId,
    accountId: account._id,
  };
  if (excludeTransactionId) match._id = { $ne: excludeTransactionId };
  const sums = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: '$kind', amount: { $sum: '$amount' } } },
  ]);
  const netMovement = sums.reduce(
    (net, sum) => net + (sum._id === 'income' ? sum.amount : -sum.amount),
    0,
  );
  const availableBalance = account.openingBalance + netMovement;
  if (amount > availableBalance) {
    throw Object.assign(new Error('Số dư của bạn không đủ.'), { status: 409 });
  }
}

router.get('/export.csv', async (req, res) => {
  const report = await buildReport(req.userId!, req.query as Record<string, unknown>);
  const lines = [
    ['Ngày', 'Loại', 'Danh mục', 'Tài khoản', 'Ghi chú', 'Hình thức thanh toán', 'Số tiền'],
    ...report.transactions.map(row => [row.date.toLocaleDateString('vi-VN'), row.kind === 'income' ? 'Thu' : 'Chi', row.categoryName, row.accountName, row.note, row.paymentMethod, row.amount]),
  ];
  const csvCell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = '\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bao-cao-thu-chi_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

router.get('/export.xlsx', async (req, res) => {
  const workbook = await exportWorkbook(req.userId!, req.query as Record<string, unknown>);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="bao-cao-thu-chi_${new Date().toISOString().slice(0, 10)}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

router.get('/', async (req, res) => {
  res.json(await queryTransactions(req.userId!, req.query as Record<string, unknown>));
});
router.post('/', async (req, res) => {
  const input = transactionSchema.parse(req.body);
  await validateReferences(req.userId!, input.categoryId, input.accountId, input.kind);
  await ensureSufficientBalance(req.userId!, input.accountId, input.amount, input.kind);
  const item = await Transaction.create({ ...input, userId: req.userId });
  const populated = await item.populate([{ path: 'categoryId', select: 'name icon color' }, { path: 'accountId', select: 'name kind color' }]);
  res.status(201).json({ item: populated });
});
router.get('/:id', async (req, res) => {
  const item = await Transaction.findOne({ _id: req.params.id, userId: req.userId })
    .populate('categoryId', 'name icon color').populate('accountId', 'name kind color').lean();
  if (!item) { res.status(404).json({ error: 'Không tìm thấy giao dịch.' }); return; }
  res.json({ item });
});
router.patch('/:id', async (req, res) => {
  const input = transactionSchema.partial().parse(req.body);
  const current = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
  if (!current) { res.status(404).json({ error: 'Không tìm thấy giao dịch.' }); return; }
  const kind = input.kind ?? current.kind;
  const categoryId = input.categoryId ?? String(current.categoryId);
  const accountId = input.accountId ?? String(current.accountId);
  await validateReferences(req.userId!, categoryId, accountId, kind);
  await ensureSufficientBalance(
    req.userId!,
    accountId,
    input.amount ?? current.amount,
    kind,
    current._id,
  );
  Object.assign(current, input);
  await current.save();
  const item = await current.populate([{ path: 'categoryId', select: 'name icon color' }, { path: 'accountId', select: 'name kind color' }]);
  res.json({ item });
});
router.delete('/:id', async (req, res) => {
  const item = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!item) { res.status(404).json({ error: 'Không tìm thấy giao dịch.' }); return; }
  res.status(204).end();
});

export default router;
