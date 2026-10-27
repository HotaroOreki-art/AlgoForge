/**
 * Application error with an HTTP status and a stable machine-readable code.
 * Messages are safe to show to end users; internal details go to logs only.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'You need to sign in to do that.') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have access to this resource.') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Not found.') {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }
  static upstream(message: string, details?: unknown) {
    return new AppError(502, 'UPSTREAM_ERROR', message, details);
  }
  static tooMany(message = 'Too many requests. Please slow down.') {
    return new AppError(429, 'RATE_LIMITED', message);
  }
  static notConfigured(message: string) {
    return new AppError(503, 'NOT_CONFIGURED', message);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
