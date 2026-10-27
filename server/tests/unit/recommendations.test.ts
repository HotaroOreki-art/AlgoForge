import { describe, expect, it } from 'vitest';
import { difficultyFit, estimateLevel, recommend, scoreProblem, type CandidateProblem, type UserSignals } from '../../src/services/recommendations.ts';

function signals(partial: Partial<UserSignals> = {}): UserSignals {
  return {
    solvedKeys: new Set(),
    unsolvedAttemptKeys: new Set(),
    levelEstimate: 1200,
    frictionTags: new Set(),
    staleTags: new Set(),
    recentTags: new Set(),
    goalTags: new Map(),
    frontierTags: new Map(),
    ...partial,
  };
}

const problem = (key: string, rating: number | null, tags: string[], solvedCount = 1000): CandidateProblem => ({
  key,
  name: key,
  url: `https://codeforces.com/${key}`,
  rating,
  tags,
  solvedCount,
});

describe('difficultyFit', () => {
  it('is 1 near the target and 0 far away', () => {
    expect(difficultyFit(1350, 1350)).toBe(1);
    expect(difficultyFit(1250, 1350)).toBe(1);
    expect(difficultyFit(1850, 1350)).toBe(0);
    expect(difficultyFit(1550, 1350)).toBeCloseTo(0.75);
  });
});

describe('scoreProblem', () => {
  it('filters out solved problems by default but can include them', () => {
    const s = signals({ solvedKeys: new Set(['codeforces:1A']) });
    expect(scoreProblem(problem('codeforces:1A', 1300, ['dp']), s)).toBeNull();
    expect(scoreProblem(problem('codeforces:1A', 1300, ['dp']), s, { includeSolved: true })).not.toBeNull();
  });

  it('explains every point it awards', () => {
    const s = signals({ frictionTags: new Set(['dp']), unsolvedAttemptKeys: new Set(['codeforces:2B']) });
    const r = scoreProblem(problem('codeforces:2B', 1350, ['dp']), s)!;
    const total = r.reasons.reduce((a, x) => a + x.points, 0);
    expect(r.score).toBe(total);
    expect(r.reasons.map((x) => x.kind)).toEqual(expect.arrayContaining(['difficulty', 'comeback', 'friction']));
    expect(r.headline).toMatch(/Rated 1350|attempted this before/);
  });

  it('handles missing rating and tags gracefully', () => {
    const r = scoreProblem(problem('codeforces:3C', null, []), signals())!;
    expect(r).not.toBeNull();
    expect(r.reasons.some((x) => /not published a rating/.test(x.text))).toBe(true);
    expect(r.reasons.some((x) => /No tag metadata/.test(x.text))).toBe(true);
  });

  it('does not award difficulty points without a level estimate', () => {
    const r = scoreProblem(problem('codeforces:3C', 1500, ['math']), signals({ levelEstimate: null }))!;
    expect(r.reasons.find((x) => x.kind === 'difficulty')).toBeUndefined();
    expect(r.reasons.some((x) => /calibrate/.test(x.text))).toBe(true);
  });

  it('enforces an explicit tag focus as a hard filter', () => {
    expect(scoreProblem(problem('codeforces:4D', 1300, ['greedy']), signals(), { focusTags: ['dp'] })).toBeNull();
    expect(scoreProblem(problem('codeforces:4D', 1300, ['dp']), signals(), { focusTags: ['dp'] })).not.toBeNull();
  });

  it('credits learning goals and graph frontier', () => {
    const s = signals({ goalTags: new Map([['graphs', 'Graph Traversal']]), frontierTags: new Map([['binary search', 'Binary Search']]) });
    const g = scoreProblem(problem('codeforces:5E', 1350, ['graphs']), s)!;
    expect(g.reasons.some((x) => x.kind === 'goal' && /Graph Traversal/.test(x.text))).toBe(true);
    const f = scoreProblem(problem('codeforces:6F', 1350, ['binary search']), s)!;
    expect(f.reasons.some((x) => x.kind === 'frontier' && /Binary Search/.test(x.text))).toBe(true);
  });
});

describe('recommend', () => {
  it('ranks deterministically: friction + fit beats popularity alone', () => {
    const s = signals({ frictionTags: new Set(['dp']) });
    const cands = [
      problem('codeforces:9A', 1350, ['greedy'], 100000),
      problem('codeforces:8B', 1350, ['dp'], 500),
      problem('codeforces:7C', 2500, ['dp'], 500), // far too hard
    ];
    const r1 = recommend(cands, s, { limit: 3 });
    const r2 = recommend([...cands].reverse(), s, { limit: 3 });
    expect(r1.map((x) => x.problem.key)).toEqual(r2.map((x) => x.problem.key));
    expect(r1[0]!.problem.key).toBe('codeforces:8B');
    expect(r1[2]!.problem.key).toBe('codeforces:7C');
  });

  it('breaks ties by easier rating then key', () => {
    const cands = [problem('codeforces:1B', 1400, ['x'], 10), problem('codeforces:1A', 1300, ['x'], 10)];
    const r = recommend(cands, signals(), { limit: 2 });
    expect(r.map((x) => x.problem.key)).toEqual(['codeforces:1A', 'codeforces:1B']);
  });

  it('returns an empty list when nothing is eligible', () => {
    expect(recommend([], signals())).toEqual([]);
    expect(recommend([problem('codeforces:1A', 1300, ['x'])], signals({ solvedKeys: new Set(['codeforces:1A']) }))).toEqual([]);
  });
});

describe('estimateLevel', () => {
  it('returns null without rated solves and rounds to 50', () => {
    expect(estimateLevel([])).toBeNull();
    expect(estimateLevel([0, 0])).toBeNull();
    expect(estimateLevel([800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700])).toBe(1500);
    expect(estimateLevel([1234])).toBe(1250);
  });
});
