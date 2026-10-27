import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.ts';
import { CodeforcesClient } from '../src/services/codeforces/client.ts';
import { aliceUser, cfSubmission, makeFakeCodeforces, type FakeCfState } from './fixtures/codeforces.ts';

let app: Express | null = null;
let fakeState: FakeCfState | null = null;

/** Default fake Codeforces world used by integration tests. */
export function freshCfState(): FakeCfState {
  return {
    users: { alice: aliceUser },
    submissions: {
      alice: [
        cfSubmission(105, { contestId: 1352, index: 'C', name: 'K-th Not Divisible by n', rating: 1200, tags: ['binary search', 'math'], verdict: 'OK' }),
        cfSubmission(104, { contestId: 1352, index: 'C', name: 'K-th Not Divisible by n', rating: 1200, tags: ['binary search', 'math'], verdict: 'WRONG_ANSWER' }),
        cfSubmission(103, { contestId: 4, index: 'A', name: 'Watermelon', rating: 800, tags: ['brute force', 'math'], verdict: 'OK' }),
        cfSubmission(102, { contestId: 1343, index: 'B', name: 'Balanced Array', rating: 800, tags: ['constructive algorithms', 'math'], verdict: 'OK' }),
        cfSubmission(101, { contestId: 1500, index: 'A', name: 'Weird', rating: undefined, tags: ['dp'], verdict: 'TIME_LIMIT_EXCEEDED' }),
      ],
    },
    ratings: {
      alice: [
        { contestId: 1352, contestName: 'Round 640', handle: 'alice', rank: 1000, ratingUpdateTimeSeconds: 1_600_100_000, oldRating: 0, newRating: 1300 },
        { contestId: 1343, contestName: 'Round 636', handle: 'alice', rank: 900, ratingUpdateTimeSeconds: 1_600_200_000, oldRating: 1300, newRating: 1432 },
      ],
    },
    problemset: {
      problems: [
        { contestId: 1352, index: 'C', name: 'K-th Not Divisible by n', type: 'PROGRAMMING', rating: 1200, tags: ['binary search', 'math'] },
        { contestId: 4, index: 'A', name: 'Watermelon', type: 'PROGRAMMING', rating: 800, tags: ['brute force', 'math'] },
        { contestId: 1343, index: 'B', name: 'Balanced Array', type: 'PROGRAMMING', rating: 800, tags: ['constructive algorithms', 'math'] },
        { contestId: 1360, index: 'C', name: 'Similar Pairs', type: 'PROGRAMMING', rating: 1100, tags: ['constructive algorithms', 'graphs', 'greedy', 'math'] },
        { contestId: 1374, index: 'C', name: 'Move Brackets', type: 'PROGRAMMING', rating: 1000, tags: ['greedy', 'strings'] },
        { contestId: 1385, index: 'D', name: 'a-Good String', type: 'PROGRAMMING', rating: 1500, tags: ['binary search', 'divide and conquer', 'dp'] },
        { contestId: 1398, index: 'C', name: 'Good Subarrays', type: 'PROGRAMMING', rating: 1600, tags: ['data structures', 'dp', 'math'] },
        { contestId: 1409, index: 'A', name: 'Yet Another Two Integers Problem', type: 'PROGRAMMING', rating: 800, tags: ['greedy', 'math'] },
        { contestId: 1352, index: 'A', name: 'Sum of Round Numbers', type: 'PROGRAMMING', rating: 800, tags: ['implementation', 'math'] },
        { contestId: 1352, index: 'D', name: 'Alice, Bob and Candies', type: 'PROGRAMMING', rating: 1300, tags: ['implementation', 'two pointers'] },
        { contestId: 9999, index: 'Z', name: 'Untagged Unrated', type: 'PROGRAMMING', tags: [] },
      ],
      problemStatistics: [
        { contestId: 1352, index: 'C', solvedCount: 50000 },
        { contestId: 4, index: 'A', solvedCount: 400000 },
        { contestId: 1343, index: 'B', solvedCount: 60000 },
        { contestId: 1360, index: 'C', solvedCount: 30000 },
        { contestId: 1374, index: 'C', solvedCount: 35000 },
        { contestId: 1385, index: 'D', solvedCount: 20000 },
        { contestId: 1398, index: 'C', solvedCount: 18000 },
        { contestId: 1409, index: 'A', solvedCount: 90000 },
        { contestId: 1352, index: 'A', solvedCount: 120000 },
        { contestId: 1352, index: 'D', solvedCount: 45000 },
      ],
    },
    failNext: null,
    calls: [],
  };
}

export function getFakeState(): FakeCfState {
  if (!fakeState) fakeState = freshCfState();
  return fakeState;
}

export function getApp(): Express {
  if (!app) {
    const client = new CodeforcesClient({ fetcher: makeFakeCodeforces(getFakeState()), minIntervalMs: 0 });
    app = createApp({ codeforcesClient: client });
  }
  return app;
}

/** Registers a user and returns the session cookie + user payload. */
export async function registerUser(email: string, password = 'Passw0rd!', displayName = 'Tester') {
  const res = await request(getApp()).post('/api/auth/register').send({ email, password, displayName });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = extractCookie(res.headers['set-cookie']);
  return { cookie, user: res.body.user as { id: string; email: string } };
}

export function extractCookie(setCookie: string | string[] | undefined): string {
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const session = arr.find((c) => c.startsWith('af_session='));
  if (!session) throw new Error('no session cookie');
  return session.split(';')[0]!;
}
