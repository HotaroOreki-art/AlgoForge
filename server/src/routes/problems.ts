import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Types, type FilterQuery } from 'mongoose';
import { z } from 'zod';
import { Problem, type ProblemAttrs } from '../models/Problem.ts';
import { SavedProblem, PRACTICE_STATUSES } from '../models/SavedProblem.ts';
import { Submission } from '../models/Submission.ts';
import { Note } from '../models/Note.ts';
import { AppError } from '../lib/errors.ts';
import { asyncHandler, getValidated, requireAuth, validate } from '../middleware/index.ts';
import { refreshProblemCatalogue } from '../services/codeforces/sync.ts';
import type { CodeforcesClient } from '../services/codeforces/client.ts';
import { loadEnv } from '../config/env.ts';

export const problemsRouter = Router();
problemsRouter.use(requireAuth);

const env = loadEnv();
const catalogueLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: env.isTest ? 1000 : 2,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'The catalogue was refreshed recently. Try again later.' } },
});

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  tags: z.string().trim().optional(), // comma separated
  minRating: z.coerce.number().int().min(0).max(4000).optional(),
  maxRating: z.coerce.number().int().min(0).max(4000).optional(),
  platform: z.enum(['codeforces']).optional(),
  saved: z.enum(['true', 'false']).optional(),
  status: z.enum(PRACTICE_STATUSES).optional(),
  revision: z.enum(['true', 'false']).optional(),
  solved: z.enum(['true', 'false']).optional(), // based on imported submissions
  sort: z.enum(['rating', '-rating', 'name', 'popular', 'recent']).default('popular'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

type ListQuery = z.infer<typeof listQuery>;

async function userProblemState(userId: Types.ObjectId, keys: string[]) {
  const [saved, solvedAgg, attemptedAgg, notes] = await Promise.all([
    SavedProblem.find({ userId, problemKey: { $in: keys } }).lean(),
    Submission.distinct('problemKey', { userId, problemKey: { $in: keys }, verdict: 'OK' }),
    Submission.distinct('problemKey', { userId, problemKey: { $in: keys } }),
    Note.aggregate<{ _id: string; count: number }>([
      { $match: { userId, problemKeys: { $in: keys } } },
      { $unwind: '$problemKeys' },
      { $match: { problemKeys: { $in: keys } } },
      { $group: { _id: '$problemKeys', count: { $sum: 1 } } },
    ]),
  ]);
  const savedMap = new Map(saved.map((s) => [s.problemKey, s]));
  const solvedSet = new Set(solvedAgg as string[]);
  const attemptedSet = new Set(attemptedAgg as string[]);
  const noteMap = new Map(notes.map((n) => [n._id, n.count]));
  return { savedMap, solvedSet, attemptedSet, noteMap };
}

function serializeProblem(
  p: ProblemAttrs & { _id?: unknown },
  state: Awaited<ReturnType<typeof userProblemState>>,
) {
  const saved = state.savedMap.get(p.key);
  return {
    key: p.key,
    platform: p.platform,
    platformId: p.platformId,
    contestId: p.contestId ?? null,
    index: p.index ?? null,
    name: p.name,
    rating: p.rating ?? null,
    tags: p.tags,
    url: p.url,
    solvedCount: p.solvedCount ?? null,
    user: {
      saved: Boolean(saved),
      bookmarked: saved?.bookmarked ?? false,
      markedForRevision: saved?.markedForRevision ?? false,
      status: saved?.status ?? (state.solvedSet.has(p.key) ? 'solved' : state.attemptedSet.has(p.key) ? 'attempting' : null),
      personalTags: saved?.personalTags ?? [],
      solvedOnPlatform: state.solvedSet.has(p.key),
      attemptedOnPlatform: state.attemptedSet.has(p.key),
      notes: state.noteMap.get(p.key) ?? 0,
    },
  };
}

/** GET /api/problems — search the catalogue, enriched with the user's state. */
problemsRouter.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = getValidated<ListQuery>(req);
    const userId = new Types.ObjectId(req.user!.id);
    const filter: FilterQuery<ProblemAttrs> = {};

    if (q.platform) filter.platform = q.platform;
    if (q.q) {
      const escaped = q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { platformId: { $regex: `^${escaped}`, $options: 'i' } }];
    }
    if (q.tags) {
      const tags = q.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (tags.length) filter.tags = { $all: tags };
    }
    if (q.minRating !== undefined || q.maxRating !== undefined) {
      filter.rating = {};
      if (q.minRating !== undefined) filter.rating.$gte = q.minRating;
      if (q.maxRating !== undefined) filter.rating.$lte = q.maxRating;
    }

    // User-scoped filters narrow the key set first.
    let keyRestriction: string[] | null = null;
    if (q.saved === 'true' || q.status || q.revision === 'true') {
      const sf: FilterQuery<unknown> = { userId };
      if (q.status) sf.status = q.status;
      if (q.revision === 'true') sf.markedForRevision = true;
      const saved = await SavedProblem.find(sf).select('problemKey').lean();
      keyRestriction = saved.map((s) => s.problemKey);
    }
    if (q.solved) {
      const solvedKeys = await Submission.distinct('problemKey', { userId, verdict: 'OK' });
      if (q.solved === 'true') {
        keyRestriction = keyRestriction ? keyRestriction.filter((k) => solvedKeys.includes(k)) : (solvedKeys as string[]);
      } else {
        filter.key = { $nin: solvedKeys };
      }
    }
    if (keyRestriction) {
      filter.key = filter.key ? { ...filter.key, $in: keyRestriction } : { $in: keyRestriction };
    }

    const sort: Record<string, 1 | -1> =
      q.sort === 'rating'
        ? { rating: 1, solvedCount: -1 }
        : q.sort === '-rating'
          ? { rating: -1, solvedCount: -1 }
          : q.sort === 'name'
            ? { name: 1 }
            : q.sort === 'recent'
              ? { contestId: -1, index: 1 }
              : { solvedCount: -1, rating: 1 };

    const [total, docs] = await Promise.all([
      Problem.countDocuments(filter),
      Problem.find(filter)
        .sort(sort)
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
    ]);
    const state = await userProblemState(
      userId,
      docs.map((d) => d.key),
    );
    res.json({
      total,
      page: q.page,
      limit: q.limit,
      problems: docs.map((d) => serializeProblem(d, state)),
    });
  }),
);

