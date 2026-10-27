import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getApp, registerUser } from '../helpers.ts';

describe('Technique Vault (notes) ownership and persistence', () => {
  let alice = '';
  let bob = '';
  let noteId = '';

  beforeAll(async () => {
    alice = (await registerUser('alice-notes@example.com')).cookie;
    bob = (await registerUser('bob-notes@example.com')).cookie;
  });

  it('requires a title', async () => {
    const res = await request(getApp()).post('/api/notes').set('Cookie', alice).send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/title/i);
  });

  it('creates a note with all journal fields', async () => {
    const res = await request(getApp())
      .post('/api/notes')
      .set('Cookie', alice)
      .send({
        kind: 'postmortem',
        title: 'Binary search on the answer',
        coreIdea: 'If feasible(x) is monotone, bisect on x.',
        explanation: 'Define lo/hi so that the invariant holds...',
        checklist: ['Prove monotonicity', 'Pick inclusive/exclusive bounds'],
        pitfalls: ['Infinite loop when mid rounds toward lo'],
        codeSnippet: 'while (lo < hi) { ... }',
        codeLanguage: 'cpp',
        whatWentWrong: 'Off-by-one on hi.',
        whyItFailed: 'Used hi = mid - 1 with a predicate true at mid.',
        whatILearned: 'Write the invariant before the loop.',
        rememberNextTime: 'Check lo==hi termination with a 2-element array.',
        conceptSlugs: ['binary-search', 'monotonic-predicates'],
        problemKeys: ['codeforces:1352C'],
        tags: ['search'],
      });
    expect(res.status).toBe(201);
    noteId = res.body.note.id;
    expect(res.body.note.checklist).toHaveLength(2);
    expect(res.body.note.conceptSlugs).toContain('binary-search');
  });

  it('lists, searches, and filters the owner’s notes only', async () => {
    const list = await request(getApp()).get('/api/notes').set('Cookie', alice);
    expect(list.body.total).toBe(1);
    const search = await request(getApp()).get('/api/notes?q=monotone').set('Cookie', alice);
    expect(search.body.total).toBe(1);
    const byConcept = await request(getApp()).get('/api/notes?concept=binary-search').set('Cookie', alice);
    expect(byConcept.body.total).toBe(1);
    const miss = await request(getApp()).get('/api/notes?q=nothingmatches').set('Cookie', alice);
    expect(miss.body.total).toBe(0);

    const bobList = await request(getApp()).get('/api/notes').set('Cookie', bob);
    expect(bobList.body.total).toBe(0);
  });

  it('blocks another user from reading, editing or deleting by id', async () => {
    expect((await request(getApp()).get(`/api/notes/${noteId}`).set('Cookie', bob)).status).toBe(404);
    expect((await request(getApp()).put(`/api/notes/${noteId}`).set('Cookie', bob).send({ title: 'hijack' })).status).toBe(404);
    expect((await request(getApp()).delete(`/api/notes/${noteId}`).set('Cookie', bob)).status).toBe(404);
    const still = await request(getApp()).get(`/api/notes/${noteId}`).set('Cookie', alice);
    expect(still.status).toBe(200);
    expect(still.body.note.title).toBe('Binary search on the answer');
  });

  it('edits and deletes as the owner, and rejects malformed ids', async () => {
    const upd = await request(getApp()).put(`/api/notes/${noteId}`).set('Cookie', alice).send({ title: 'Binary search (revised)', pinned: true });
    expect(upd.status).toBe(200);
    expect(upd.body.note.title).toBe('Binary search (revised)');
    expect(upd.body.note.pinned).toBe(true);
    expect((await request(getApp()).get('/api/notes/not-an-id').set('Cookie', alice)).status).toBe(400);
    expect((await request(getApp()).delete(`/api/notes/${noteId}`).set('Cookie', alice)).status).toBe(204);
    expect((await request(getApp()).get(`/api/notes/${noteId}`).set('Cookie', alice)).status).toBe(404);
  });
});

