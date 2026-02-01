export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function badRequest(message: string, details?: Record<string, unknown>) {
  return new AppError("INVALID_REQUEST", message, 400, details);
}

export function notFound(message: string, details?: Record<string, unknown>) {
  return new AppError("NOT_FOUND", message, 404, details);
}

export function upstreamUnavailable(message: string, details?: Record<string, unknown>) {
  return new AppError("UPSTREAM_UNAVAILABLE", message, 502, details);
}
