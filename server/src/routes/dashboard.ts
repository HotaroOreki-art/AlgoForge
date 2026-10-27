import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Submission } from '../models/Submission.ts';
import { PlatformConnection } from '../models/PlatformConnection.ts';
import { Note } from '../models/Note.ts';
import { SavedProblem } from '../models/SavedProblem.ts';
import { asyncHandler, getValidated, requireAuth, validate } from '../middleware/index.ts';
import { computeStats, practiceSignals, type StatSubmission } from '../services/stats.ts';
import { Concept } from '../models/Concept.ts';
import { rewriteCodeforcesAvatarUrl, urlFromProblemKey } from '../services/codeforces/normalize.ts';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

async function loadUserSubmissions(userId: string): Promise<StatSubmission[]> {
  const docs = await Submission.find({ userId: new Types.ObjectId(userId) })
    .select('platformSubmissionId problemKey problemName problemRating tags verdict language submittedAt')
    .lean();
  return docs.map((d) => ({
    platformSubmissionId: d.platformSubmissionId,
    problemKey: d.problemKey,
    problemName: d.problemName,
    problemRating: d.problemRating ?? null,
    tags: d.tags,
    verdict: d.verdict,
    language: d.language ?? null,
    submittedAt: d.submittedAt,
  }));
}

/** GET /api/dashboard — the full analytics payload for the current user. */
dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const [subs, connection, noteCount, savedCount, concepts] = await Promise.all([
      loadUserSubmissions(userId),
      PlatformConnection.findOne({ userId: new Types.ObjectId(userId), platform: 'codeforces' }).lean(),
      Note.countDocuments({ userId }),
      SavedProblem.countDocuments({ userId }),
      Concept.find().select('codeforcesTags').lean(),
    ]);

    const stats = computeStats(subs);
    const knownTags = [...new Set(concepts.flatMap((c) => c.codeforcesTags))];
    const signals = subs.length ? practiceSignals(stats, knownTags) : [];

    // Recent problems: latest 12 unique problems touched.
    const seen = new Set<string>();
    const recent: { problemKey: string; problemName: string; rating: number | null; verdict: string; at: Date; tags: string[] }[] = [];
    for (const s of [...subs].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())) {
      if (seen.has(s.problemKey)) continue;
      seen.add(s.problemKey);
      recent.push({ problemKey: s.problemKey, problemName: s.problemName, rating: s.problemRating ?? null, verdict: s.verdict, at: s.submittedAt, tags: s.tags });
      if (recent.length >= 12) break;
    }

    res.json({
      hasData: subs.length > 0,
      connection: connection
        ? {
            handle: connection.handle,
            profile: connection.profile
              ? {
                  rating: connection.profile.rating,
                  maxRating: connection.profile.maxRating,
                  rank: connection.profile.rank,
                  maxRank: connection.profile.maxRank,
                  avatar: rewriteCodeforcesAvatarUrl(connection.profile.avatar),
                  country: connection.profile.country,
                  organization: connection.profile.organization,
                  friendOfCount: connection.profile.friendOfCount,
                  contribution: connection.profile.contribution,
                  registrationTime: connection.profile.registrationTime,
                }
              : null,
            ratingHistory: connection.ratingHistory ?? [],
            lastSyncStatus: connection.lastSyncStatus,
            lastSyncError: connection.lastSyncError ?? null,
            lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt ?? null,
          }
        : null,
      stats,
      signals,
      recent,
      counts: { notes: noteCount, saved: savedCount },
    });
  }),
);

const topicQuery = z.object({ tag: z.string().trim().min(1).max(60) });

/** GET /api/dashboard/topic?tag=dp — drill-down: problems & history for one tag. */
dashboardRouter.get(
  '/topic',
  validate(topicQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { tag } = getValidated<z.infer<typeof topicQuery>>(req);
    const subs = await Submission.find({ userId: new Types.ObjectId(req.user!.id), tags: tag.toLowerCase() })
      .sort({ submittedAt: -1 })
      .lean();

    const byProblem = new Map<
      string,
      { problemKey: string; problemName: string; url: string; rating: number | null; tags: string[]; solved: boolean; attempts: number; lastAt: Date; verdicts: string[] }
    >();
    for (const s of subs) {
      const p = byProblem.get(s.problemKey) ?? {
        problemKey: s.problemKey,
        problemName: s.problemName,
        url: urlFromProblemKey(s.problemKey),
        rating: s.problemRating ?? null,
        tags: s.tags,
        solved: false,
        attempts: 0,
        lastAt: s.submittedAt,
        verdicts: [],
      };
      p.attempts += 1;
      if (s.verdict === 'OK') p.solved = true;
      p.verdicts.push(s.verdict);
      if (s.submittedAt > p.lastAt) p.lastAt = s.submittedAt;
      byProblem.set(s.problemKey, p);
    }
    const problems = [...byProblem.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
    res.json({
      tag,
      totalSubmissions: subs.length,
      problems,
      solved: problems.filter((p) => p.solved).length,
      attempted: problems.length,
    });
  }),
);
