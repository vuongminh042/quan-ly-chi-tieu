import { Router } from 'express';
import { Goal } from '../models/finance.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/http.js';
import { contributionSchema, goalSchema } from './validation.js';
import { asyncRouter } from '../middleware/async-router.js';

const router = asyncRouter();
router.use(requireDatabase, requireAuth);
router.get('/', async (req, res) => {
  const items = await Goal.find({ userId: req.userId }).sort({ deadline: 1, createdAt: -1 }).lean();
  res.json({ items });
});
router.post('/', async (req, res) => {
  const input = goalSchema.parse(req.body);
  const item = await Goal.create({ ...input, userId: req.userId });
  res.status(201).json({ item });
});
router.patch('/:id', async (req, res) => {
  const input = goalSchema.partial().parse(req.body);
  const item = await Goal.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, input, { new: true, runValidators: true });
  if (!item) { res.status(404).json({ error: 'Không tìm thấy mục tiêu.' }); return; }
  res.json({ item });
});
router.post('/:id/contributions', async (req, res) => {
  const { amount } = contributionSchema.parse(req.body);
  const item = await Goal.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { $inc: { savedAmount: amount } }, { new: true, runValidators: true });
  if (!item) { res.status(404).json({ error: 'Không tìm thấy mục tiêu.' }); return; }
  res.json({ item });
});
router.delete('/:id', async (req, res) => {
  const item = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!item) { res.status(404).json({ error: 'Không tìm thấy mục tiêu.' }); return; }
  res.status(204).end();
});
export default router;
