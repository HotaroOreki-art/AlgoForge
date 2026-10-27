import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loadEnv } from '../config/env.ts';

export const AUTH_COOKIE = 'af_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export interface SessionPayload {
  sub: string; // user id
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSession(payload: SessionPayload): string {
  const env = loadEnv();
  return jwt.sign(payload, env.jwtSecret, { expiresIn: SESSION_TTL_SECONDS, issuer: 'algoforge' });
}

export function verifySession(token: string): SessionPayload | null {
  const env = loadEnv();
  try {
    const decoded = jwt.verify(token, env.jwtSecret, { issuer: 'algoforge' });
    if (typeof decoded !== 'object' || decoded === null) return null;
    const { sub, email } = decoded as Record<string, unknown>;
    if (typeof sub !== 'string' || typeof email !== 'string') return null;
    return { sub, email };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  const env = loadEnv();
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}

/**
 * Password policy: at least 8 chars, must contain a letter and a digit.
 * Returned string is a user-facing reason, or null when acceptable.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password is too long.';
  if (!/[A-Za-z]/.test(password)) return 'Password must include at least one letter.';
  if (!/\d/.test(password)) return 'Password must include at least one number.';
  return null;
}
