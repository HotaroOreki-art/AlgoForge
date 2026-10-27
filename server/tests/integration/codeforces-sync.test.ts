import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getApp, getFakeState, registerUser } from '../helpers.ts';
import { Submission } from '../../src/models/Submission.ts';
import { cfSubmission } from '../fixtures/codeforces.ts';

describe('Codeforces sync pipeline', () => {
  let cookie = '';
  let userId = '';

  beforeAll(async () => {
    const u = await registerUser('sync@example.com');
    cookie = u.cookie;
    userId = u.user.id;
  });

  it('requires authentication', async () => {
    const res = await request(getApp()).post('/api/platforms/codeforces/sync').send({ handle: 'alice' });
    expect(res.status).toBe(401);
  });

  it('rejects malformed handles before calling the API', async () => {
    const before = getFakeState().calls.length;
    const res = await request(getApp()).post('/api/platforms/codeforces/sync').set('Cookie', cookie).send({ handle: 'bad handle!' });
    expect(res.status).toBe(400);
    expect(getFakeState().calls.length).toBe(before);
  });

  it('reports unknown handles clearly and stores nothing', async () => {
    const res = await request(getApp()).post('/api/platforms/codeforces/sync').set('Cookie', cookie).send({ handle: 'nobody_here' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CF_HANDLE_NOT_FOUND');
    const conn = await request(getApp()).get('/api/platforms/codeforces').set('Cookie', cookie);
    expect(conn.body.connection).toBeNull();
  });

  it('imports and normalises a real-shaped submission history', async () => {
    const res = await request(getApp()).post('/api/platforms/codeforces/sync').set('Cookie', cookie).send({ handle: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({ handle: 'alice', fetched: 5, inserted: 5, updated: 0, incremental: false });
    expect(res.body.connection.profile.rating).toBe(1432);
    expect(res.body.connection.ratingHistory).toHaveLength(2);
    expect(res.body.connection.lastSyncStatus).toBe('success');
    expect(res.body.connection.lastSuccessfulSyncAt).toBeTruthy();

    const stored = await Submission.find({ userId }).sort({ platformSubmissionId: 1 }).lean();
    expect(stored).toHaveLength(5);
    expect(stored[0]!.problemKey).toBe('codeforces:1500A');
    expect(stored[0]!.problemRating).toBeUndefined(); // unrated stays unknown, not 0
    expect(stored[4]!.verdict).toBe('OK');
    expect(stored[4]!.tags).toEqual(['binary search', 'math']);
  });

  it('is idempotent: re-syncing creates no duplicate submissions', async () => {
    const res = await request(getApp()).post('/api/platforms/codeforces/sync').set('Cookie', cookie).send({});
    expect(res.status).toBe(200);
    expect(res.body.result.inserted).toBe(0);
    expect(res.body.result.incremental).toBe(true);
    expect(await Submission.countDocuments({ userId })).toBe(5);
  });

  it('incrementally imports only new submissions', async () => {
    const state = getFakeState();
    state.submissions.alice!.unshift(
      cfSubmission(106, { contestId: 1360, index: 'C', name: 'Similar Pairs', rating: 1100, tags: ['graphs', 'greedy'], verdict: 'OK' }),
    );
    const before = state.calls.length;
    const res = await request(getApp()).post('/api/platforms/codeforces/sync').set('Cookie', cookie).send({});
    expect(res.status).toBe(200);
    expect(res.body.result.inserted).toBe(1);
    expect(await Submission.countDocuments({ userId })).toBe(6);
    // Only user.info, one user.status page and user.rating should be hit.
    expect(state.calls.slice(before)).toEqual(['user.info', 'user.status', 'user.rating']);
  });

  it('preserves the last successful import when a later sync fails upstream', async () => {
    const state = getFakeState();
    const beforeConn = await request(getApp()).get('/api/platforms/codeforces').set('Cookie', cookie);
    const lastOk = beforeConn.body.connection.lastSuccessfulSyncAt;

    // user.info succeeds, then user.status is rate-limited by the platform.
    state.failOn = { method: 'user.status', status: 200, body: { status: 'FAILED', comment: 'Call limit exceeded' } };
    const res = await request(getApp()).post('/api/platforms/codeforces/sync').set('Cookie', cookie).send({});
    state.failOn = null;

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('CF_RATE_LIMITED');
    const after = await request(getApp()).get('/api/platforms/codeforces').set('Cookie', cookie);
    expect(after.body.connection.lastSyncStatus).toBe('failed');
    expect(after.body.connection.lastSyncError).toBeTruthy();
    expect(after.body.connection.lastSuccessfulSyncAt).toBe(lastOk);
    expect(await Submission.countDocuments({ userId })).toBe(6);
    expect(after.body.runs[0].status).toBe('failed');
  });

  it('exposes dashboard statistics computed from stored submissions', async () => {
    const res = await request(getApp()).get('/api/dashboard').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.hasData).toBe(true);
    expect(res.body.stats.totalSubmissions).toBe(6);
    expect(res.body.stats.uniqueProblemsSolved).toBe(4); // 1352C, 4A, 1343B, 1360C
    expect(res.body.stats.unsolvedAttempts).toBe(1); // 1500A
    expect(res.body.stats.solvedAfterStruggle).toBe(1); // 1352C after WA
    const math = res.body.stats.tags.find((t: { tag: string }) => t.tag === 'math');
    expect(math.solved).toBe(3);

    const topic = await request(getApp()).get('/api/dashboard/topic?tag=math').set('Cookie', cookie);
    expect(topic.status).toBe(200);
    expect(topic.body.problems.length).toBe(3);
  });

  it('refreshes the shared problem catalogue idempotently', async () => {
    const first = await request(getApp()).post('/api/problems/catalogue/refresh').set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.body.total).toBe(11);
    const second = await request(getApp()).post('/api/problems/catalogue/refresh').set('Cookie', cookie);
    expect(second.body.upserted).toBe(0);
    const status = await request(getApp()).get('/api/problems/catalogue').set('Cookie', cookie);
    expect(status.body.total).toBe(12); // 11 from the problemset + 1500A seen only in alice's history
  });

  it('disconnecting removes the user history but not the shared catalogue', async () => {
    const del = await request(getApp()).delete('/api/platforms/codeforces').set('Cookie', cookie);
    expect(del.status).toBe(204);
    expect(await Submission.countDocuments({ userId })).toBe(0);
    const dash = await request(getApp()).get('/api/dashboard').set('Cookie', cookie);
    expect(dash.body.hasData).toBe(false);
    expect(dash.body.stats.acceptanceRate).toBeNull();
    const cat = await request(getApp()).get('/api/problems/catalogue').set('Cookie', cookie);
    expect(cat.body.total).toBe(12);
  });
});
