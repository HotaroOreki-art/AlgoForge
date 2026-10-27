import type { Verdict } from '../models/Submission.ts';

/**
 * Pure statistics over a user's imported submissions.
 *
 * Terminology used in the UI:
 *  - "observed": raw facts imported from the platform (submissions, verdicts).
 *  - "computed": aggregates derived here.
 *  - "inferred": suggestions produced by the recommendation engine.
 */

export interface StatSubmission {
  platformSubmissionId: number;
  problemKey: string;
  problemName: string;
  problemRating?: number | null;
  tags: string[];
  verdict: Verdict | string;
  language?: string | null;
  submittedAt: Date;
}

export interface TagStat {
  tag: string;
  solved: number;
  attempted: number; // unique problems attempted (any verdict)
  submissions: number;
  failedAttempts: number; // non-OK submissions
  /** Share of attempted problems in this tag that were eventually solved. */
  solveRate: number | null;
  lastPracticedAt: Date | null;
}

export interface RatingBucket {
  rating: number; // bucket lower bound, e.g. 800, 900 ... ; -1 = unrated
  solved: number;
  attempted: number;
}

export interface ActivityPoint {
  week: string; // ISO date of Monday
  submissions: number;
  solved: number;
}

export interface VerdictStat {
  verdict: string;
  count: number;
  share: number;
}

