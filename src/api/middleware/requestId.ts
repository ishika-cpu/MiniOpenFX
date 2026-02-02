//generate id for each request
import type { MiddlewareHandler } from "hono";

export function requestId(): MiddlewareHandler {//returns a middleware
  return async (c, next) => {
    const id = crypto.randomUUID();//generate a random id
    c.set("requestId", id);//set it in the context
    c.header("X-Request-Id", id);//set it in the response headers
    await next();
  };
}
