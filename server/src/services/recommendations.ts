/**
 * Deterministic, explainable problem recommendation.
 *
 * Every score component is a small additive term with a human-readable reason.
 * No randomness, no LLM, no hidden weights — the same input always yields the
 * same ranked output, which makes the engine unit-testable.
 */

export interface CandidateProblem {
  key: string;
  name: string;
  url: string;
  rating?: number | null;
  tags: string[];
  solvedCount?: number | null;
}

export interface UserSignals {
  /** Problem keys with ≥1 accepted verdict. */
  solvedKeys: Set<string>;
  /** Problem keys attempted but never accepted. */
  unsolvedAttemptKeys: Set<string>;
  /** Estimated comfortable rating (e.g. avg of last 30 solved); null when unknown. */
  levelEstimate: number | null;
  /** Tags with friction (low solve rate) — from stats.practiceSignals. */
  frictionTags: Set<string>;
  /** Tags not practised for a while. */
  staleTags: Set<string>;
  /** Tags practised within the recent window. */
  recentTags: Set<string>;
  /** Tags derived from the user's stated learning goals (concept → codeforcesTags). */
  goalTags: Map<string, string>; // tag -> goal concept name
  /** Tags derived from graph frontier concepts (prereqs satisfied, not yet practised). */
  frontierTags: Map<string, string>; // tag -> frontier concept name
}

export interface ScoreReason {
  points: number;
  text: string;
  kind: 'difficulty' | 'comeback' | 'friction' | 'goal' | 'frontier' | 'momentum' | 'stale' | 'popularity' | 'metadata';
}

export interface Recommendation {
  problem: CandidateProblem;
  score: number;
  reasons: ScoreReason[];
  /** One-line headline reason (highest-weighted). */
  headline: string;
}

export interface RecommendOptions {
  limit?: number;
  /** Preferred difficulty offset above the level estimate. Default +150. */
  stretch?: number;
  /** Explicitly requested tag focus (from UI filter). */
  focusTags?: string[];
  includeSolved?: boolean;
}

const W = {
  difficultyMax: 30,
  comeback: 25,
  goal: 25,
  friction: 20,
  frontier: 15,
  stale: 10,
  momentum: 8,
  focus: 30,
  popularityMax: 6,
  noTags: -5,
} as const;

export function difficultyFit(rating: number, target: number): number {
  // Full marks within ±100 of target, decaying to 0 at ±500.
  const d = Math.abs(rating - target);
  if (d <= 100) return 1;
  if (d >= 500) return 0;
  return 1 - (d - 100) / 400;
}

