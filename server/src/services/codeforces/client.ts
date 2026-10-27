import { z } from 'zod';
import { AppError } from '../../lib/errors.ts';
import { logger } from '../../config/logger.ts';
import {
  cfEnvelopeSchema,
  cfProblemsetSchema,
  cfRatingChangeSchema,
  cfSubmissionSchema,
  cfUserSchema,
  type CfRatingChange,
  type CfSubmission,
  type CfUser,
} from './types.ts';

const BASE_URL = 'https://codeforces.com/api';

/** Codeforces asks clients not to exceed ~1 request per 2 seconds. */
const MIN_INTERVAL_MS = 2000;
const REQUEST_TIMEOUT_MS = 20000;

export type Fetcher = typeof fetch;

export class CodeforcesError extends AppError {
  constructor(status: number, code: string, message: string) {
    super(status, code, message);
    this.name = 'CodeforcesError';
  }
}

export interface CodeforcesClientOptions {
  fetcher?: Fetcher;
  minIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class CodeforcesClient {
  private readonly fetcher: Fetcher;
  private readonly minIntervalMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastRequestAt = 0;

  constructor(opts: CodeforcesClientOptions = {}) {
    this.fetcher = opts.fetcher ?? fetch;
    this.minIntervalMs = opts.minIntervalMs ?? MIN_INTERVAL_MS;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private async pace() {
    const now = Date.now();
    const wait = this.lastRequestAt + this.minIntervalMs - now;
    if (wait > 0) await this.sleep(wait);
    this.lastRequestAt = Date.now();
  }

  private async call<T>(method: string, params: Record<string, string | number>, schema: z.ZodType<T>): Promise<T> {
    await this.pace();
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]): [string, string] => [k, String(v)]));
    const url = `${BASE_URL}/${method}?${qs.toString()}`;
    logger.debug({ method, params }, 'codeforces request');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetcher(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    } catch (err) {
      const aborted = (err as { name?: string }).name === 'AbortError';
      throw new CodeforcesError(
        504,
        aborted ? 'CF_TIMEOUT' : 'CF_UNREACHABLE',
        aborted ? 'Codeforces took too long to respond. Please try again later.' : 'Could not reach Codeforces. Please try again later.',
      );
    } finally {
      clearTimeout(timer);
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      if (res.status === 503 || res.status === 429) {
        throw new CodeforcesError(503, 'CF_UNAVAILABLE', 'Codeforces is temporarily unavailable or rate limiting requests.');
      }
      throw new CodeforcesError(502, 'CF_BAD_RESPONSE', 'Codeforces returned an unreadable response.');
    }

    const envelope = cfEnvelopeSchema.safeParse(json);
    if (!envelope.success) {
      throw new CodeforcesError(502, 'CF_BAD_RESPONSE', 'Codeforces returned an unexpected response format.');
    }
    if (envelope.data.status === 'FAILED') {
      const comment = envelope.data.comment ?? '';
      if (/not found/i.test(comment)) {
        throw new CodeforcesError(404, 'CF_HANDLE_NOT_FOUND', 'No Codeforces user exists with that handle.');
      }
      if (/limit exceeded|too many/i.test(comment)) {
        throw new CodeforcesError(429, 'CF_RATE_LIMITED', 'Codeforces is rate limiting requests. Try again in a minute.');
      }
      throw new CodeforcesError(502, 'CF_FAILED', `Codeforces rejected the request${comment ? `: ${comment}` : '.'}`);
    }

    const parsed = schema.safeParse(envelope.data.result);
    if (!parsed.success) {
      logger.warn({ method, issues: parsed.error.issues.slice(0, 3) }, 'codeforces result failed validation');
      throw new CodeforcesError(502, 'CF_BAD_RESPONSE', 'Codeforces returned data in an unexpected shape.');
    }
    return parsed.data;
  }

  async getUser(handle: string): Promise<CfUser> {
    const users = await this.call('user.info', { handles: handle }, z.array(cfUserSchema));
    const user = users[0];
    if (!user) throw new CodeforcesError(404, 'CF_HANDLE_NOT_FOUND', 'No Codeforces user exists with that handle.');
    return user;
  }

  /**
   * Submissions are returned newest-first. Individual malformed entries are
   * dropped (and counted) rather than failing the whole import.
   */
  async getSubmissions(handle: string, from = 1, count = 1000): Promise<{ submissions: CfSubmission[]; invalid: number }> {
    const raw = await this.call('user.status', { handle, from, count }, z.array(z.unknown()));
    const submissions: CfSubmission[] = [];
    let invalid = 0;
    for (const item of raw) {
      const parsed = cfSubmissionSchema.safeParse(item);
      if (parsed.success) submissions.push(parsed.data);
      else invalid += 1;
    }
    return { submissions, invalid };
  }

  async getRatingHistory(handle: string): Promise<CfRatingChange[]> {
    return this.call('user.rating', { handle }, z.array(cfRatingChangeSchema));
  }

  async getProblemset() {
    return this.call('problemset.problems', {}, cfProblemsetSchema);
  }
}

export const codeforcesClient = new CodeforcesClient();
