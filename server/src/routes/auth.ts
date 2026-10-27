import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User, publicUser } from '../models/User.ts';
import { AppError } from '../lib/errors.ts';
import { AUTH_COOKIE, hashPassword, passwordProblem, sessionCookieOptions, signSession, verifyPassword } from '../lib/auth.ts';
import { asyncHandler, getValidated, requireAuth, validate } from '../middleware/index.ts';
import { loadEnv } from '../config/env.ts';

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string(),
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters.').max(60),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const updateSchema = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  theme: z.enum(['after-dark', 'dreamscape', 'daylight']).optional(),
  learningGoals: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
});

export const authRouter = Router();

const env = loadEnv();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' } },
});

authRouter.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, displayName } = getValidated<z.infer<typeof registerSchema>>(req);
    const problem = passwordProblem(password);
    if (problem) throw AppError.badRequest(problem);

    const existing = await User.findOne({ email }).lean();
    if (existing) throw AppError.conflict('An account with that email already exists. Try signing in instead.');

    const passwordHash = await hashPassword(password);
    const user = await User.create({ email, passwordHash, displayName });
    const token = signSession({ sub: user._id.toString(), email: user.email });
    res.cookie(AUTH_COOKIE, token, sessionCookieOptions());
    res.status(201).json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = getValidated<z.infer<typeof loginSchema>>(req);
    const user = await User.findOne({ email });
    // Same message for unknown email and wrong password to avoid account enumeration.
    const invalid = AppError.unauthorized('Email or password is incorrect.');
    if (!user) throw invalid;
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw invalid;
    const token = signSession({ sub: user._id.toString(), email: user.email });
    res.cookie(AUTH_COOKIE, token, sessionCookieOptions());
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
  res.status(204).end();
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) {
      res.clearCookie(AUTH_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
      throw AppError.unauthorized('Your account could not be found. Please sign in again.');
    }
    res.json({ user: publicUser(user) });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const updates = getValidated<z.infer<typeof updateSchema>>(req);
    const user = await User.findByIdAndUpdate(req.user!.id, { $set: updates }, { new: true });
    if (!user) throw AppError.unauthorized();
    res.json({ user: publicUser(user) });
  }),
);
