import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { databaseReady } from '../config/database.js';
import rateLimit from 'express-rate-limit';

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function allowedOrigins(): Set<string> {
  const values = [process.env.APP_BASE_URL, ...(process.env.CORS_ORIGINS ?? '').split(',')];
  return new Set(values.map(value => {
    try { return value?.trim() ? new URL(value.trim()).origin : ''; } catch { return ''; }
  }).filter(Boolean));
}

/** Reject browser initiated cross-site writes. Requests without Origin remain available to non-browser API clients. */
export function protectBrowserWrites(req: Request, res: Response, next: NextFunction): void {
  if (!writeMethods.has(req.method)) { next(); return; }
  const origin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');
  const origins = allowedOrigins();
  const requestOrigin = `${req.protocol}://${req.get('host')}`.toLowerCase();
  const originAllowed = !origin || origin.toLowerCase() === requestOrigin || origins.has(origin);
  if (!originAllowed || (fetchSite === 'cross-site' && (!origin || !origins.has(origin)))) {
    res.status(403).json({ error: 'Yêu cầu từ nguồn không được phép.', code: 'ORIGIN_NOT_ALLOWED' });
    return;
  }
  next();
}

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Có quá nhiều yêu cầu. Vui lòng thử lại sau.', code: 'RATE_LIMITED' },
});

export function requireDatabase(_req: Request, res: Response, next: NextFunction): void {
  if (!databaseReady()) {
    res.status(503).json({ error: 'MongoDB chưa kết nối. Hãy cấu hình MONGODB_URI trong tệp .env.', code: 'DATABASE_UNAVAILABLE' });
    return;
  }
  next();
}

export const apiErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Nội dung yêu cầu vượt quá giới hạn cho phép.' });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON gửi lên không hợp lệ.' });
    return;
  }
  if (error?.name === 'ZodError') {
    res.status(400).json({ error: 'Dữ liệu gửi lên chưa hợp lệ.', details: error.issues?.map((item: { message: string; path: (string | number)[] }) => ({ field: item.path.join('.'), message: item.message })) });
    return;
  }
  if (error?.code === 11000) {
    res.status(409).json({ error: 'Bản ghi này đã tồn tại.' });
    return;
  }
  if (error?.name === 'CastError' || error?.name === 'ValidationError') {
    res.status(400).json({ error: 'Dữ liệu không hợp lệ hoặc bản ghi không tồn tại.' });
    return;
  }
  const status = Number(error?.status) || 500;
  if (status >= 500) console.error('API error:', error);
  res.status(status).json({ error: status >= 500 ? 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại.' : error.message || 'Yêu cầu không hợp lệ.' });
};

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Không tìm thấy đường dẫn API.' });
}
