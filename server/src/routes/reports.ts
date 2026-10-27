import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/http.js';
import { buildReport } from '../services/reports.js';
import { asyncRouter } from '../middleware/async-router.js';

const router = asyncRouter();
router.use(requireDatabase, requireAuth);
router.get('/summary', async (req, res) => {
  const { transactions: _transactions, ...report } = await buildReport(req.userId!, req.query as Record<string, unknown>);
  res.json(report);
});
export default router;
