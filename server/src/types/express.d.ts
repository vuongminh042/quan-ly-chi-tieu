declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionExpiresAt?: number;
    }
  }
}
export {};