export function scoreProblem(p: CandidateProblem, signals: UserSignals, opts: RecommendOptions = {}): Recommendation | null {
  if (!opts.includeSolved && signals.solvedKeys.has(p.key)) return null;

  const reasons: ScoreReason[] = [];
  const stretch = opts.stretch ?? 150;
  const focus = new Set((opts.focusTags ?? []).map((t) => t.toLowerCase()));

  // Hard filter: when the user asked for specific tags, require a match.
  if (focus.size > 0 && !p.tags.some((t) => focus.has(t))) return null;

  // Difficulty
  if (typeof p.rating === 'number' && p.rating > 0) {
    if (signals.levelEstimate !== null) {
      const target = signals.levelEstimate + stretch;
      const fit = difficultyFit(p.rating, target);
      const pts = Math.round(W.difficultyMax * fit);
      if (pts > 0) {
        const rel = p.rating > signals.levelEstimate + 50 ? 'a step above' : p.rating < signals.levelEstimate - 50 ? 'a little below' : 'right at';
        reasons.push({ kind: 'difficulty', points: pts, text: `Rated ${p.rating} — ${rel} your recent solving level (~${signals.levelEstimate}).` });
      } else {
        // Far from target: still allowed but gets no difficulty credit.
        reasons.push({ kind: 'difficulty', points: 0, text: `Rated ${p.rating}, far from your current level (~${signals.levelEstimate}).` });
      }
    } else {
      reasons.push({ kind: 'metadata', points: 0, text: `Rated ${p.rating}. Connect more history to calibrate difficulty.` });
    }
  } else {
    reasons.push({ kind: 'metadata', points: 0, text: 'Codeforces has not published a rating for this problem.' });
  }

  // Comeback
  if (signals.unsolvedAttemptKeys.has(p.key)) {
    reasons.push({ kind: 'comeback', points: W.comeback, text: 'You attempted this before without an accepted verdict — a comeback target.' });
  }

  // Tag-based signals (each category counted once per problem to avoid tag-count inflation)
  if (p.tags.length === 0) {
    reasons.push({ kind: 'metadata', points: W.noTags, text: 'No tag metadata, so topic fit is unknown.' });
  } else {
    const focusHit = p.tags.find((t) => focus.has(t));
    if (focusHit) reasons.push({ kind: 'goal', points: W.focus, text: `Matches your selected focus: ${focusHit}.` });

    const goalHit = p.tags.find((t) => signals.goalTags.has(t));
    if (goalHit) reasons.push({ kind: 'goal', points: W.goal, text: `Matches your learning goal “${signals.goalTags.get(goalHit)}”.` });

    const frictionHit = p.tags.find((t) => signals.frictionTags.has(t));
    if (frictionHit) reasons.push({ kind: 'friction', points: W.friction, text: `Practises ${frictionHit}, where your solve rate has been lower.` });

    const frontierHit = p.tags.find((t) => signals.frontierTags.has(t));
    if (frontierHit) reasons.push({ kind: 'frontier', points: W.frontier, text: `Next step in your knowledge graph: ${signals.frontierTags.get(frontierHit)}.` });

    const staleHit = p.tags.find((t) => signals.staleTags.has(t));
    if (staleHit) reasons.push({ kind: 'stale', points: W.stale, text: `Refreshes ${staleHit}, which you have not practised recently.` });

    const recentHit = p.tags.find((t) => signals.recentTags.has(t));
    if (recentHit && !frictionHit) reasons.push({ kind: 'momentum', points: W.momentum, text: `Builds on ${recentHit}, which you practised recently.` });
  }

  // Popularity tiebreak — well-known problems tend to be well-tested and educational.
  if (typeof p.solvedCount === 'number' && p.solvedCount > 0) {
    const pts = Math.min(W.popularityMax, Math.round(Math.log10(p.solvedCount)));
    if (pts > 0) reasons.push({ kind: 'popularity', points: pts, text: `Solved by ${p.solvedCount.toLocaleString()} people — a well-trodden problem.` });
  }

  const score = reasons.reduce((a, r) => a + r.points, 0);
  const sorted = [...reasons].sort((a, b) => b.points - a.points);
  const headline = sorted[0]?.text ?? 'Candidate problem.';
  return { problem: p, score, reasons: sorted, headline };
}

export function recommend(candidates: CandidateProblem[], signals: UserSignals, opts: RecommendOptions = {}): Recommendation[] {
  const limit = opts.limit ?? 10;
  const scored: Recommendation[] = [];
  for (const c of candidates) {
    const r = scoreProblem(c, signals, opts);
    if (r) scored.push(r);
  }
  // Deterministic ordering: score desc, then rating asc (easier first on ties), then key.
  scored.sort(
    (a, b) =>
      b.score - a.score || (a.problem.rating ?? 9999) - (b.problem.rating ?? 9999) || a.problem.key.localeCompare(b.problem.key),
  );
  return scored.slice(0, limit);
}

/**
 * Estimate a comfortable solving level from the most recent accepted
 * submissions' ratings. Returns null when nothing rated has been solved.
 */
export function estimateLevel(recentSolvedRatings: number[]): number | null {
  const rated = recentSolvedRatings.filter((r) => r > 0);
  if (rated.length === 0) return null;
  const sorted = [...rated].sort((a, b) => a - b);
  // Use the 70th percentile — reflects what the user *can* do, not just the easiest wins.
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.7));
  return Math.round(sorted[idx]! / 50) * 50;
}
