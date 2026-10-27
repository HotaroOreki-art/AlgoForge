import type { Fetcher } from '../../src/services/codeforces/client.ts';

/**
 * A fake Codeforces API driven by in-memory data. Lets integration tests
 * exercise the full sync pipeline (HTTP → validation → normalisation →
 * persistence) without network access or rate limits.
 */
export interface FakeCfState {
  users: Record<string, Record<string, unknown>>;
  submissions: Record<string, unknown[]>; // newest first, as the real API returns
  ratings: Record<string, unknown[]>;
  problemset?: { problems: unknown[]; problemStatistics: unknown[] };
  failNext?: { status: number; body: unknown } | null;
  /** Fail the next call to this specific API method (then clear). */
  failOn?: { method: string; status: number; body: unknown } | null;
  calls: string[];
}

export function makeFakeCodeforces(state: FakeCfState): Fetcher {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  return (async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const method = url.pathname.split('/').pop()!;
    state.calls.push(method);

    if (state.failNext) {
      const f = state.failNext;
      state.failNext = null;
      return json(f.status, f.body);
    }
    if (state.failOn && state.failOn.method === method) {
      const f = state.failOn;
      state.failOn = null;
      return json(f.status, f.body);
    }

    if (method === 'user.info') {
      const handle = url.searchParams.get('handles')!;
      const user = Object.entries(state.users).find(([h]) => h.toLowerCase() === handle.toLowerCase())?.[1];
      if (!user) return json(400, { status: 'FAILED', comment: `handles: User with handle ${handle} not found` });
      return json(200, { status: 'OK', result: [user] });
    }
    if (method === 'user.status') {
      const handle = url.searchParams.get('handle')!;
      const from = Number(url.searchParams.get('from') ?? 1);
      const count = Number(url.searchParams.get('count') ?? 1000);
      const list = state.submissions[handle] ?? [];
      return json(200, { status: 'OK', result: list.slice(from - 1, from - 1 + count) });
    }
    if (method === 'user.rating') {
      const handle = url.searchParams.get('handle')!;
      return json(200, { status: 'OK', result: state.ratings[handle] ?? [] });
    }
    if (method === 'problemset.problems') {
      return json(200, { status: 'OK', result: state.problemset ?? { problems: [], problemStatistics: [] } });
    }
    return json(400, { status: 'FAILED', comment: 'unknown method' });
  }) as Fetcher;
}

export function cfSubmission(id: number, opts: { contestId?: number; index?: string; name?: string; rating?: number; tags?: string[]; verdict?: string; time?: number }) {
  const contestId = opts.contestId ?? 1000;
  const index = opts.index ?? 'A';
  return {
    id,
    contestId,
    creationTimeSeconds: opts.time ?? 1_700_000_000 + id,
    relativeTimeSeconds: 100,
    problem: { contestId, index, name: opts.name ?? `Problem ${contestId}${index}`, type: 'PROGRAMMING', rating: opts.rating, tags: opts.tags ?? ['implementation'] },
    author: { contestId, members: [{ handle: 'alice' }], participantType: 'PRACTICE', ghost: false },
    programmingLanguage: 'GNU C++17',
    verdict: opts.verdict ?? 'OK',
    testset: 'TESTS',
    passedTestCount: 10,
    timeConsumedMillis: 31,
    memoryConsumedBytes: 1024,
  };
}

export const aliceUser = {
  handle: 'alice',
  rating: 1432,
  maxRating: 1500,
  rank: 'specialist',
  maxRank: 'specialist',
  avatar: 'https://userpic.codeforces.org/no-avatar.jpg',
  titlePhoto: 'https://userpic.codeforces.org/no-title.jpg',
  friendOfCount: 3,
  contribution: 0,
  registrationTimeSeconds: 1_600_000_000,
  lastOnlineTimeSeconds: 1_700_000_000,
};
