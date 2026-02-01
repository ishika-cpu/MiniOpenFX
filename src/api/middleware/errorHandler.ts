import type { MiddlewareHandler } from "hono";
import { ZodError } from "zod";
import { AppError } from "../../domain/errors.js";


export function errorHandler(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        return c.json(
          { error: { code: "INVALID_REQUEST", message: "Validation failed", details: err.flatten() } },
          400
        );
      }

      if (err instanceof AppError) {
        return c.json(
          { error: { code: err.code, message: err.message, details: err.details ?? {} } },
          err.status as any
        );
      }

      return c.json(
        { error: { code: "INTERNAL", message: "Unexpected error" } },
        500
      );
    }
  };
}
