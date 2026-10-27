import { Types } from 'mongoose';
import { PlatformConnection } from '../../models/PlatformConnection.ts';
import { Problem } from '../../models/Problem.ts';
import { Submission } from '../../models/Submission.ts';
import { SyncRun } from '../../models/SyncRun.ts';
import { AppError } from '../../lib/errors.ts';
import { logger } from '../../config/logger.ts';
import { CodeforcesClient, codeforcesClient } from './client.ts';
import {
  dedupeSubmissions,
  isValidHandle,
  normalizeProblem,
  normalizeProfile,
  normalizeRatingHistory,
  normalizeSubmission,
  type NormalizedProblem,
  type NormalizedSubmission,
} from './normalize.ts';

const PAGE_SIZE = 1000;
/** Safety cap so a single sync cannot run for minutes on huge accounts. */
const MAX_PAGES_PER_SYNC = 8;

export interface SyncResult {
  handle: string;
  incremental: boolean;
  fetched: number;
  inserted: number;
  updated: number;
  skippedInvalid: number;
  truncated: boolean;
  lastSuccessfulSyncAt: Date;
}

/**
 * Fetch submissions newest-first, stopping once we pass the last id we already
 * have (incremental) or run out of pages.
 */
async function fetchSubmissions(
  client: CodeforcesClient,
  handle: string,
  stopAfterId: number | undefined,
): Promise<{ submissions: NormalizedSubmission[]; problems: NormalizedProblem[]; invalid: number; truncated: boolean }> {
  const all: NormalizedSubmission[] = [];
  const problems = new Map<string, NormalizedProblem>();
  let invalid = 0;
  let from = 1;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES_PER_SYNC; page += 1) {
    const { submissions, invalid: badCount } = await client.getSubmissions(handle, from, PAGE_SIZE);
    invalid += badCount;
    let reachedKnown = false;
    for (const raw of submissions) {
      if (stopAfterId !== undefined && raw.id <= stopAfterId) {
        reachedKnown = true;
        break;
      }
      all.push(normalizeSubmission(raw));
      const p = normalizeProblem(raw.problem);
      if (!problems.has(p.key)) problems.set(p.key, p);
    }
    if (reachedKnown || submissions.length + badCount < PAGE_SIZE) break;
    from += PAGE_SIZE;
    if (page === MAX_PAGES_PER_SYNC - 1) truncated = true;
  }

  return { submissions: dedupeSubmissions(all), problems: [...problems.values()], invalid, truncated };
}