describe('Problem library', () => {
  let alice = '';
  let bob = '';

  beforeAll(async () => {
    alice = (await registerUser('alice-lib@example.com')).cookie;
    bob = (await registerUser('bob-lib@example.com')).cookie;
    await request(getApp()).post('/api/problems/catalogue/refresh').set('Cookie', alice);
    await request(getApp()).post('/api/platforms/codeforces/sync').set('Cookie', alice).send({ handle: 'alice' });
  });

  it('searches and filters the catalogue, annotated with the user’s own state', async () => {
    const all = await request(getApp()).get('/api/problems').set('Cookie', alice);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(12); // 11 from the problemset + 1500A from alice's history

    const byTag = await request(getApp()).get('/api/problems?tags=binary%20search').set('Cookie', alice);
    expect(byTag.body.total).toBe(2);

    const byRating = await request(getApp()).get('/api/problems?minRating=1000&maxRating=1300').set('Cookie', alice);
    expect(byRating.body.problems.every((p: { rating: number }) => p.rating >= 1000 && p.rating <= 1300)).toBe(true);

    const byName = await request(getApp()).get('/api/problems?q=watermelon').set('Cookie', alice);
    expect(byName.body.total).toBe(1);
    expect(byName.body.problems[0].user.solvedOnPlatform).toBe(true);
    expect(byName.body.problems[0].url).toBe('https://codeforces.com/problemset/problem/4/A');

    const unsolved = await request(getApp()).get('/api/problems?solved=false').set('Cookie', alice);
    expect(unsolved.body.problems.some((p: { key: string }) => p.key === 'codeforces:4A')).toBe(false);

    const bobView = await request(getApp()).get('/api/problems?q=watermelon').set('Cookie', bob);
    expect(bobView.body.problems[0].user.solvedOnPlatform).toBe(false);
  });

  it('saves, updates, and removes problems idempotently per user', async () => {
    const save = await request(getApp()).put('/api/problems/codeforces:1385D/save').set('Cookie', alice).send({ markedForRevision: true, status: 'attempting' });
    expect(save.status).toBe(200);
    expect(save.body.problem.user).toMatchObject({ saved: true, markedForRevision: true, status: 'attempting' });

    const again = await request(getApp()).put('/api/problems/codeforces:1385D/save').set('Cookie', alice).send({ status: 'solved' });
    expect(again.body.problem.user.status).toBe('solved');
    expect(again.body.problem.user.markedForRevision).toBe(true);

    const saved = await request(getApp()).get('/api/problems?saved=true').set('Cookie', alice);
    expect(saved.body.total).toBe(1);
    const revision = await request(getApp()).get('/api/problems?revision=true').set('Cookie', alice);
    expect(revision.body.total).toBe(1);

    const bobSaved = await request(getApp()).get('/api/problems?saved=true').set('Cookie', bob);
    expect(bobSaved.body.total).toBe(0);

    expect((await request(getApp()).put('/api/problems/codeforces:0000X/save').set('Cookie', alice).send({})).status).toBe(404);
    expect((await request(getApp()).put('/api/problems/evil%20key/save').set('Cookie', alice).send({})).status).toBe(400);

    expect((await request(getApp()).delete('/api/problems/codeforces:1385D/save').set('Cookie', alice)).status).toBe(204);
    expect((await request(getApp()).get('/api/problems?saved=true').set('Cookie', alice)).body.total).toBe(0);
  });

  it('returns problem detail with the user’s submissions', async () => {
    const res = await request(getApp()).get('/api/problems/codeforces:1352C').set('Cookie', alice);
    expect(res.status).toBe(200);
    expect(res.body.problem.name).toBe('K-th Not Divisible by n');
    expect(res.body.submissions).toHaveLength(2);
    expect(res.body.submissions.map((s: { verdict: string }) => s.verdict)).toEqual(['OK', 'WRONG_ANSWER']);
  });

  it('lists tags for filters', async () => {
    const res = await request(getApp()).get('/api/problems/tags').set('Cookie', alice);
    expect(res.body.tags.find((t: { tag: string }) => t.tag === 'math').count).toBeGreaterThan(3);
  });
});
