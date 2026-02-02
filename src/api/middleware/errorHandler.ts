import type { MiddlewareHandler } from "hono";
import { ZodError } from "zod";//input validation errors, runs at runtime
import { AppError } from "../../domain/errors.js";//custom errors

export function errorHandler(): MiddlewareHandler {
  return async (c, next) => {
    try { //run all middleware and routes
      await next();
    } catch (err: any) {//catch any errors
      if (err instanceof ZodError) {
        return c.json(
          { error: { code: "INVALID_REQUEST", message: "Validation failed", details: err.flatten() } },
          400
        );
      }

      if (err instanceof AppError) {//business logic
        return c.json(
          { error: { code: err.code, message: err.message, details: err.details ?? {} } },
          err.status as any//avoid TS mismatch with hono's strict typing
        );
      }

      return c.json(//unkown safety fallback
        { error: { code: "INTERNAL", message: "Unexpected error" } },
        500
      );
    }
  };
}
