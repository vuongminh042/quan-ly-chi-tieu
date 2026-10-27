import mongoose from 'mongoose';

export async function connectDatabase(): Promise<boolean> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.warn('MONGODB_URI chưa được cấu hình; API chạy ở chế độ xem thử, các thao tác dữ liệu sẽ yêu cầu MongoDB.');
    return false;
  }
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8_000,
      maxPoolSize: 20,
      minPoolSize: 2,
    });
    console.info(`Đã kết nối MongoDB (${mongoose.connection.name}).`);
    return true;
  } catch (error) {
    console.error('Không thể kết nối MongoDB:', error instanceof Error ? error.message : error);
    return false;
  }
}

export function databaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
