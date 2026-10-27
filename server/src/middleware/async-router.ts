import { Router, type RequestHandler } from 'express';

/** Express 4 does not forward rejected promises from async route handlers. */
export function asyncRouter() {
  const router = Router();
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'use'] as const;
  for (const method of methods) {
    const original = router[method].bind(router) as (...args: unknown[]) => unknown;
    (router as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
      const wrap = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(wrap);
        if (typeof value !== 'function' || value.constructor.name !== 'AsyncFunction') return value;
        const handler = value as RequestHandler;
        return ((req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]) => {
          Promise.resolve(handler(req, res, next)).catch(next);
        }) satisfies RequestHandler;
      };
      return original(...args.map(wrap));
    };
  }
  return router;
}
