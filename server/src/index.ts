import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: process.env.ENV_FILE || fileURLToPath(new URL('../../.env', import.meta.url)) });

const [{ default: app }, { connectDatabase }] = await Promise.all([
  import('./app.js'),
  import('./config/database.js'),
]);
const { initSupportSocket } = await import('./services/support-socket.js');

const port = Number(process.env.PORT || (process.env.NODE_ENV === 'production' ? 3000 : process.env.SERVER_PORT || 4000));
await connectDatabase();
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
