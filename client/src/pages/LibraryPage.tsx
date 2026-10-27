import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.ts';
import type { PracticeStatus, Problem, ProblemDetail, ProblemList } from '../api/types.ts';
import { useFetch } from '../hooks/useFetch.ts';
import { useToast } from '../components/Toast.tsx';
import { EmptyState, RatingPill, VerdictTag, formatDate, relativeTime } from '../components/ui.tsx';
import './LibraryPage.css';

const STATUS_LABEL: Record<PracticeStatus, string> = { todo: 'to do', attempting: 'attempting', solved: 'solved', revisit: 'revisit' };

export function buildLibraryQuery(params: URLSearchParams): string {
  const qs = new URLSearchParams();
  for (const k of ['q', 'tags', 'minRating', 'maxRating', 'saved', 'status', 'revision', 'solved', 'sort', 'page']) {
    const v = params.get(k);
    if (v) qs.set(k, v);
  }
  if (!qs.get('limit')) qs.set('limit', '30');
  return `/api/problems?${qs.toString()}`;
}

export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [qInput, setQInput] = useState(params.get('q') ?? '');
  const [selected, setSelected] = useState<string | null>(params.get('open'));

  const path = useMemo(() => buildLibraryQuery(params), [params]);
  const { data, loading, error, setData, reload } = useFetch<ProblemList>(path);
  const tags = useFetch<{ tags: { tag: string; count: number }[] }>('/api/problems/tags');
  const catalogue = useFetch<{ total: number }>('/api/problems/catalogue');

  // Debounced search box → URL
  useEffect(() => {
    const t = setTimeout(() => {
      const current = params.get('q') ?? '';
      if (qInput.trim() !== current) {
        setParam('q', qInput.trim() || null, true);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  function setParam(key: string, value: string | null, resetPage = true) {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  }

  function toggleTag(tag: string) {
    const current = (params.get('tags') ?? '').split(',').filter(Boolean);
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    setParam('tags', next.join(',') || null);
  }

  const activeTags = (params.get('tags') ?? '').split(',').filter(Boolean);
  const page = Number(params.get('page') ?? 1);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  async function patchSave(p: Problem, patch: Partial<{ bookmarked: boolean; markedForRevision: boolean; status: PracticeStatus }>) {
    try {
      const res = await api<{ problem: Problem }>(`/api/problems/${encodeURIComponent(p.key)}/save`, { method: 'PUT', body: patch });
      setData((prev) => (prev ? { ...prev, problems: prev.problems.map((x) => (x.key === p.key ? res.problem : x)) } : prev));
      if (patch.status === 'solved') toast.push(`Marked “${p.name}” as solved. Nice.`, 'celebrate');
      else if (!p.user.saved) toast.push(`Saved “${p.name}” to your library.`, 'ok');
    } catch (err) {
      toast.push(errorMessage(err), 'danger');
    }
  }

  async function unsave(p: Problem) {
    try {
      await api<void>(`/api/problems/${encodeURIComponent(p.key)}/save`, { method: 'DELETE' });
      setData((prev) =>
        prev
          ? {
              ...prev,
              problems: prev.problems.map((x) =>
                x.key === p.key ? { ...x, user: { ...x.user, saved: false, bookmarked: false, markedForRevision: false, status: x.user.solvedOnPlatform ? 'solved' : null } } : x,
              ),
            }
          : prev,
      );
    } catch (err) {
      toast.push(errorMessage(err), 'danger');
    }
  }

  const catalogueEmpty = catalogue.data && catalogue.data.total === 0;

  return (
    <div className="lib rise">
      <header className="page-head">
        <div>
          <p className="eyebrow eyebrow--accent">02 · library</p>
          <h1 className="page-head__title">Problems, filed your way.</h1>
          <p className="page-head__sub">Search the Codeforces catalogue, save what matters, mark what to revisit. Statements open on the original platform.</p>
        </div>
        <div className="lib__quick">
          <FilterChip active={params.get('saved') === 'true'} onClick={() => setParam('saved', params.get('saved') === 'true' ? null : 'true')}>
            saved
          </FilterChip>
          <FilterChip active={params.get('revision') === 'true'} onClick={() => setParam('revision', params.get('revision') === 'true' ? null : 'true')}>
            revisit
          </FilterChip>
          <FilterChip active={params.get('solved') === 'false'} onClick={() => setParam('solved', params.get('solved') === 'false' ? null : 'false')}>
            unsolved only
          </FilterChip>
        </div>
      </header>

      {catalogueEmpty ? (
        <EmptyState
          art="spark"
          title="The catalogue hasn’t been loaded yet"
          body="The library draws on the public Codeforces problemset. Load it once from the Connect page (it is shared across accounts and refreshed on demand)."
          action={
            <Link to="/connect" className="btn btn--primary">
              Go to Connect
            </Link>
          }
        />
      ) : (
        <div className="lib__layout">
          <aside className="lib__filters">
            <label className="field">
              <span className="field__label">Search</span>
              <input className="field__input" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="name or id, e.g. 1352C" data-testid="library-search" />
            </label>

            <div className="field">
              <span className="field__label">Rating</span>
              <div className="row">
                <input
                  className="field__input num"
                  type="number"
                  min={800}
                  max={3500}
                  step={100}
                  placeholder="min"
                  value={params.get('minRating') ?? ''}
                  onChange={(e) => setParam('minRating', e.target.value || null)}
                  aria-label="Minimum rating"
                />
                <span className="faint">–</span>
                <input
                  className="field__input num"
                  type="number"
                  min={800}
                  max={3500}
                  step={100}
                  placeholder="max"
                  value={params.get('maxRating') ?? ''}
                  onChange={(e) => setParam('maxRating', e.target.value || null)}
                  aria-label="Maximum rating"
                />
              </div>
            </div>

            <label className="field">
              <span className="field__label">My status</span>
              <select className="select" value={params.get('status') ?? ''} onChange={(e) => setParam('status', e.target.value || null)}>
                <option value="">any</option>
                {(Object.keys(STATUS_LABEL) as PracticeStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Sort</span>
              <select className="select" value={params.get('sort') ?? 'popular'} onChange={(e) => setParam('sort', e.target.value)}>
                <option value="popular">most solved</option>
                <option value="rating">rating ↑</option>
                <option value="-rating">rating ↓</option>
                <option value="recent">newest contests</option>
                <option value="name">name</option>
              </select>
            </label>

            <div className="field">
              <span className="field__label">
                Tags {activeTags.length > 0 && <button className="auth__link lib__clear" type="button" onClick={() => setParam('tags', null)}>clear</button>}
              </span>
              <div className="lib__tags">
                {(tags.data?.tags ?? []).slice(0, 36).map((t) => (
                  <button key={t.tag} type="button" className={`tag tag--button ${activeTags.includes(t.tag) ? 'tag--active' : ''}`} onClick={() => toggleTag(t.tag)}>
                    {t.tag}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="lib__results" aria-live="polite">
            <div className="lib__meta">
              <span className="muted">{data ? <>{data.total.toLocaleString()} problems</> : loading ? 'Searching…' : ''}</span>
              {totalPages > 1 && (
                <span className="row">
                  <button className="btn btn--sm btn--ghost" disabled={page <= 1} onClick={() => setParam('page', String(page - 1), false)}>
                    ← prev
                  </button>
                  <span className="mono faint">
                    {page} / {totalPages}
                  </span>
                  <button className="btn btn--sm btn--ghost" disabled={page >= totalPages} onClick={() => setParam('page', String(page + 1), false)}>
                    next →
                  </button>
                </span>
              )}
            </div>

            {error && (
              <div className="alert alert--danger">
                {error}{' '}
                <button className="auth__link" onClick={reload}>
                  retry
                </button>
              </div>
            )}

            {data && data.problems.length === 0 && !loading && (
              <EmptyState art="spark" title="Nothing matches" body="Loosen a filter or two. Saved and revisit filters only show problems you have filed yourself." />
            )}

            <ul className="lib__list">
              {(data?.problems ?? []).map((p) => (
                <li key={p.key} className={`prob ${selected === p.key ? 'prob--open' : ''}`}>
                  <button type="button" className="prob__main" onClick={() => setSelected(selected === p.key ? null : p.key)} aria-expanded={selected === p.key}>
                    <span className="prob__id mono">{p.platformId}</span>
                    <span className="prob__name">{p.name}</span>
                    <RatingPill rating={p.rating} />
                    <span className="prob__tags">
                      {p.tags.slice(0, 3).map((t) => (
                        <span key={t} className="tag">
                          {t}
                        </span>
                      ))}
                      {p.tags.length > 3 && <span className="faint mono">+{p.tags.length - 3}</span>}
                    </span>
                    <span className="prob__state">
                      {p.user.solvedOnPlatform && <span className="tag tag--ok">accepted</span>}
                      {!p.user.solvedOnPlatform && p.user.attemptedOnPlatform && <span className="tag tag--warn">attempted</span>}
                      {p.user.markedForRevision && <span className="tag tag--accent3">revisit</span>}
                      {p.user.notes > 0 && <span className="tag">{p.user.notes} note{p.user.notes === 1 ? '' : 's'}</span>}
                    </span>
                  </button>
                  <div className="prob__actions">
                    <button
                      type="button"
                      className={`iconbtn ${p.user.saved ? 'iconbtn--on' : ''}`}
                      title={p.user.saved ? 'Remove from library' : 'Save to library'}
                      aria-label={p.user.saved ? 'Remove from library' : 'Save to library'}
                      aria-pressed={p.user.saved}
                      onClick={() => (p.user.saved ? unsave(p) : patchSave(p, { bookmarked: true }))}
                    >
                      {p.user.saved ? '★' : '☆'}
                    </button>
                    <a href={p.url} target="_blank" rel="noreferrer" className="iconbtn" title="Open on Codeforces" aria-label="Open on Codeforces">
                      ↗
                    </a>
                  </div>
                  {selected === p.key && <ProblemDrawer problem={p} onPatch={(patch) => patchSave(p, patch)} />}
                </li>
              ))}
              {loading && !data && [1, 2, 3, 4, 5, 6].map((i) => <li key={i} className="skeleton" style={{ height: 52, marginBottom: 6 }} />)}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`tag tag--button ${active ? 'tag--active' : ''}`} onClick={onClick} aria-pressed={active}>
      {children}
    </button>
  );
}

function ProblemDrawer({ problem, onPatch }: { problem: Problem; onPatch: (patch: Partial<{ markedForRevision: boolean; status: PracticeStatus }>) => void }) {
  const { data, loading, error } = useFetch<ProblemDetail>(`/api/problems/${encodeURIComponent(problem.key)}`);
  return (
    <div className="drawer rise">
      <div className="drawer__cols">
        <div className="drawer__col">
          <p className="eyebrow">practice status</p>
          <div className="row row--wrap" style={{ marginTop: 6 }}>
            {(Object.keys(STATUS_LABEL) as PracticeStatus[]).map((s) => (
              <button key={s} type="button" className={`tag tag--button ${problem.user.status === s ? 'tag--active' : ''}`} onClick={() => onPatch({ status: s })} aria-pressed={problem.user.status === s}>
                {STATUS_LABEL[s]}
              </button>
            ))}
            <button
              type="button"
              className={`tag tag--button ${problem.user.markedForRevision ? 'tag--active' : ''}`}
              onClick={() => onPatch({ markedForRevision: !problem.user.markedForRevision })}
              aria-pressed={problem.user.markedForRevision}
            >
              {problem.user.markedForRevision ? '✓ marked for revision' : 'mark for revision'}
            </button>
          </div>

          <p className="eyebrow" style={{ marginTop: 16 }}>
            all tags
          </p>
          <div className="row row--wrap" style={{ marginTop: 6 }}>
            {problem.tags.length === 0 && <span className="faint">No tags published.</span>}
            {problem.tags.map((t) => (
              <Link key={t} to={`/library?tags=${encodeURIComponent(t)}`} className="tag tag--button">
                {t}
              </Link>
            ))}
          </div>
          <p className="faint" style={{ fontSize: '0.8rem', marginTop: 12 }}>
            {problem.solvedCount !== null ? `Solved by ${problem.solvedCount.toLocaleString()} people on Codeforces.` : 'Solve count not published.'} Statement:{' '}
            <a href={problem.url} target="_blank" rel="noreferrer">
              open on Codeforces ↗
            </a>
          </p>
        </div>

        <div className="drawer__col">
          <p className="eyebrow">your submissions</p>
          {loading && !data && <div className="skeleton" style={{ height: 40, marginTop: 6 }} />}
          {error && <div className="alert alert--danger">{error}</div>}
          {data && data.submissions.length === 0 && <p className="muted" style={{ marginTop: 6 }}>None imported for this problem.</p>}
          {data && data.submissions.length > 0 && (
            <ul className="list" style={{ marginTop: 6 }}>
              {data.submissions.slice(0, 6).map((s) => (
                <li key={s.id} className="row" style={{ padding: '6px 0', fontSize: '0.85rem' }}>
                  <VerdictTag verdict={s.verdict} />
                  <span className="muted">{s.language}</span>
                  <span className="faint mono" style={{ marginLeft: 'auto' }}>
                    {formatDate(s.submittedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="eyebrow" style={{ marginTop: 16 }}>
            your notes
          </p>
          {data && data.notes.length === 0 && (
            <p className="muted" style={{ marginTop: 6 }}>
              No notes yet.{' '}
              <Link to={`/vault?new=1&problem=${encodeURIComponent(problem.key)}&title=${encodeURIComponent(problem.name)}`}>Write one →</Link>
            </p>
          )}
          {data && data.notes.length > 0 && (
            <ul className="list" style={{ marginTop: 6 }}>
              {data.notes.map((n) => (
                <li key={n.id} className="row" style={{ padding: '6px 0', fontSize: '0.9rem' }}>
                  <Link to={`/vault/${n.id}`}>{n.title}</Link>
                  <span className="faint mono" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>
                    {relativeTime(n.updatedAt)}
                  </span>
                </li>
              ))}
              <li style={{ padding: '6px 0' }}>
                <Link to={`/vault?new=1&problem=${encodeURIComponent(problem.key)}&title=${encodeURIComponent(problem.name)}`} className="faint">
                  + another note
                </Link>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
