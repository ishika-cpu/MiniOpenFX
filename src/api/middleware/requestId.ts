import type { MiddlewareHandler } from "hono";

export function requestId(): MiddlewareHandler {
  return async (c, next) => {
    const id = crypto.randomUUID();
    c.set("requestId", id);
    c.header("X-Request-Id", id);
    await next();
  };
}