export async function syncCodeforces(
  userId: string,
  handleInput: string,
  client: CodeforcesClient = codeforcesClient,
): Promise<SyncResult> {
  const handle = handleInput.trim();
  if (!isValidHandle(handle)) {
    throw AppError.badRequest('That does not look like a valid Codeforces handle.');
  }
  const uid = new Types.ObjectId(userId);

  // Verify handle exists before touching any stored state.
  const cfUser = await client.getUser(handle);
  const canonicalHandle = cfUser.handle;

  const existing = await PlatformConnection.findOne({ userId: uid, platform: 'codeforces' });
  const handleChanged = existing !== null && existing.handle.toLowerCase() !== canonicalHandle.toLowerCase();

  if (existing?.lastSyncStatus === 'running' && existing.lastSyncStartedAt && Date.now() - existing.lastSyncStartedAt.getTime() < 5 * 60_000) {
    throw AppError.conflict('A sync is already in progress for this account.');
  }

  const startedAt = new Date();
  const run = await SyncRun.create({
    userId: uid,
    platform: 'codeforces',
    handle: canonicalHandle,
    status: 'running',
    startedAt,
    incremental: Boolean(existing?.lastSubmissionId) && !handleChanged,
  });

  const connection =
    existing ??
    new PlatformConnection({ userId: uid, platform: 'codeforces', handle: canonicalHandle, lastSyncStatus: 'never' });

  // If the user switched handles, their previously imported history no longer
  // belongs to this connection — clear it so stats reflect the new handle.
  if (handleChanged) {
    await Submission.deleteMany({ userId: uid, platform: 'codeforces' });
    connection.lastSubmissionId = undefined;
    connection.submissionCount = 0;
    connection.ratingHistory = [] as unknown as typeof connection.ratingHistory;
  }

  connection.handle = canonicalHandle;
  connection.lastSyncStatus = 'running';
  connection.lastSyncStartedAt = startedAt;
  connection.lastSyncError = undefined;
  connection.profile = normalizeProfile(cfUser);
  await connection.save();

  try {
    const stopAfterId = connection.lastSubmissionId ?? undefined;
    const { submissions, problems, invalid, truncated } = await fetchSubmissions(client, canonicalHandle, stopAfterId);

    let ratingHistory: ReturnType<typeof normalizeRatingHistory> = [];
    try {
      ratingHistory = normalizeRatingHistory(await client.getRatingHistory(canonicalHandle));
    } catch (err) {
      // Rating history is non-critical; an unrated account or a transient error should not fail the import.
      logger.warn({ err, handle: canonicalHandle }, 'rating history unavailable');
    }

    let inserted = 0;
    let updated = 0;

    if (submissions.length > 0) {
      // Upsert problems referenced by these submissions (shared catalogue).
      const problemOps = problems.map((p) => ({
        updateOne: {
          filter: { key: p.key },
          update: { $set: { ...p } },
          upsert: true,
        },
      }));
      if (problemOps.length) await Problem.bulkWrite(problemOps, { ordered: false });

      const subOps = submissions.map((s) => ({
        updateOne: {
          filter: { userId: uid, platform: 'codeforces', platformSubmissionId: s.platformSubmissionId },
          update: { $set: { ...s, userId: uid } },
          upsert: true,
        },
      }));
      const res = await Submission.bulkWrite(subOps, { ordered: false });
      inserted = res.upsertedCount;
      updated = res.modifiedCount;
    }

    // Advance the incremental cursor to the newest id we have seen.
    const maxId = submissions.reduce((m, s) => Math.max(m, s.platformSubmissionId), connection.lastSubmissionId ?? 0);
    const count = await Submission.countDocuments({ userId: uid, platform: 'codeforces' });

    connection.lastSubmissionId = maxId > 0 ? maxId : undefined;
    connection.submissionCount = count;
    connection.ratingHistory = ratingHistory as unknown as typeof connection.ratingHistory;
    connection.lastSyncStatus = 'success';
    connection.lastSuccessfulSyncAt = new Date();
    await connection.save();

    run.status = 'success';
    run.finishedAt = new Date();
    run.fetched = submissions.length;
    run.inserted = inserted;
    run.updated = updated;
    run.skippedInvalid = invalid;
    await run.save();

    return {
      handle: canonicalHandle,
      incremental: run.incremental,
      fetched: submissions.length,
      inserted,
      updated,
      skippedInvalid: invalid,
      truncated,
      lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
    };
  } catch (err) {
    const message = err instanceof AppError ? err.message : 'Synchronisation failed unexpectedly.';
    connection.lastSyncStatus = 'failed';
    connection.lastSyncError = message;
    await connection.save();
    run.status = 'failed';
    run.finishedAt = new Date();
    run.error = message;
    await run.save();
    logger.error({ err, userId, handle: canonicalHandle }, 'codeforces sync failed');
    throw err;
  }
}

/** Refresh the shared Codeforces problem catalogue (used for recommendations). */
export async function refreshProblemCatalogue(client: CodeforcesClient = codeforcesClient): Promise<{ upserted: number; total: number }> {
  const { problems, problemStatistics } = await client.getProblemset();
  const solvedCounts = new Map<string, number>();
  for (const s of problemStatistics) {
    solvedCounts.set(`${s.contestId ?? 'x'}${s.index}`, s.solvedCount);
  }
  const ops = problems.map((p) => {
    const norm = normalizeProblem(p);
    const solvedCount = solvedCounts.get(norm.platformId);
    return {
      updateOne: {
        filter: { key: norm.key },
        update: { $set: { ...norm, ...(solvedCount !== undefined ? { solvedCount } : {}) } },
        upsert: true,
      },
    };
  });
  let upserted = 0;
  const CHUNK = 1000;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const res = await Problem.bulkWrite(ops.slice(i, i + CHUNK), { ordered: false });
    upserted += res.upsertedCount;
  }
  return { upserted, total: ops.length };
}
