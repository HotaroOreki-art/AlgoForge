import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { getApp, extractCookie } from '../helpers.ts';
import { User } from '../../src/models/User.ts';

describe('auth API', () => {
  it('health reports a connected database', async () => {
    const res = await request(getApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.db).toBe('connected');
  });

  it('rejects invalid registration input with useful messages', async () => {
    const bad = await request(getApp()).post('/api/auth/register').send({ email: 'nope', password: 'short', displayName: 'A' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('BAD_REQUEST');
    expect(bad.body.error.message).toMatch(/email/i);

    const weak = await request(getApp()).post('/api/auth/register').send({ email: 'a@b.co', password: 'onlyletters', displayName: 'Ana' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.message).toMatch(/number/i);
  });

  it('registers, sets an HttpOnly cookie, and never stores plaintext passwords', async () => {
    const res = await request(getApp()).post('/api/auth/register').send({ email: 'Ada@Example.com', password: 'Passw0rd!', displayName: 'Ada' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('ada@example.com');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.join(';')).toMatch(/HttpOnly/);
    expect(setCookie.join(';')).toMatch(/SameSite=Lax/);

    const stored = await User.findOne({ email: 'ada@example.com' }).lean();
    expect(stored!.passwordHash).not.toBe('Passw0rd!');
    expect(stored!.passwordHash.startsWith('$2')).toBe(true);
  });

  it('refuses duplicate emails', async () => {
    await request(getApp()).post('/api/auth/register').send({ email: 'dup@example.com', password: 'Passw0rd!', displayName: 'Dup' });
    const res = await request(getApp()).post('/api/auth/register').send({ email: 'dup@example.com', password: 'Passw0rd!', displayName: 'Dup' });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials and rejects wrong ones with the same message', async () => {
    await request(getApp()).post('/api/auth/register').send({ email: 'login@example.com', password: 'Passw0rd!', displayName: 'Log' });
    const ok = await request(getApp()).post('/api/auth/login').send({ email: 'login@example.com', password: 'Passw0rd!' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.displayName).toBe('Log');

    const wrongPw = await request(getApp()).post('/api/auth/login').send({ email: 'login@example.com', password: 'Nope12345' });
    const noUser = await request(getApp()).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'Nope12345' });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body.error.message).toBe(noUser.body.error.message);
  });

  it('protects routes, returns the session user, and logs out', async () => {
    const anon = await request(getApp()).get('/api/auth/me');
    expect(anon.status).toBe(401);

    const reg = await request(getApp()).post('/api/auth/register').send({ email: 'me@example.com', password: 'Passw0rd!', displayName: 'Me' });
    const cookie = extractCookie(reg.headers['set-cookie']);
    const me = await request(getApp()).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('me@example.com');

    const forged = await request(getApp()).get('/api/auth/me').set('Cookie', 'af_session=not.a.token');
    expect(forged.status).toBe(401);

    const out = await request(getApp()).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(204);
    const cleared = (out.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cleared).toMatch(/af_session=;/);
  });

  it('updates profile preferences (theme, goals)', async () => {
    const reg = await request(getApp()).post('/api/auth/register').send({ email: 'pref@example.com', password: 'Passw0rd!', displayName: 'Pref' });
    const cookie = extractCookie(reg.headers['set-cookie']);
    const upd = await request(getApp()).patch('/api/auth/me').set('Cookie', cookie).send({ theme: 'daylight', learningGoals: ['dynamic-programming'] });
    expect(upd.status).toBe(200);
    expect(upd.body.user.theme).toBe('daylight');
    const bad = await request(getApp()).patch('/api/auth/me').set('Cookie', cookie).send({ theme: 'neon' });
    expect(bad.status).toBe(400);
  });

  it('returns JSON 404 for unknown API routes and 400 for malformed JSON', async () => {
    const nf = await request(getApp()).get('/api/nothing-here');
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe('NOT_FOUND');
    const bad = await request(getApp()).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(bad.status).toBe(400);
  });
});
