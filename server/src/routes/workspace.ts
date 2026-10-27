import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Draft, WORKSPACE_LANGUAGES } from '../models/Draft.ts';
import { asyncHandler, getValidated, requireAuth, validate } from '../middleware/index.ts';
import { executeCode, executionConfigured } from '../services/execution.ts';
import { loadEnv } from '../config/env.ts';

export const workspaceRouter = Router();
workspaceRouter.use(requireAuth);

const env = loadEnv();
const runLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isTest ? 1000 : 10,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anon',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'You can run code about 10 times a minute.' } },
});

/** GET /api/workspace/status — tells the client whether execution is available. */
workspaceRouter.get('/status', (_req, res) => {
  res.json({ executionConfigured: executionConfigured(), languages: WORKSPACE_LANGUAGES });
});

const draftQuery = z.object({
  problemKey: z.string().trim().max(60).default(''),
  language: z.enum(WORKSPACE_LANGUAGES),
});

workspaceRouter.get(
  '/drafts',
  validate(draftQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = getValidated<z.infer<typeof draftQuery>>(req);
    const draft = await Draft.findOne({ userId: new Types.ObjectId(req.user!.id), problemKey: q.problemKey, language: q.language }).lean();
    res.json({ draft: draft ? { code: draft.code, stdin: draft.stdin, updatedAt: draft.updatedAt } : null });
  }),
);

const draftBody = draftQuery.extend({
  code: z.string().max(100000),
  stdin: z.string().max(20000).default(''),
});

workspaceRouter.put(
  '/drafts',
  validate(draftBody),
  asyncHandler(async (req, res) => {
    const body = getValidated<z.infer<typeof draftBody>>(req);
    const userId = new Types.ObjectId(req.user!.id);
    const draft = await Draft.findOneAndUpdate(
      { userId, problemKey: body.problemKey, language: body.language },
      { $set: { code: body.code, stdin: body.stdin }, $setOnInsert: { userId, problemKey: body.problemKey, language: body.language } },
      { upsert: true, new: true },
    ).lean();
    res.json({ draft: { code: draft!.code, stdin: draft!.stdin, updatedAt: draft!.updatedAt } });
  }),
);

const runBody = z.object({
  language: z.enum(WORKSPACE_LANGUAGES, { errorMap: () => ({ message: 'Unsupported language. Choose C++, Java or Python.' }) }),
  code: z.string().min(1, 'Write some code first.').max(100000),
  stdin: z.string().max(20000).default(''),
  expectedOutput: z.string().max(20000).optional(),
});

workspaceRouter.post(
  '/run',
  runLimiter,
  validate(runBody),
  asyncHandler(async (req, res) => {
    const body = getValidated<z.infer<typeof runBody>>(req);
    const result = await executeCode({ language: body.language, code: body.code, stdin: body.stdin, expectedOutput: body.expectedOutput ?? null });
    res.json({ result, disclaimer: 'Local runs use your own input; they are not an official platform verdict.' });
  }),
);
