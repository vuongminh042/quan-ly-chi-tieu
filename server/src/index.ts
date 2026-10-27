import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: process.env.ENV_FILE || fileURLToPath(new URL('../../.env', import.meta.url)) });

const [{ default: app }, { connectDatabase }] = await Promise.all([
  import('./app.js'),
  import('./config/database.js'),
]);
const { initSupportSocket } = await import('./services/support-socket.js');

const port = Number(process.env.PORT || (process.env.NODE_ENV === 'production' ? 3000 : process.env.SERVER_PORT || 4000));
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error('JWT_SECRET cần có ít nhất 32 ký tự trong môi trường production.');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI bắt buộc trong môi trường production.');
  if (!process.env.APP_BASE_URL) throw new Error('APP_BASE_URL bắt buộc trong môi trường production.');
}
const connected = await connectDatabase();
if (process.env.NODE_ENV === 'production' && !connected)
  throw new Error('Không thể kết nối MongoDB; dừng khởi động để tránh chạy API ở trạng thái không an toàn.');
const server = app.listen(port, '0.0.0.0', () => console.info(`Chi Tiêu API sẵn sàng tại cổng ${port}.`));
const supportIo = initSupportSocket(server);

async function shutdown(signal: string) {
  console.info(`${signal}: đang đóng máy chủ…`);
  supportIo.close(async () => {
    const mongoose = await import('mongoose');
    await mongoose.default.disconnect();
    process.exit(0);
  });
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