/** GET /api/problems/tags — distinct tags with counts (for filters). */
problemsRouter.get(
  '/tags',
  asyncHandler(async (_req, res) => {
    const tags = await Problem.aggregate<{ _id: string; count: number }>([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ tags: tags.map((t) => ({ tag: t._id, count: t.count })) });
  }),
);

/** GET /api/problems/catalogue — catalogue status. */
problemsRouter.get(
  '/catalogue',
  asyncHandler(async (_req, res) => {
    const [total, latest] = await Promise.all([Problem.countDocuments(), Problem.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean()]);
    res.json({ total, lastUpdatedAt: latest?.updatedAt ?? null });
  }),
);

/** POST /api/problems/catalogue/refresh — pull the public Codeforces problemset. */
problemsRouter.post(
  '/catalogue/refresh',
  catalogueLimiter,
  asyncHandler(async (req, res) => {
    const client = req.app.locals.codeforcesClient as CodeforcesClient | undefined;
    const result = await refreshProblemCatalogue(client);
    res.json(result);
  }),
);

const keyParam = z.object({ key: z.string().regex(/^codeforces:[A-Za-z0-9]+$/, 'Invalid problem key.') });

/** GET /api/problems/:key — details + the user's submissions and notes for it. */
problemsRouter.get(
  '/:key',
  validate(keyParam, 'params'),
  asyncHandler(async (req, res) => {
    const { key } = getValidated<z.infer<typeof keyParam>>(req);
    const userId = new Types.ObjectId(req.user!.id);
    const problem = await Problem.findOne({ key }).lean();
    if (!problem) throw AppError.notFound('That problem is not in your catalogue yet.');
    const [state, submissions, notes] = await Promise.all([
      userProblemState(userId, [key]),
      Submission.find({ userId, problemKey: key }).sort({ submittedAt: -1 }).limit(50).lean(),
      Note.find({ userId, problemKeys: key }).select('title kind updatedAt').sort({ updatedAt: -1 }).lean(),
    ]);
    res.json({
      problem: serializeProblem(problem, state),
      submissions: submissions.map((s) => ({
        id: s.platformSubmissionId,
        verdict: s.verdict,
        language: s.language ?? null,
        submittedAt: s.submittedAt,
        passedTestCount: s.passedTestCount ?? null,
        timeMs: s.timeMs ?? null,
      })),
      notes: notes.map((n) => ({ id: n._id.toString(), title: n.title, kind: n.kind, updatedAt: n.updatedAt })),
    });
  }),
);

const saveBody = z.object({
  bookmarked: z.boolean().optional(),
  markedForRevision: z.boolean().optional(),
  status: z.enum(PRACTICE_STATUSES).optional(),
  personalTags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

/** PUT /api/problems/:key/save — create/update the user's saved record. Idempotent. */
problemsRouter.put(
  '/:key/save',
  validate(keyParam, 'params'),
  validate(saveBody),
  asyncHandler(async (req, res) => {
    const { key } = req.params as { key: string };
    const body = getValidated<z.infer<typeof saveBody>>(req);
    const userId = new Types.ObjectId(req.user!.id);
    const problem = await Problem.findOne({ key }).lean();
    if (!problem) throw AppError.notFound('That problem is not in the catalogue.');
    const saved = await SavedProblem.findOneAndUpdate(
      { userId, problemKey: key },
      { $set: { ...body }, $setOnInsert: { userId, problemKey: key } },
      { upsert: true, new: true },
    );
    const state = await userProblemState(userId, [key]);
    res.json({ problem: serializeProblem(problem, state), saved: { id: saved._id.toString(), ...body } });
  }),
);

/** DELETE /api/problems/:key/save — remove from the user's library. */
problemsRouter.delete(
  '/:key/save',
  validate(keyParam, 'params'),
  asyncHandler(async (req, res) => {
    const { key } = req.params as { key: string };
    const userId = new Types.ObjectId(req.user!.id);
    await SavedProblem.deleteOne({ userId, problemKey: key });
    res.status(204).end();
  }),
);