export interface SubmissionStats {
  totalSubmissions: number;
  uniqueProblemsAttempted: number;
  uniqueProblemsSolved: number;
  acceptanceRate: number | null;
  /** Problems with ≥1 non-OK submission before the first OK. */
  solvedAfterStruggle: number;
  /** Problems attempted but never solved. */
  unsolvedAttempts: number;
  avgSolvedRating: number | null;
  maxSolvedRating: number | null;
  firstSubmissionAt: Date | null;
  lastSubmissionAt: Date | null;
  activeDays: number;
  currentStreakDays: number;
  longestStreakDays: number;
  verdicts: VerdictStat[];
  tags: TagStat[];
  ratingBuckets: RatingBucket[];
  weeklyActivity: ActivityPoint[];
  languages: { language: string; count: number }[];
  /** Number of submissions with no published rating — distinguishes "unknown" from 0. */
  unratedSubmissions: number;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mondayOf(d: Date): string {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = copy.getUTCDay(); // 0 = Sunday
  const diff = (day + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy.toISOString().slice(0, 10);
}

export function ratingBucketOf(rating: number | null | undefined): number {
  if (rating === null || rating === undefined || rating <= 0) return -1;
  return Math.floor(rating / 100) * 100;
}

export function computeStreaks(days: Set<string>, today: Date = new Date()): { current: number; longest: number } {
  if (days.size === 0) return { current: 0, longest: 0 };
  const sorted = [...days].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(sorted[i - 1]!);
    const cur = new Date(sorted[i]!);
    const gap = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    if (gap === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  // Current streak: count back from today (or yesterday, to be forgiving about timezone).
  let current = 0;
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (!days.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.has(dayKey(cursor))) {
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return { current, longest };
}

export function computeStats(subs: StatSubmission[], now: Date = new Date()): SubmissionStats {
  const byProblem = new Map<
    string,
    { solved: boolean; failedBeforeSolve: number; failed: number; rating: number | null; tags: string[]; last: Date; firstOkAt: Date | null }
  >();
  const verdictCounts = new Map<string, number>();
  const langCounts = new Map<string, number>();
  const days = new Set<string>();
  const weeks = new Map<string, ActivityPoint>();
  let first: Date | null = null;
  let last: Date | null = null;
  let unrated = 0;

  // Process oldest → newest so "failed before solve" is meaningful.
  const ordered = [...subs].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

  for (const s of ordered) {
    const at = s.submittedAt;
    if (!first || at < first) first = at;
    if (!last || at > last) last = at;
    days.add(dayKey(at));
    if (s.problemRating === null || s.problemRating === undefined) unrated += 1;

    verdictCounts.set(s.verdict, (verdictCounts.get(s.verdict) ?? 0) + 1);
    if (s.language) langCounts.set(s.language, (langCounts.get(s.language) ?? 0) + 1);

    const wk = mondayOf(at);
    const point = weeks.get(wk) ?? { week: wk, submissions: 0, solved: 0 };
    point.submissions += 1;

    const entry = byProblem.get(s.problemKey) ?? {
      solved: false,
      failedBeforeSolve: 0,
      failed: 0,
      rating: s.problemRating ?? null,
      tags: s.tags,
      last: at,
      firstOkAt: null,
    };
    if (s.verdict === 'OK') {
      if (!entry.solved) {
        entry.solved = true;
        entry.firstOkAt = at;
        point.solved += 1;
      }
    } else if (s.verdict !== 'TESTING' && s.verdict !== 'SKIPPED') {
      entry.failed += 1;
      if (!entry.solved) entry.failedBeforeSolve += 1;
    }
    if (at > entry.last) entry.last = at;
    if (entry.rating === null && s.problemRating) entry.rating = s.problemRating;
    byProblem.set(s.problemKey, entry);
    weeks.set(wk, point);
  }

  const problems = [...byProblem.values()];
  const solvedProblems = problems.filter((p) => p.solved);
  const ratedSolved = solvedProblems.filter((p) => p.rating !== null) as { rating: number }[];

  // Tags
  const tagMap = new Map<string, TagStat>();
  for (const p of problems) {
    for (const tag of p.tags) {
      const t = tagMap.get(tag) ?? { tag, solved: 0, attempted: 0, submissions: 0, failedAttempts: 0, solveRate: null, lastPracticedAt: null };
      t.attempted += 1;
      if (p.solved) t.solved += 1;
      t.failedAttempts += p.failed;
      t.submissions += p.failed + (p.solved ? 1 : 0);
      if (!t.lastPracticedAt || p.last > t.lastPracticedAt) t.lastPracticedAt = p.last;
      tagMap.set(tag, t);
    }
  }
  const tags = [...tagMap.values()]
    .map((t) => ({ ...t, solveRate: t.attempted > 0 ? t.solved / t.attempted : null }))
    .sort((a, b) => b.solved - a.solved || b.attempted - a.attempted || a.tag.localeCompare(b.tag));

  // Rating buckets
  const bucketMap = new Map<number, RatingBucket>();
  for (const p of problems) {
    const b = ratingBucketOf(p.rating);
    const bucket = bucketMap.get(b) ?? { rating: b, solved: 0, attempted: 0 };
    bucket.attempted += 1;
    if (p.solved) bucket.solved += 1;
    bucketMap.set(b, bucket);
  }
  const ratingBuckets = [...bucketMap.values()].sort((a, b) => a.rating - b.rating);

  const totalSubmissions = subs.length;
  const okCount = verdictCounts.get('OK') ?? 0;
  const verdicts = [...verdictCounts.entries()]
    .map(([verdict, count]) => ({ verdict, count, share: totalSubmissions ? count / totalSubmissions : 0 }))
    .sort((a, b) => b.count - a.count);

  const streaks = computeStreaks(days, now);

  return {
    totalSubmissions,
    uniqueProblemsAttempted: problems.length,
    uniqueProblemsSolved: solvedProblems.length,
    acceptanceRate: totalSubmissions ? okCount / totalSubmissions : null,
    solvedAfterStruggle: solvedProblems.filter((p) => p.failedBeforeSolve > 0).length,
    unsolvedAttempts: problems.length - solvedProblems.length,
    avgSolvedRating: ratedSolved.length ? Math.round(ratedSolved.reduce((a, p) => a + p.rating, 0) / ratedSolved.length) : null,
    maxSolvedRating: ratedSolved.length ? Math.max(...ratedSolved.map((p) => p.rating)) : null,
    firstSubmissionAt: first,
    lastSubmissionAt: last,
    activeDays: days.size,
    currentStreakDays: streaks.current,
    longestStreakDays: streaks.longest,
    verdicts,
    tags,
    ratingBuckets,
    weeklyActivity: [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)),
    languages: [...langCounts.entries()]
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count),
    unratedSubmissions: unrated,
  };
}

/**
 * Identify topics that *might* benefit from more practice. This is a signal,
 * not a judgement: a topic with few attempts is "unexplored", one with many
 * failed attempts relative to solves is "friction". Never labels a user weak.
 */
export interface PracticeSignal {
  tag: string;
  kind: 'friction' | 'unexplored' | 'stale';
  reason: string;
  solved: number;
  attempted: number;
}

export function practiceSignals(stats: SubmissionStats, knownTags: string[], now: Date = new Date()): PracticeSignal[] {
  const signals: PracticeSignal[] = [];
  const byTag = new Map(stats.tags.map((t) => [t.tag, t]));
  const STALE_DAYS = 45;

  for (const t of stats.tags) {
    if (t.attempted >= 3 && t.solveRate !== null && t.solveRate < 0.6) {
      signals.push({
        tag: t.tag,
        kind: 'friction',
        reason: `You solved ${t.solved} of ${t.attempted} attempted ${t.tag} problems — some friction worth revisiting.`,
        solved: t.solved,
        attempted: t.attempted,
      });
    } else if (t.lastPracticedAt && t.solved >= 2 && (now.getTime() - t.lastPracticedAt.getTime()) / 86_400_000 > STALE_DAYS) {
      const daysAgo = Math.round((now.getTime() - t.lastPracticedAt.getTime()) / 86_400_000);
      signals.push({
        tag: t.tag,
        kind: 'stale',
        reason: `Last ${t.tag} problem was ${daysAgo} days ago — a refresher keeps it sharp.`,
        solved: t.solved,
        attempted: t.attempted,
      });
    }
  }

  for (const tag of knownTags) {
    if (!byTag.has(tag)) {
      signals.push({ tag, kind: 'unexplored', reason: `No imported ${tag} problems yet — unexplored territory.`, solved: 0, attempted: 0 });
    }
  }

  const order = { friction: 0, stale: 1, unexplored: 2 };
  return signals.sort((a, b) => order[a.kind] - order[b.kind] || b.attempted - a.attempted).slice(0, 12);
}
