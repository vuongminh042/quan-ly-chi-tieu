import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import accountRoutes from './routes/accounts.js';
import categoryRoutes from './routes/categories.js';
import transactionRoutes from './routes/transactions.js';
import goalRoutes from './routes/goals.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import supportRoutes from './routes/support.js';
import { databaseReady } from './config/database.js';
import { apiErrorHandler, apiRateLimiter, notFound, protectBrowserWrites } from './middleware/http.js';

const app = express();
app.disable('x-powered-by');
// Trust only the immediate reverse proxy when explicitly enabled by the deployment.
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(helmet({ frameguard: false, contentSecurityPolicy: false }));
app.use(express.json({ limit: '64kb', strict: true }));
app.use(cookieParser());
app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/api', apiRateLimiter, protectBrowserWrites);
app.get('/api/health', (_req, res) => res.status(200).json({ ok: true, database: databaseReady(), storage: 'mongodb' }));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api', notFound);

if (process.env.NODE_ENV === 'production') {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientPath = path.resolve(here, '../../client/dist');
  app.use(express.static(clientPath, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(clientPath, 'index.html')));
}
app.use(apiErrorHandler);

export default app;
