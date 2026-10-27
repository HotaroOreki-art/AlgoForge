import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Types } from 'mongoose';
import { z } from 'zod';
import { PlatformConnection } from '../models/PlatformConnection.ts';
import { Submission } from '../models/Submission.ts';
import { SyncRun } from '../models/SyncRun.ts';
import { AppError } from '../lib/errors.ts';
import { asyncHandler, getValidated, requireAuth, validate } from '../middleware/index.ts';
import { syncCodeforces } from '../services/codeforces/sync.ts';
import type { CodeforcesClient } from '../services/codeforces/client.ts';
import { loadEnv } from '../config/env.ts';

export const platformsRouter = Router();
platformsRouter.use(requireAuth);

const env = loadEnv();
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isTest ? 1000 : 4,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anon',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Sync can run a few times per minute. Please wait a moment.' } },
});

const connectSchema = z.object({
  handle: z.string().trim().min(3, 'Handle is too short.').max(24, 'Handle is too long.'),
});

function serializeConnection(c: InstanceType<typeof PlatformConnection> | null) {
  if (!c) return null;
  return {
    platform: c.platform,
    handle: c.handle,
    profile: c.profile ?? null,
    ratingHistory: c.ratingHistory ?? [],
    lastSyncStatus: c.lastSyncStatus,
    lastSyncError: c.lastSyncError ?? null,
    lastSyncStartedAt: c.lastSyncStartedAt ?? null,
    lastSuccessfulSyncAt: c.lastSuccessfulSyncAt ?? null,
    submissionCount: c.submissionCount ?? 0,
  };
}

/** GET /api/platforms — all connections for the current user. */
platformsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const connections = await PlatformConnection.find({ userId: req.user!.id });
    res.json({ connections: connections.map((c) => serializeConnection(c)) });
  }),
);

/** POST /api/platforms/codeforces/sync — connect (or re-sync) a Codeforces handle. */
platformsRouter.post(
  '/codeforces/sync',
  syncLimiter,
  validate(connectSchema.partial()),
  asyncHandler(async (req, res) => {
    const { handle } = getValidated<Partial<z.infer<typeof connectSchema>>>(req);
    let target = handle;
    if (!target) {
      const existing = await PlatformConnection.findOne({ userId: req.user!.id, platform: 'codeforces' });
      if (!existing) throw AppError.badRequest('Enter a Codeforces handle to connect.');
      target = existing.handle;
    }
    const client = req.app.locals.codeforcesClient as CodeforcesClient | undefined;
    const result = await syncCodeforces(req.user!.id, target, client);
    const connection = await PlatformConnection.findOne({ userId: req.user!.id, platform: 'codeforces' });
    res.json({ result, connection: serializeConnection(connection) });
  }),
);

/** GET /api/platforms/codeforces — the current connection with recent sync runs. */
platformsRouter.get(
  '/codeforces',
  asyncHandler(async (req, res) => {
    const connection = await PlatformConnection.findOne({ userId: req.user!.id, platform: 'codeforces' });
    const runs = await SyncRun.find({ userId: req.user!.id, platform: 'codeforces' }).sort({ startedAt: -1 }).limit(10).lean();
    res.json({ connection: serializeConnection(connection), runs });
  }),
);

/** DELETE /api/platforms/codeforces — disconnect and remove imported history. */
platformsRouter.delete(
  '/codeforces',
  asyncHandler(async (req, res) => {
    const uid = new Types.ObjectId(req.user!.id);
    await Promise.all([
      PlatformConnection.deleteOne({ userId: uid, platform: 'codeforces' }),
      Submission.deleteMany({ userId: uid, platform: 'codeforces' }),
      SyncRun.deleteMany({ userId: uid, platform: 'codeforces' }),
    ]);
    res.status(204).end();
  }),
);
