import { describe, expect, it } from 'vitest';
import { computeStats, computeStreaks, practiceSignals, ratingBucketOf, type StatSubmission } from '../../src/services/stats.ts';

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n, 12));

function sub(partial: Partial<StatSubmission> & { id: number }): StatSubmission {
  return {
    platformSubmissionId: partial.id,
    problemKey: partial.problemKey ?? `codeforces:${partial.id}A`,
    problemName: partial.problemName ?? `P${partial.id}`,
    problemRating: partial.problemRating ?? null,
    tags: partial.tags ?? [],
    verdict: partial.verdict ?? 'OK',
    language: partial.language ?? 'C++17',
    submittedAt: partial.submittedAt ?? day(0),
  };
}

describe('computeStats', () => {
  it('returns an empty, honest shape for no submissions', () => {
    const s = computeStats([]);
    expect(s.totalSubmissions).toBe(0);
    expect(s.uniqueProblemsSolved).toBe(0);
    expect(s.acceptanceRate).toBeNull();
    expect(s.avgSolvedRating).toBeNull();
    expect(s.tags).toEqual([]);
    expect(s.firstSubmissionAt).toBeNull();
  });

  it('counts unique solved problems, not accepted submissions', () => {
    const s = computeStats([
      sub({ id: 1, problemKey: 'codeforces:1A', verdict: 'OK' }),
      sub({ id: 2, problemKey: 'codeforces:1A', verdict: 'OK' }), // resubmitted
      sub({ id: 3, problemKey: 'codeforces:2B', verdict: 'WRONG_ANSWER' }),
    ]);
    expect(s.totalSubmissions).toBe(3);
    expect(s.uniqueProblemsAttempted).toBe(2);
    expect(s.uniqueProblemsSolved).toBe(1);
    expect(s.unsolvedAttempts).toBe(1);
    expect(s.acceptanceRate).toBeCloseTo(2 / 3);
  });

  it('tracks struggle (failed attempts before first OK) per problem', () => {
    const s = computeStats([
      sub({ id: 1, problemKey: 'codeforces:1A', verdict: 'WRONG_ANSWER', submittedAt: day(0) }),
      sub({ id: 2, problemKey: 'codeforces:1A', verdict: 'TIME_LIMIT_EXCEEDED', submittedAt: day(0) }),
      sub({ id: 3, problemKey: 'codeforces:1A', verdict: 'OK', submittedAt: day(1) }),
      sub({ id: 4, problemKey: 'codeforces:2A', verdict: 'OK', submittedAt: day(1) }),
    ]);
    expect(s.solvedAfterStruggle).toBe(1);
    expect(s.uniqueProblemsSolved).toBe(2);
  });

  it('aggregates tags with solve rate and separates unrated problems', () => {
    const s = computeStats([
      sub({ id: 1, problemKey: 'codeforces:1A', tags: ['dp', 'math'], problemRating: 1200 }),
      sub({ id: 2, problemKey: 'codeforces:2A', tags: ['dp'], problemRating: 1400, verdict: 'WRONG_ANSWER' }),
      sub({ id: 3, problemKey: 'codeforces:3A', tags: ['greedy'] }), // no rating
    ]);
    const dp = s.tags.find((t) => t.tag === 'dp')!;
    expect(dp.attempted).toBe(2);
    expect(dp.solved).toBe(1);
    expect(dp.solveRate).toBe(0.5);
    expect(s.unratedSubmissions).toBe(1);
    expect(s.avgSolvedRating).toBe(1200);
    expect(s.maxSolvedRating).toBe(1200);
    const unratedBucket = s.ratingBuckets.find((b) => b.rating === -1)!;
    expect(unratedBucket.attempted).toBe(1);
  });

  it('buckets ratings by 100', () => {
    expect(ratingBucketOf(1250)).toBe(1200);
    expect(ratingBucketOf(800)).toBe(800);
    expect(ratingBucketOf(null)).toBe(-1);
    expect(ratingBucketOf(0)).toBe(-1);
  });

  it('computes weekly activity and languages', () => {
    const s = computeStats([
      sub({ id: 1, submittedAt: new Date(Date.UTC(2026, 0, 5)), language: 'Python 3' }), // Monday
      sub({ id: 2, submittedAt: new Date(Date.UTC(2026, 0, 7)), language: 'Python 3' }),
      sub({ id: 3, submittedAt: new Date(Date.UTC(2026, 0, 13)), language: 'C++17' }),
    ]);
    expect(s.weeklyActivity.map((w) => w.week)).toEqual(['2026-01-05', '2026-01-12']);
    expect(s.weeklyActivity[0]!.submissions).toBe(2);
    expect(s.languages[0]).toEqual({ language: 'Python 3', count: 2 });
  });
});

describe('computeStreaks', () => {
  it('handles empty input', () => {
    expect(computeStreaks(new Set())).toEqual({ current: 0, longest: 0 });
  });

  it('finds longest and current streaks', () => {
    const days = new Set(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-10', '2026-01-11']);
    const r = computeStreaks(days, new Date(Date.UTC(2026, 0, 11, 20)));
    expect(r.longest).toBe(3);
    expect(r.current).toBe(2);
  });

  it('is forgiving by one day for the current streak', () => {
    const days = new Set(['2026-01-10', '2026-01-11']);
    expect(computeStreaks(days, new Date(Date.UTC(2026, 0, 12, 8))).current).toBe(2);
    expect(computeStreaks(days, new Date(Date.UTC(2026, 0, 14, 8))).current).toBe(0);
  });
});

describe('practiceSignals', () => {
  it('flags friction only with enough attempts and never labels unexplored topics as weak', () => {
    const stats = computeStats([
      sub({ id: 1, problemKey: 'codeforces:1A', tags: ['dp'], verdict: 'WRONG_ANSWER' }),
      sub({ id: 2, problemKey: 'codeforces:2A', tags: ['dp'], verdict: 'WRONG_ANSWER' }),
      sub({ id: 3, problemKey: 'codeforces:3A', tags: ['dp'], verdict: 'OK' }),
      sub({ id: 4, problemKey: 'codeforces:4A', tags: ['greedy'], verdict: 'WRONG_ANSWER' }), // single attempt → not friction
    ]);
    const signals = practiceSignals(stats, ['dp', 'greedy', 'graphs'], day(1));
    expect(signals.find((s) => s.tag === 'dp')?.kind).toBe('friction');
    expect(signals.find((s) => s.tag === 'greedy')).toBeUndefined();
    expect(signals.find((s) => s.tag === 'graphs')?.kind).toBe('unexplored');
  });

  it('flags stale topics', () => {
    const stats = computeStats([
      sub({ id: 1, problemKey: 'codeforces:1A', tags: ['math'], submittedAt: day(0) }),
      sub({ id: 2, problemKey: 'codeforces:2A', tags: ['math'], submittedAt: day(1) }),
    ]);
    const signals = practiceSignals(stats, [], day(90));
    expect(signals[0]).toMatchObject({ tag: 'math', kind: 'stale' });
  });
});
