import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { databaseReady } from '../config/database.js';

export function requireDatabase(_req: Request, res: Response, next: NextFunction): void {
  if (!databaseReady()) {
    res.status(503).json({ error: 'MongoDB chưa kết nối. Hãy cấu hình MONGODB_URI trong tệp .env.', code: 'DATABASE_UNAVAILABLE' });
    return;
  }
  next();
}

export const apiErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
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
