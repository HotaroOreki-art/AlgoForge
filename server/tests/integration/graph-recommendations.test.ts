import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getApp, registerUser } from '../helpers.ts';
import { CONCEPT_SEEDS, EDGE_SEEDS } from '../../src/services/graph/seed.ts';

describe('Knowledge graph API', () => {
  let cookie = '';

  beforeAll(async () => {
    cookie = (await registerUser('graph@example.com')).cookie;
    await request(getApp()).post('/api/problems/catalogue/refresh').set('Cookie', cookie);
    await request(getApp()).post('/api/platforms/codeforces/sync').set('Cookie', cookie).send({ handle: 'alice' });
    await request(getApp())
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'My BS note', conceptSlugs: ['binary-search'] });
  });

  it('serves the stored graph with a per-user evidence overlay', async () => {
    const res = await request(getApp()).get('/api/graph').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.nodes).toHaveLength(CONCEPT_SEEDS.length);
    expect(res.body.edges).toHaveLength(EDGE_SEEDS.length);
    const bs = res.body.nodes.find((n: { slug: string }) => n.slug === 'binary-search');
    expect(bs.evidence.solved).toBe(1); // 1352C
    expect(bs.evidence.notes).toBe(1);
    expect(res.body.meaning.prerequisite).toBeTruthy();
  });

  it('returns concept detail with neighbours, learning path, problems and notes', async () => {
    const res = await request(getApp()).get('/api/graph/binary-search').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.concept.name).toBe('Binary Search');
    expect(res.body.neighbours.every((n: { explanation: string }) => n.explanation.length > 0)).toBe(true);
    expect(res.body.prerequisites.map((p: { slug: string }) => p.slug)).toEqual(['arrays-and-iteration', 'sorting']);
    expect(res.body.unlocks.map((p: { slug: string }) => p.slug)).toContain('monotonic-predicates');
    expect(res.body.notes).toHaveLength(1);
    const keys = res.body.problems.map((p: { key: string }) => p.key);
    expect(keys).toContain('codeforces:1385D'); // binary search, unsolved → suggested first
    expect(res.body.problems.find((p: { key: string }) => p.key === 'codeforces:1352C')?.solved).toBe(true);
  });

  it('404s for unknown concepts and 400s for malformed slugs', async () => {
    expect((await request(getApp()).get('/api/graph/not-a-concept').set('Cookie', cookie)).status).toBe(404);
    expect((await request(getApp()).get('/api/graph/Bad_Slug!').set('Cookie', cookie)).status).toBe(400);
  });
});

describe('Recommendations API', () => {
  it('explains what is missing for a brand-new user and still returns something useful', async () => {
    const { cookie } = await registerUser('newbie@example.com');
    const res = await request(getApp()).get('/api/recommendations').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.context.missing).toContain('history');
    expect(res.body.context.levelEstimate).toBeNull();
    // Catalogue exists from previous tests → still produce candidates in the default band.
    expect(res.body.recommendations.length).toBeGreaterThan(0);
    expect(res.body.recommendations.every((r: { reasons: unknown[] }) => r.reasons.length > 0)).toBe(true);
  });

  it('ranks from real stored data, excludes solved problems, and explains each pick', async () => {
    const { cookie } = await registerUser('ranked@example.com');
    await request(getApp()).post('/api/platforms/codeforces/sync').set('Cookie', cookie).send({ handle: 'alice' });
    const res = await request(getApp()).get('/api/recommendations?limit=5').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.context.missing).toEqual([]);
    expect(res.body.context.levelEstimate).toBeGreaterThan(0);
    const keys = res.body.recommendations.map((r: { problem: { key: string } }) => r.problem.key);
    expect(keys).not.toContain('codeforces:4A');
    expect(keys).not.toContain('codeforces:1352C');
    // The unsolved TLE attempt (1500A) is not in the catalogue fixture, so it cannot be recommended —
    // but every recommendation must carry a headline and reasons.
    for (const r of res.body.recommendations) {
      expect(typeof r.headline).toBe('string');
      expect(r.score).toBe(r.reasons.reduce((a: number, x: { points: number }) => a + x.points, 0));
    }
    // Deterministic: same request → same order.
    const again = await request(getApp()).get('/api/recommendations?limit=5').set('Cookie', cookie);
    expect(again.body.recommendations.map((r: { problem: { key: string } }) => r.problem.key)).toEqual(keys);
  });

  it('honours an explicit tag focus and learning goals', async () => {
    const { cookie } = await registerUser('focus@example.com');
    await request(getApp()).patch('/api/auth/me').set('Cookie', cookie).send({ learningGoals: ['dynamic-programming'] });
    const res = await request(getApp()).get('/api/recommendations?tags=dp').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
    expect(res.body.recommendations.every((r: { problem: { tags: string[] } }) => r.problem.tags.includes('dp'))).toBe(true);
    expect(res.body.recommendations[0].reasons.some((x: { kind: string }) => x.kind === 'goal')).toBe(true);
  });
});

describe('Workspace', () => {
  it('reports execution as not configured and refuses to run without a judge', async () => {
    const { cookie } = await registerUser('ws@example.com');
    const status = await request(getApp()).get('/api/workspace/status').set('Cookie', cookie);
    expect(status.body.executionConfigured).toBe(false);
    const run = await request(getApp()).post('/api/workspace/run').set('Cookie', cookie).send({ language: 'cpp', code: 'int main(){}' });
    expect(run.status).toBe(503);
    expect(run.body.error.code).toBe('NOT_CONFIGURED');
    const badLang = await request(getApp()).post('/api/workspace/run').set('Cookie', cookie).send({ language: 'brainfuck', code: '+' });
    expect(badLang.status).toBe(400);
    expect(badLang.body.error.message).toMatch(/Unsupported language/);
  });

  it('persists drafts per user, problem and language', async () => {
    const { cookie } = await registerUser('draft@example.com');
    const put = await request(getApp()).put('/api/workspace/drafts').set('Cookie', cookie).send({ problemKey: 'codeforces:4A', language: 'python', code: 'print(1)', stdin: '' });
    expect(put.status).toBe(200);
    const get = await request(getApp()).get('/api/workspace/drafts?problemKey=codeforces:4A&language=python').set('Cookie', cookie);
    expect(get.body.draft.code).toBe('print(1)');
    const other = await request(getApp()).get('/api/workspace/drafts?problemKey=codeforces:4A&language=cpp').set('Cookie', cookie);
    expect(other.body.draft).toBeNull();
  });
});
