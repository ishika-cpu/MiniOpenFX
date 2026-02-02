import { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { AppError } from "../domain/errors.js";

//globally handled errors
export const errorHandler: ErrorHandler = (err, c) => {
  console.error(err);

  if (err instanceof ZodError) {
    return c.json({ error: { code: "VALIDATION_ERROR", details: err.flatten() } }, 400);
  }

  if (err instanceof AppError) {
    return c.json({ error: { code: err.code, message: err.message, details: err.details } }, (err.status as any) || 400);
  }

  return c.json({ error: { code: "INTERNAL_ERROR", message: err.message } }, 500);
};