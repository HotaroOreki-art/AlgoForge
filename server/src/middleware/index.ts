import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { AppError, isAppError } from '../lib/errors.ts';
import { AUTH_COOKIE, verifySession } from '../lib/auth.ts';
import { logger } from '../config/logger.ts';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; email: string };
    validated?: unknown;
  }
}

/** Wraps an async route so rejections flow to the error handler. */
export function asyncHandler<T extends RequestHandler>(fn: T): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Requires a valid session cookie; attaches `req.user`. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = (req.cookies as Record<string, string | undefined> | undefined)?.[AUTH_COOKIE];
  if (!token) return next(AppError.unauthorized());
  const session = verifySession(token);
  if (!session) return next(AppError.unauthorized('Your session has expired. Please sign in again.'));
  req.user = { id: session.sub, email: session.email };
  next();
};

/** Validates req.body / req.query / req.params with a zod schema. */
export function validate<S extends ZodTypeAny>(schema: S, source: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      const first = details[0];
      return next(
        AppError.badRequest(first ? (first.path ? `${first.path}: ${first.message}` : first.message) : 'Invalid input.', details),
      );
    }
    req.validated = result.data as z.infer<S>;
    next();
  };
}

export function getValidated<T>(req: Request): T {
  return req.validated as T;
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(AppError.notFound('That API route does not exist.'));
};

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (isAppError(err)) {
    if (err.status >= 500) logger.error({ err, path: req.path }, err.message);
    else logger.debug({ code: err.code, path: req.path }, err.message);
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  // Mongoose duplicate key
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'That record already exists.' } });
    return;
  }
  // Mongoose cast/validation errors
  if (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'CastError') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed identifier.' } });
    return;
  }
  if (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'ValidationError') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid data.' } });
    return;
  }
  // body-parser JSON syntax error
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Request body is not valid JSON.' } });
    return;
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } });
}
