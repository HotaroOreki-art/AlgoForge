import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.ts';
import type { Problem, RecommendationResponse } from '../api/types.ts';
import { useFetch } from '../hooks/useFetch.ts';
import { useToast } from '../components/Toast.tsx';
import { EmptyState, RatingPill } from '../components/ui.tsx';
import './NextMovePage.css';

const STRETCH = [
  { v: 0, label: 'comfortable' },
  { v: 150, label: 'a step up' },
  { v: 300, label: 'ambitious' },
];

export function NextMovePage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const tags = params.get('tags') ?? '';
  const stretch = Number(params.get('stretch') ?? 150);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const path = useMemo(() => {
    const qs = new URLSearchParams({ limit: '8', stretch: String(stretch) });
    if (tags) qs.set('tags', tags);
    return `/api/recommendations?${qs.toString()}`;
  }, [tags, stretch]);

  const { data, loading, error, reload } = useFetch<RecommendationResponse>(path);

  function setParam(k: string, v: string | null) {
    const next = new URLSearchParams(params);
    if (v === null || v === '') next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  }

  async function save(key: string, name: string) {
    try {
      await api<{ problem: Problem }>(`/api/problems/${encodeURIComponent(key)}/save`, { method: 'PUT', body: { bookmarked: true, status: 'todo' } });
      setSaved((s) => new Set(s).add(key));
      toast.push(`Saved “${name}” to your library.`, 'ok');
    } catch (err) {
      toast.push(errorMessage(err), 'danger');
    }
  }

  const ctx = data?.context;

  return (
    <div className="nm rise">
      <header className="page-head">
        <div>
          <p className="eyebrow eyebrow--accent">05 · next move</p>
          <h1 className="page-head__title">What to solve next — and why.</h1>
          <p className="page-head__sub">
            Deterministic ranking over the problem catalogue using your solved set, past misses, topic friction, graph frontier and stated goals. Every pick shows its score breakdown. No
            model, no mystery.
          </p>
        </div>
        <div className="nm__controls">
          <div className="row" role="radiogroup" aria-label="Difficulty stretch">
            {STRETCH.map((s) => (
              <button key={s.v} type="button" role="radio" aria-checked={stretch === s.v} className={`tag tag--button ${stretch === s.v ? 'tag--active' : ''}`} onClick={() => setParam('stretch', String(s.v))}>
                {s.label}
              </button>
            ))}
          </div>
          <input className="input nm__tags" value={tags} onChange={(e) => setParam('tags', e.target.value)} placeholder="focus tags, e.g. dp, graphs" aria-label="Focus tags" data-testid="focus-tags" />
        </div>
      </header>

      {error && (
        <div className="alert alert--danger">
          {error}{' '}
          <button className="auth__link" onClick={reload}>
            retry
          </button>
        </div>
      )}

      {ctx && (
        <section className="nm__context panel ticks">
          <div className="nm__ctxitem">
            <span className="eyebrow">level estimate</span>
            <strong className="num">{ctx.levelEstimate ?? '—'}</strong>
            <span className="faint">{ctx.levelEstimate ? `targeting ~${ctx.levelEstimate + ctx.stretch}` : 'needs rated solves'}</span>
          </div>
          <div className="nm__ctxitem">
            <span className="eyebrow">solved · misses</span>
            <strong className="num">
              {ctx.solvedCount} · {ctx.unsolvedAttempts}
            </strong>
            <span className="faint">excluded · boosted</span>
          </div>
          <div className="nm__ctxitem">
            <span className="eyebrow">friction</span>
            <strong>{ctx.frictionTags.length ? ctx.frictionTags.slice(0, 3).join(', ') : '—'}</strong>
            <span className="faint">lower solve rate</span>
          </div>
          <div className="nm__ctxitem">
            <span className="eyebrow">frontier</span>
            <strong>{ctx.frontier.length ? ctx.frontier.slice(0, 2).join(', ') : '—'}</strong>
            <span className="faint">graph says: next</span>
          </div>
          <div className="nm__ctxitem">
            <span className="eyebrow">goals</span>
            <strong>{ctx.goalTags.length ? [...new Set(ctx.goalTags.map((g) => g.goal))].slice(0, 2).join(', ') : '—'}</strong>
            <Link to="/connect" className="faint">
              edit goals
            </Link>
          </div>
          <div className="nm__ctxitem">
            <span className="eyebrow">candidates</span>
            <strong className="num">{ctx.candidateCount}</strong>
            <span className="faint">from {ctx.catalogueSize.toLocaleString()} in catalogue</span>
          </div>
        </section>
      )}

      {ctx && ctx.missing.length > 0 && (
        <div className="alert alert--info" role="status">
          <span>
            {ctx.missing.includes('catalogue') && (
              <>
                The problem catalogue is empty, so there is nothing to rank yet. <Link to="/connect">Load it from Connect</Link>.{' '}
              </>
            )}
            {ctx.missing.includes('history') && (
              <>
                No imported history: difficulty is calibrated to a default ~1000 band and personal signals are off. <Link to="/connect">Connect Codeforces</Link> for tailored picks.
              </>
            )}
          </span>
        </div>
      )}

      {loading && !data && (
        <div className="nm__list">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120 }} />
          ))}
        </div>
      )}

      {data && data.recommendations.length === 0 && !loading && (
        <EmptyState
          art="spark"
          title="No candidates matched"
          body={tags ? `Nothing in the catalogue matches “${tags}” in your difficulty band. Try a broader tag or a different stretch.` : 'Load the catalogue from the Connect page to get recommendations.'}
          action={
            tags ? (
              <button className="btn" onClick={() => setParam('tags', null)}>
                Clear focus tags
              </button>
            ) : (
              <Link to="/connect" className="btn btn--primary">
                Go to Connect
              </Link>
            )
          }
        />
      )}

      {data && data.recommendations.length > 0 && (
        <ol className="nm__list">
          {data.recommendations.map((r, i) => (
            <li key={r.problem.key} className="rec panel ticks" data-testid="recommendation">
              <div className="rec__rank">
                <span className="rec__n mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="rec__score num" title="Total score — sum of the reasons below">
                  {r.score}
                </span>
              </div>
              <div className="rec__body">
                <div className="rec__title">
                  <a href={r.problem.url} target="_blank" rel="noreferrer" className="rec__name">
                    {r.problem.name} ↗
                  </a>
                  <RatingPill rating={r.problem.rating} />
                  <span className="faint mono" style={{ fontSize: '0.74rem' }}>
                    {r.problem.key.replace('codeforces:', '')}
                  </span>
                </div>
                <p className="rec__headline">{r.headline}</p>
                <ul className="rec__reasons">
                  {r.reasons.map((x, j) => (
                    <li key={j} className={`rec__reason rec__reason--${x.kind}`}>
                      <span className={`rec__pts num ${x.points < 0 ? 'rec__pts--neg' : x.points === 0 ? 'rec__pts--zero' : ''}`}>{x.points > 0 ? `+${x.points}` : x.points}</span>
                      <span>{x.text}</span>
                    </li>
                  ))}
                </ul>
                <div className="rec__tags">
                  {r.problem.tags.map((t) => (
                    <button key={t} type="button" className="tag tag--button" onClick={() => setParam('tags', t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rec__actions">
                <a href={r.problem.url} target="_blank" rel="noreferrer" className="btn btn--primary btn--sm">
                  Solve on CF
                </a>
                <button type="button" className="btn btn--sm" disabled={saved.has(r.problem.key)} onClick={() => save(r.problem.key, r.problem.name)}>
                  {saved.has(r.problem.key) ? 'Saved ✓' : 'Save'}
                </button>
                <Link to={`/vault?new=1&problem=${encodeURIComponent(r.problem.key)}&title=${encodeURIComponent(r.problem.name)}&kind=postmortem`} className="btn btn--ghost btn--sm">
                  Post-mortem
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
