import { Router } from 'express';
import { Category } from '../models/core.js';
import { Transaction } from '../models/finance.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/http.js';
import { categorySchema } from './validation.js';

const router = Router();
router.use(requireDatabase, requireAuth);

router.get('/', async (req, res) => {
  const items = await Category.find({ userId: req.userId }).sort({ kind: 1, name: 1 }).lean();
  res.json({ items });
});
router.post('/', async (req, res) => {
  const input = categorySchema.parse(req.body);
  const item = await Category.create({ ...input, userId: req.userId });
  res.status(201).json({ item });
});
router.patch('/:id', async (req, res) => {
  const input = categorySchema.partial().parse(req.body);
  const item = await Category.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, input, { new: true, runValidators: true });
  if (!item) { res.status(404).json({ error: 'Không tìm thấy danh mục.' }); return; }
  res.json({ item });
});
router.delete('/:id', async (req, res) => {
  if (await Transaction.exists({ userId: req.userId, categoryId: req.params.id })) {
    res.status(409).json({ error: 'Danh mục đang được sử dụng trong giao dịch.' });
    return;
  }
  const item = await Category.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!item) { res.status(404).json({ error: 'Không tìm thấy danh mục.' }); return; }
  res.status(204).end();
});
export default router;
