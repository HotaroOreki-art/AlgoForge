import { describe, expect, it } from 'vitest';
import {
  dedupeSubmissions,
  isValidHandle,
  normalizeProblem,
  normalizeRatingHistory,
  normalizeSubmission,
  normalizeTags,
  normalizeVerdict,
  problemKey,
  problemUrl,
} from '../../src/services/codeforces/normalize.ts';
import { cfSubmissionSchema } from '../../src/services/codeforces/types.ts';

const rawSubmission = {
  id: 395033187,
  contestId: 2261,
  creationTimeSeconds: 1792258463,
  relativeTimeSeconds: 10763,
  problem: {
    contestId: 2261,
    index: 'H',
    name: 'Oh Tree Tree Tree, No Need to Leave',
    type: 'PROGRAMMING',
    points: 4500,
    rating: 3500,
    tags: ['bitmasks', 'Communication', 'bitmasks', 'trees '],
  },
  author: { contestId: 2261, participantId: 1, members: [{ handle: 'tourist' }], participantType: 'CONTESTANT', ghost: false },
  programmingLanguage: 'C++23 (GCC 14-64, msys2)',
  verdict: 'OK',
  testset: 'TESTS',
  passedTestCount: 55,
  timeConsumedMillis: 250,
  memoryConsumedBytes: 0,
};

describe('codeforces normalisation', () => {
  it('builds canonical problem keys and URLs', () => {
    expect(problemKey(1352, 'C')).toBe('codeforces:1352C');
    expect(problemKey(undefined, 'A')).toBe('codeforces:xA');
    expect(problemUrl(1352, 'C')).toBe('https://codeforces.com/problemset/problem/1352/C');
    expect(problemUrl(102341, 'B')).toBe('https://codeforces.com/gym/102341/problem/B');
  });

  it('normalises tags: lowercases, trims, dedupes', () => {
    expect(normalizeTags(['bitmasks', 'Communication', 'bitmasks', 'trees '])).toEqual(['bitmasks', 'communication', 'trees']);
    expect(normalizeTags(undefined)).toEqual([]);
  });

  it('maps verdicts, treating a missing verdict as TESTING and unknown strings as UNKNOWN', () => {
    expect(normalizeVerdict('OK')).toBe('OK');
    expect(normalizeVerdict(undefined)).toBe('TESTING');
    expect(normalizeVerdict('SOMETHING_NEW')).toBe('UNKNOWN');
  });

  it('distinguishes "rating not published" from zero', () => {
    const p = normalizeProblem({ contestId: 1, index: 'A', name: 'X', tags: [] });
    expect(p.rating).toBeUndefined();
    const z = normalizeProblem({ contestId: 1, index: 'A', name: 'X', rating: 0, tags: [] });
    expect(z.rating).toBeUndefined();
    const r = normalizeProblem({ contestId: 1, index: 'A', name: 'X', rating: 800, tags: [] });
    expect(r.rating).toBe(800);
  });

  it('normalises a real submission payload', () => {
    const parsed = cfSubmissionSchema.parse(rawSubmission);
    const s = normalizeSubmission(parsed);
    expect(s.platformSubmissionId).toBe(395033187);
    expect(s.problemKey).toBe('codeforces:2261H');
    expect(s.verdict).toBe('OK');
    expect(s.problemRating).toBe(3500);
    expect(s.tags).toEqual(['bitmasks', 'communication', 'trees']);
    expect(s.submittedAt.toISOString()).toBe(new Date(1792258463 * 1000).toISOString());
    expect(s.participantType).toBe('CONTESTANT');
  });

  it('rejects malformed submissions at the schema boundary', () => {
    expect(cfSubmissionSchema.safeParse({ ...rawSubmission, id: 'abc' }).success).toBe(false);
    expect(cfSubmissionSchema.safeParse({ ...rawSubmission, problem: {} }).success).toBe(false);
  });

  it('dedupes submissions by platform id, keeping the first occurrence', () => {
    const list = [
      { platformSubmissionId: 1, v: 'first' },
      { platformSubmissionId: 2, v: 'two' },
      { platformSubmissionId: 1, v: 'dup' },
    ];
    const out = dedupeSubmissions(list);
    expect(out).toHaveLength(2);
    expect(out[0]!.v).toBe('first');
  });

  it('sorts rating history chronologically', () => {
    const hist = normalizeRatingHistory([
      { contestId: 2, contestName: 'B', handle: 'x', rank: 1, ratingUpdateTimeSeconds: 200, oldRating: 1500, newRating: 1600 },
      { contestId: 1, contestName: 'A', handle: 'x', rank: 1, ratingUpdateTimeSeconds: 100, oldRating: 0, newRating: 1500 },
    ]);
    expect(hist.map((h) => h.contestId)).toEqual([1, 2]);
    expect(hist[0]!.at.getTime()).toBe(100_000);
  });

  it('validates handles', () => {
    expect(isValidHandle('tourist')).toBe(true);
    expect(isValidHandle('a.b_c-d')).toBe(true);
    expect(isValidHandle('ab')).toBe(false);
    expect(isValidHandle('has space')).toBe(false);
    expect(isValidHandle('x'.repeat(25))).toBe(false);
  });
});
