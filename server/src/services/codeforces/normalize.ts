import { VERDICTS, type Verdict } from '../../models/Submission.ts';
import type { CfProblem, CfSubmission, CfUser, CfRatingChange } from './types.ts';

/**
 * Pure functions that translate Codeforces API objects into AlgoForge records.
 * No I/O here — this module is fully unit-testable.
 */

export function problemKey(contestId: number | undefined, index: string): string {
  return `codeforces:${contestId ?? 'x'}${index}`;
}

export function problemUrl(contestId: number | undefined, index: string): string {
  if (contestId === undefined) return `https://codeforces.com/problemset`;
  // Gym contests have ids >= 100000 and live under /gym.
  if (contestId >= 100000) return `https://codeforces.com/gym/${contestId}/problem/${index}`;
  return `https://codeforces.com/problemset/problem/${contestId}/${index}`;
}

export function normalizeVerdict(verdict: string | undefined): Verdict {
  if (!verdict) return 'TESTING';
  return (VERDICTS as readonly string[]).includes(verdict) ? (verdict as Verdict) : 'UNKNOWN';
}

export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const clean = t.trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

export interface NormalizedProblem {
  key: string;
  platform: 'codeforces';
  platformId: string;
  contestId?: number;
  index: string;
  name: string;
  rating?: number;
  tags: string[];
  url: string;
}

export function normalizeProblem(p: Omit<CfProblem, 'tags'> & { tags?: string[] }): NormalizedProblem {
  const key = problemKey(p.contestId, p.index);
  return {
    key,
    platform: 'codeforces',
    platformId: `${p.contestId ?? 'x'}${p.index}`,
    contestId: p.contestId,
    index: p.index,
    name: p.name.trim(),
    rating: typeof p.rating === 'number' && p.rating > 0 ? p.rating : undefined,
    tags: normalizeTags(p.tags),
    url: problemUrl(p.contestId, p.index),
  };
}

export interface NormalizedSubmission {
  platform: 'codeforces';
  platformSubmissionId: number;
  problemKey: string;
  problemName: string;
  problemRating?: number;
  tags: string[];
  verdict: Verdict;
  language?: string;
  submittedAt: Date;
  contestId?: number;
  participantType?: string;
  passedTestCount?: number;
  timeMs?: number;
  memoryBytes?: number;
}

export function normalizeSubmission(s: CfSubmission): NormalizedSubmission {
  const problem = normalizeProblem(s.problem);
  return {
    platform: 'codeforces',
    platformSubmissionId: s.id,
    problemKey: problem.key,
    problemName: problem.name,
    problemRating: problem.rating,
    tags: problem.tags,
    verdict: normalizeVerdict(s.verdict),
    language: s.programmingLanguage,
    submittedAt: new Date(s.creationTimeSeconds * 1000),
    contestId: s.contestId ?? s.problem.contestId,
    participantType: s.author?.participantType,
    passedTestCount: s.passedTestCount,
    timeMs: s.timeConsumedMillis,
    memoryBytes: s.memoryConsumedBytes,
  };
}

/**
 * Remove duplicate submissions by platform id, keeping the first occurrence
 * (the API returns newest first, so the first is the most recent view).
 */
export function dedupeSubmissions<T extends { platformSubmissionId: number }>(subs: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const s of subs) {
    if (seen.has(s.platformSubmissionId)) continue;
    seen.add(s.platformSubmissionId);
    out.push(s);
  }
  return out;
}

/**
 * Codeforces `user.info` returns titlePhoto/avatar on userpic.codeforces.org.
 * That host is a Cloudflare CDN that often 503s (and historically 403s when
 * the browser sends a foreign Referer). The same files are served stably from
 * codeforces.com/userpic/. Protocol-relative URLs are also rewritten to https.
 */
export function rewriteCodeforcesAvatarUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  let url = raw.trim();
  if (!url) return undefined;
  if (url.startsWith('//')) url = `https:${url}`;
  return url.replace(/^https?:\/\/userpic\.codeforces\.org\//i, 'https://codeforces.com/userpic/');
}

export function normalizeProfile(u: CfUser) {
  return {
    rating: u.rating,
    maxRating: u.maxRating,
    rank: u.rank,
    maxRank: u.maxRank,
    avatar: rewriteCodeforcesAvatarUrl(u.titlePhoto ?? u.avatar),
    country: u.country,
    organization: u.organization,
    friendOfCount: u.friendOfCount,
    contribution: u.contribution,
    registrationTime: u.registrationTimeSeconds ? new Date(u.registrationTimeSeconds * 1000) : undefined,
  };
}

export function normalizeRatingHistory(changes: CfRatingChange[]) {
  return [...changes]
    .sort((a, b) => a.ratingUpdateTimeSeconds - b.ratingUpdateTimeSeconds)
    .map((c) => ({
      contestId: c.contestId,
      contestName: c.contestName,
      rank: c.rank,
      oldRating: c.oldRating,
      newRating: c.newRating,
      at: new Date(c.ratingUpdateTimeSeconds * 1000),
    }));
}

/** Derive the platform URL from a stored problem key such as `codeforces:1352C`. */
export function urlFromProblemKey(key: string): string {
  const m = /^codeforces:(\d+)([A-Za-z].*)$/.exec(key);
  if (!m) return 'https://codeforces.com/problemset';
  return problemUrl(Number(m[1]), m[2]!);
}

/** Codeforces handles: 3–24 chars of letters, digits, `_`, `-`, `.`. */
export function isValidHandle(handle: string): boolean {
  return /^[A-Za-z0-9_.-]{3,24}$/.test(handle);
}
