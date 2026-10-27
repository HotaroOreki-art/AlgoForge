import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Concept } from '../models/Concept.ts';
import { Note } from '../models/Note.ts';
import { Problem } from '../models/Problem.ts';
import { Submission } from '../models/Submission.ts';
import { AppError } from '../lib/errors.ts';
import { asyncHandler, getValidated, requireAuth, validate } from '../middleware/index.ts';
import { loadGraph } from '../services/graph/service.ts';

export const graphRouter = Router();
graphRouter.use(requireAuth);

/** Per-concept evidence from the user's imported submissions. */
async function conceptEvidence(userId: Types.ObjectId, concepts: { slug: string; codeforcesTags: string[] }[]) {
  const agg = await Submission.aggregate<{ _id: string; solved: string[]; attempted: string[] }>([
    { $match: { userId } },
    { $unwind: '$tags' },
    {
      $group: {
        _id: '$tags',
        solved: { $addToSet: { $cond: [{ $eq: ['$verdict', 'OK'] }, '$problemKey', '$$REMOVE'] } },
        attempted: { $addToSet: '$problemKey' },
      },
    },
  ]);
  const byTag = new Map(agg.map((a) => [a._id, a]));
  const notes = await Note.aggregate<{ _id: string; count: number }>([
    { $match: { userId } },
    { $unwind: '$conceptSlugs' },
    { $group: { _id: '$conceptSlugs', count: { $sum: 1 } } },
  ]);
  const noteMap = new Map(notes.map((n) => [n._id, n.count]));

  const result = new Map<string, { solved: number; attempted: number; notes: number }>();
  for (const c of concepts) {
    const solved = new Set<string>();
    const attempted = new Set<string>();
    for (const tag of c.codeforcesTags) {
      const t = byTag.get(tag);
      if (!t) continue;
      t.solved.forEach((k) => solved.add(k));
      t.attempted.forEach((k) => attempted.add(k));
    }
    result.set(c.slug, { solved: solved.size, attempted: attempted.size, notes: noteMap.get(c.slug) ?? 0 });
  }
  return result;
}

/** GET /api/graph — the whole graph plus the user's evidence overlay. */
graphRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = new Types.ObjectId(req.user!.id);
    const [graph, concepts] = await Promise.all([loadGraph(), Concept.find().lean()]);
    const evidence = await conceptEvidence(userId, concepts);
    const practised = new Set([...evidence.entries()].filter(([, e]) => e.solved >= 3).map(([slug]) => slug));
    const frontier = graph.frontier(practised);

    res.json({
      nodes: concepts.map((c) => ({
        slug: c.slug,
        name: c.name,
        category: c.category,
        summary: c.summary,
        codeforcesTags: c.codeforcesTags,
        typicalRating: c.typicalRating ?? null,
        evidence: evidence.get(c.slug) ?? { solved: 0, attempted: 0, notes: 0 },
        practised: practised.has(c.slug),
        frontier: frontier.includes(c.slug),
      })),
      edges: graph.allEdges(),
      meaning: {
        prerequisite: 'A → B: understand A before B.',
        specializes: 'A → B: A is a specialised form of B.',
        'combines-with': 'A ↔ B: frequently used together in one solution.',
        'alternative-to': 'A ↔ B: solve a similar class of problems; choose by constraints.',
      },
    });
  }),
);

const slugParam = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) });

/** GET /api/graph/:slug — concept detail: neighbours, learning path, problems, notes. */
graphRouter.get(
  '/:slug',
  validate(slugParam, 'params'),
  asyncHandler(async (req, res) => {
    const { slug } = getValidated<z.infer<typeof slugParam>>(req);
    const userId = new Types.ObjectId(req.user!.id);
    const [graph, concept] = await Promise.all([loadGraph(), Concept.findOne({ slug }).lean()]);
    if (!concept || !graph.has(slug)) throw AppError.notFound('Unknown concept.');

    const nameOf = (s: string) => graph.node(s)?.name ?? s;
    const neighbours = graph.neighbours(slug).map((n) => ({
      slug: n.slug,
      name: nameOf(n.slug),
      category: graph.node(n.slug)?.category ?? 'unknown',
      direction: n.direction,
      type: n.edge.type,
      explanation: n.edge.explanation,
    }));
    const prerequisites = graph.prerequisites(slug).map((s) => ({ slug: s, name: nameOf(s) }));
    const unlocks = graph.unlocks(slug).map((s) => ({ slug: s, name: nameOf(s) }));

    const tags = concept.codeforcesTags;
    const [solvedKeys, attemptedKeys, notes, catalogue] = await Promise.all([
      Submission.distinct('problemKey', { userId, verdict: 'OK', tags: { $in: tags } }),
      Submission.distinct('problemKey', { userId, tags: { $in: tags } }),
      Note.find({ userId, conceptSlugs: slug }).select('title kind updatedAt coreIdea').sort({ updatedAt: -1 }).limit(20).lean(),
      tags.length
        ? Problem.find({ tags: { $in: tags }, rating: concept.typicalRating ? { $gte: concept.typicalRating.min ?? 0, $lte: concept.typicalRating.max ?? 4000 } : { $exists: true } })
            .sort({ solvedCount: -1 })
            .limit(40)
            .lean()
        : Promise.resolve([]),
    ]);
    const solved = new Set(solvedKeys as string[]);
    const attempted = new Set(attemptedKeys as string[]);

    const problems = catalogue
      .map((p) => ({
        key: p.key,
        name: p.name,
        rating: p.rating ?? null,
        tags: p.tags,
        url: p.url,
        solvedCount: p.solvedCount ?? null,
        solved: solved.has(p.key),
        attempted: attempted.has(p.key),
      }))
      // Show unsolved suggestions first, then solved ones as evidence.
      .sort((a, b) => Number(a.solved) - Number(b.solved))
      .slice(0, 12);

    res.json({
      concept: {
        slug: concept.slug,
        name: concept.name,
        category: concept.category,
        summary: concept.summary,
        description: concept.description,
        whenToUse: concept.whenToUse,
        codeforcesTags: concept.codeforcesTags,
        typicalRating: concept.typicalRating ?? null,
      },
      neighbours,
      prerequisites,
      unlocks,
      evidence: { solved: solved.size, attempted: attempted.size },
      problems,
      notes: notes.map((n) => ({ id: n._id.toString(), title: n.title, kind: n.kind, coreIdea: n.coreIdea, updatedAt: n.updatedAt })),
    });
  }),
);
