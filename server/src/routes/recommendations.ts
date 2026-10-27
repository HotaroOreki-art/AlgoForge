import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Concept } from '../models/Concept.ts';
import { Problem } from '../models/Problem.ts';
import { Submission } from '../models/Submission.ts';
import { User } from '../models/User.ts';
import { asyncHandler, getValidated, requireAuth, validate } from '../middleware/index.ts';
import { computeStats, practiceSignals } from '../services/stats.ts';
import { estimateLevel, recommend, type CandidateProblem, type UserSignals } from '../services/recommendations.ts';
import { loadGraph } from '../services/graph/service.ts';

export const recommendationsRouter = Router();
recommendationsRouter.use(requireAuth);

const query = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(8),
  tags: z.string().trim().optional(),
  stretch: z.coerce.number().int().min(-300).max(600).optional(),
});

/**
 * GET /api/recommendations — builds UserSignals from stored data, pulls a
 * bounded candidate set from the catalogue, and ranks it deterministically.
 */
recommendationsRouter.get(
  '/',
  validate(query, 'query'),
  asyncHandler(async (req, res) => {
    const q = getValidated<z.infer<typeof query>>(req);
    const userId = new Types.ObjectId(req.user!.id);
    const focusTags = q.tags
      ? q.tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const [subs, user, concepts, graph, catalogueSize] = await Promise.all([
      Submission.find({ userId }).select('platformSubmissionId problemKey problemName problemRating tags verdict language submittedAt').lean(),
      User.findById(userId).lean(),
      Concept.find().lean(),
      loadGraph(),
      Problem.countDocuments(),
    ]);

    const missing: string[] = [];
    if (catalogueSize === 0) missing.push('catalogue');
    if (subs.length === 0) missing.push('history');

    const stats = computeStats(
      subs.map((s) => ({
        platformSubmissionId: s.platformSubmissionId,
        problemKey: s.problemKey,
        problemName: s.problemName,
        problemRating: s.problemRating ?? null,
        tags: s.tags,
        verdict: s.verdict,
        language: s.language ?? null,
        submittedAt: s.submittedAt,
      })),
    );
    const knownTags = [...new Set(concepts.flatMap((c) => c.codeforcesTags))];
    const signals = subs.length ? practiceSignals(stats, knownTags) : [];

    const solvedKeys = new Set<string>();
    const attemptedKeys = new Set<string>();
    const recentSolvedRatings: number[] = [];
    const sorted = [...subs].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
    for (const s of sorted) {
      attemptedKeys.add(s.problemKey);
      if (s.verdict === 'OK') {
        if (!solvedKeys.has(s.problemKey) && s.problemRating && recentSolvedRatings.length < 40) recentSolvedRatings.push(s.problemRating);
        solvedKeys.add(s.problemKey);
      }
    }
    const unsolvedAttemptKeys = new Set([...attemptedKeys].filter((k) => !solvedKeys.has(k)));
    const levelEstimate = estimateLevel(recentSolvedRatings);

    const recentCutoff = Date.now() - 30 * 86_400_000;
    const recentTags = new Set(stats.tags.filter((t) => t.lastPracticedAt && t.lastPracticedAt.getTime() > recentCutoff).map((t) => t.tag));

    // Goals: user's learningGoals are concept slugs (or free text matching concept names).
    const goalTags = new Map<string, string>();
    for (const goal of user?.learningGoals ?? []) {
      const c = concepts.find((x) => x.slug === goal || x.name.toLowerCase() === goal.toLowerCase());
      if (c) c.codeforcesTags.forEach((t) => goalTags.set(t, c.name));
      else goalTags.set(goal.toLowerCase(), goal);
    }

    // Frontier: concepts whose prerequisites are practised (≥3 solved) but which aren't yet.
    const practised = new Set<string>();
    for (const c of concepts) {
      const solvedInConcept = new Set<string>();
      for (const s of subs) if (s.verdict === 'OK' && s.tags.some((t) => c.codeforcesTags.includes(t))) solvedInConcept.add(s.problemKey);
      if (solvedInConcept.size >= 3) practised.add(c.slug);
    }
    const frontierTags = new Map<string, string>();
    for (const slug of graph.frontier(practised)) {
      const c = concepts.find((x) => x.slug === slug);
      c?.codeforcesTags.forEach((t) => frontierTags.set(t, c.name));
    }

    const userSignals: UserSignals = {
      solvedKeys,
      unsolvedAttemptKeys,
      levelEstimate,
      frictionTags: new Set(signals.filter((s) => s.kind === 'friction').map((s) => s.tag)),
      staleTags: new Set(signals.filter((s) => s.kind === 'stale').map((s) => s.tag)),
      recentTags,
      goalTags,
      frontierTags,
    };

    // Candidate set: bounded window around the user's level (or a sensible default band).
    const stretch = q.stretch ?? 150;
    const center = (levelEstimate ?? 1000) + stretch;
    const ratingFilter = { $gte: Math.max(800, center - 400), $lte: Math.min(3500, center + 400) };
    const candidateFilter: Record<string, unknown> = { rating: ratingFilter };
    if (focusTags.length) candidateFilter.tags = { $in: focusTags };
    const interestingTags = new Set([...userSignals.frictionTags, ...goalTags.keys(), ...frontierTags.keys(), ...recentTags, ...userSignals.staleTags]);
    if (!focusTags.length && interestingTags.size) candidateFilter.tags = { $in: [...interestingTags] };

    let candidates = await Problem.find(candidateFilter).sort({ solvedCount: -1 }).limit(600).lean();
    if (candidates.length < 50) {
      // Not enough tag-matched candidates — widen to the rating band without tag filter.
      candidates = await Problem.find({ rating: ratingFilter }).sort({ solvedCount: -1 }).limit(600).lean();
    }
    // Always include unsolved past attempts as candidates (comeback targets).
    if (unsolvedAttemptKeys.size) {
      const comeback = await Problem.find({ key: { $in: [...unsolvedAttemptKeys].slice(0, 200) } }).lean();
      const seen = new Set(candidates.map((c) => c.key));
      for (const c of comeback) if (!seen.has(c.key)) candidates.push(c);
    }

    const candidateProblems: CandidateProblem[] = candidates.map((p) => ({
      key: p.key,
      name: p.name,
      url: p.url,
      rating: p.rating ?? null,
      tags: p.tags,
      solvedCount: p.solvedCount ?? null,
    }));

    const recommendations = recommend(candidateProblems, userSignals, { limit: q.limit, stretch, focusTags });

    res.json({
      recommendations,
      context: {
        levelEstimate,
        stretch,
        candidateCount: candidateProblems.length,
        catalogueSize,
        solvedCount: solvedKeys.size,
        unsolvedAttempts: unsolvedAttemptKeys.size,
        frictionTags: [...userSignals.frictionTags],
        staleTags: [...userSignals.staleTags],
        recentTags: [...recentTags].slice(0, 10),
        goalTags: [...goalTags.entries()].map(([tag, goal]) => ({ tag, goal })),
        frontier: [...new Set(frontierTags.values())],
        focusTags,
        missing,
      },
    });
  }),
);
