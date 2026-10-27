import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFetch } from '../hooks/useFetch.ts';
import type { Dashboard, RatingChange, TopicDrilldown } from '../api/types.ts';
import { EmptyState, RatingPill, Stat, VerdictTag, formatDate, percent, relativeTime, verdictLabel } from '../components/ui.tsx';
import { useAuth } from '../auth/AuthContext.tsx';
import './DashboardPage.css';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch<Dashboard>('/api/dashboard');
  const [topic, setTopic] = useState<string | null>(null);

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <div className="stack">
        <div className="alert alert--danger" role="alert">
          {error}
        </div>
        <button className="btn" onClick={reload}>
          Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  const { stats, connection } = data;
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Late shift' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';

  return (
    <div className="dash rise">
      <header className="page-head">
        <div>
          <p className="eyebrow eyebrow--accent">01 · signals</p>
          <h1 className="page-head__title">
            {greeting}, {user?.displayName}.
          </h1>
          <p className="page-head__sub">
            {data.hasData ? (
              <>
                Observed facts from <strong>{connection?.handle}</strong> on Codeforces, synced {relativeTime(connection?.lastSuccessfulSyncAt)}. Statistics are computed from stored
                submissions; suggestions are inferred, not judged.
              </>
            ) : (
              'Nothing imported yet. Connect a Codeforces handle and this page becomes a map of your practice.'
            )}
          </p>
        </div>
        {connection?.lastSyncStatus === 'failed' && (
          <div className="alert alert--warn" role="status">
            Last sync failed: {connection.lastSyncError ?? 'unknown error'}. Showing the last successful import.{' '}
            <Link to="/connect">Retry</Link>
          </div>
        )}
      </header>

      {!data.hasData ? (
        <div className="dash__empty">
          <EmptyState
            title="Your coding universe is empty — for now"
            body={
              <>
                Link your Codeforces handle to import submissions, verdicts, ratings and tags. Only your public handle is needed. Until then you can still write in the{' '}
                <Link to="/vault">Vault</Link> and explore the <Link to="/graph">knowledge graph</Link>.
              </>
            }
            action={
              <Link to="/connect" className="btn btn--primary">
                Connect Codeforces
              </Link>
            }
          />
          <div className="dash__empty-side panel ticks">
            <p className="eyebrow">while you wait</p>
            <ul className="dash__hints">
              <li>
                <Link to="/vault">Write your first technique note</Link> — e.g. how you think about binary search bounds.
              </li>
              <li>
                <Link to="/graph">Open the graph</Link> and read why two pointers sits between sorting and sliding windows.
              </li>
              <li>
                <Link to="/library">Browse the library</Link> once the catalogue is loaded.
              </li>
            </ul>
            <p className="faint" style={{ fontSize: '0.8rem' }}>
              Notes: {data.counts.notes} · Saved problems: {data.counts.saved}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ---------- OBSERVED ---------- */}
          <section className="dash__tier">
            <TierLabel n="A" label="observed" note="imported from the platform" />
            <div className="dash__observed">
              <div className="panel ticks dash__profile">
                {connection?.profile?.avatar && (
                  <img
                    src={connection.profile.avatar}
                    alt=""
                    className="dash__avatar"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <p className="eyebrow">codeforces · {connection?.handle}</p>
                  <div className="dash__rating">
                    <span className="dash__rating-num num">{connection?.profile?.rating ?? '—'}</span>
                    <span className="dash__rank">{connection?.profile?.rank ?? 'unrated'}</span>
                  </div>
                  <p className="muted" style={{ fontSize: '0.85rem' }}>
                    peak {connection?.profile?.maxRating ?? '—'} · {stats.totalSubmissions.toLocaleString()} submissions · first {formatDate(stats.firstSubmissionAt)}
                  </p>
                </div>
              </div>
              <div className="panel ticks dash__ratingchart">
                <div className="panel__head">
                  <span className="panel__title">Contest rating</span>
                  <span className="faint mono">{connection?.ratingHistory.length ?? 0} rated contests</span>
                </div>
                {connection && connection.ratingHistory.length > 1 ? (
                  <RatingChart history={connection.ratingHistory} />
                ) : (
                  <p className="muted">Rating history appears after the account has rated contests.</p>
                )}
              </div>
            </div>
          </section>

          {/* ---------- COMPUTED ---------- */}
          <section className="dash__tier">
            <TierLabel n="B" label="computed" note="derived from stored submissions" />
            <div className="dash__stats panel ticks">
              <Stat label="unique solved" value={stats.uniqueProblemsSolved} tone="accent" hint={`${stats.uniqueProblemsAttempted} attempted`} />
              <Stat label="acceptance" value={percent(stats.acceptanceRate)} hint="per submission" />
              <Stat label="solved after a miss" value={stats.solvedAfterStruggle} hint="failed first, then accepted" tone="accent2" />
              <Stat label="unsolved attempts" value={stats.unsolvedAttempts} hint="comeback candidates" tone="accent3" />
              <Stat label="avg solved rating" value={stats.avgSolvedRating ?? '—'} hint={stats.maxSolvedRating ? `max ${stats.maxSolvedRating}` : `${stats.unratedSubmissions} unrated`} />
              <Stat label="active days" value={stats.activeDays} hint={`streak ${stats.currentStreakDays} · best ${stats.longestStreakDays}`} />
            </div>

            <div className="dash__grid">
              <div className="panel ticks dash__activity">
                <div className="panel__head">
                  <span className="panel__title">Weekly activity</span>
                  <span className="faint mono">submissions · accepted</span>
                </div>
                <ActivityChart data={stats.weeklyActivity} />
              </div>

              <div className="panel ticks dash__difficulty">
                <div className="panel__head">
                  <span className="panel__title">Difficulty spread</span>
                  <span className="faint mono">by published rating</span>
                </div>
                <DifficultyChart data={stats.ratingBuckets} />
              </div>

              <div className="panel ticks dash__verdicts">
                <div className="panel__head">
                  <span className="panel__title">Verdicts</span>
                </div>
                <ul className="dash__verdictlist">
                  {stats.verdicts.slice(0, 6).map((v) => (
                    <li key={v.verdict}>
                      <span className="dash__verdictname">{verdictLabel(v.verdict)}</span>
                      <span className="dash__verdictbar">
                        <i style={{ width: `${Math.max(2, v.share * 100)}%` }} className={v.verdict === 'OK' ? 'ok' : v.verdict === 'WRONG_ANSWER' ? 'danger' : 'warn'} />
                      </span>
                      <span className="num muted">{v.count}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="panel ticks dash__topics">
                <div className="panel__head">
                  <span className="panel__title">Topics practised</span>
                  <span className="faint mono">click to drill down</span>
                </div>
                <TopicSpectrum tags={stats.tags} active={topic} onPick={setTopic} />
              </div>
            </div>

            {topic && <TopicDrill tag={topic} onClose={() => setTopic(null)} />}
          </section>

          {/* ---------- INFERRED ---------- */}
          <section className="dash__tier">
            <TierLabel n="C" label="inferred" note="signals, not verdicts on you" />
            <div className="dash__grid dash__grid--2">
              <div className="panel ticks">
                <div className="panel__head">
                  <span className="panel__title">Might benefit from practice</span>
                  <Link to="/next" className="faint mono">
                    see recommendations →
                  </Link>
                </div>
                {data.signals.length === 0 ? (
                  <p className="muted">No signals yet — more history sharpens these.</p>
                ) : (
                  <ul className="dash__signals">
                    {data.signals.slice(0, 6).map((s) => (
                      <li key={s.tag}>
                        <span className={`tag ${s.kind === 'friction' ? 'tag--warn' : s.kind === 'stale' ? 'tag--accent3' : ''}`}>{s.kind}</span>
                        <div>
                          <button type="button" className="dash__signaltag" onClick={() => setTopic(s.tag)}>
                            {s.tag}
                          </button>
                          <p className="muted" style={{ fontSize: '0.86rem' }}>
                            {s.reason}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="panel ticks">
                <div className="panel__head">
                  <span className="panel__title">Recently touched</span>
                </div>
                <ul className="list dash__recent">
                  {data.recent.slice(0, 8).map((r) => (
                    <li key={r.problemKey}>
                      <Link to={`/library?q=${encodeURIComponent(r.problemName)}`} className="dash__recentname">
                        {r.problemName}
                      </Link>
                      <RatingPill rating={r.rating} />
                      <VerdictTag verdict={r.verdict} />
                      <span className="faint mono" style={{ fontSize: '0.75rem' }}>
                        {relativeTime(r.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function TierLabel({ n, label, note }: { n: string; label: string; note: string }) {
  return (
    <div className="tier">
      <span className="tier__n">{n}</span>
      <span className="tier__label">{label}</span>
      <span className="tier__note">{note}</span>
      <span className="tier__rule" />
    </div>
  );
}

function RatingChart({ history }: { history: RatingChange[] }) {
  const data = useMemo(() => history.map((h) => ({ at: new Date(h.at).getTime(), rating: h.newRating, name: h.contestName, rank: h.rank })), [history]);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="at" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v) => new Date(v).getFullYear().toString()} stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--line-strong)', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(v) => new Date(Number(v)).toLocaleDateString()}
          formatter={(value, _n, item) => [`${value} (rank ${(item.payload as { rank: number }).rank})`, (item.payload as { name: string }).name]}
        />
        <Area type="monotone" dataKey="rating" stroke="var(--accent)" strokeWidth={2} fill="url(#ratingFill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ActivityChart({ data }: { data: { week: string; submissions: number; solved: number }[] }) {
  const recent = data.slice(-40);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={recent} margin={{ top: 6, right: 6, left: -18, bottom: 0 }} barGap={1}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="week" stroke="var(--ink-3)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
        <YAxis stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--line-strong)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'var(--accent-soft)' }} />
        <Bar dataKey="submissions" fill="var(--line-strong)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="solved" fill="var(--accent)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DifficultyChart({ data }: { data: { rating: number; solved: number; attempted: number }[] }) {
  const rated = data.filter((d) => d.rating > 0);
  const unrated = data.find((d) => d.rating === -1);
  return (
    <>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={rated} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="rating" stroke="var(--ink-3)" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--line-strong)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'var(--accent-soft)' }} />
          <Bar dataKey="attempted" fill="var(--line-strong)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="solved" fill="var(--accent-2)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      {unrated && (
        <p className="faint" style={{ fontSize: '0.78rem', marginTop: 6 }}>
          + {unrated.attempted} problems with no published rating ({unrated.solved} solved) — shown separately, not as 0.
        </p>
      )}
    </>
  );
}

function TopicSpectrum({ tags, active, onPick }: { tags: Dashboard['stats']['tags']; active: string | null; onPick: (t: string) => void }) {
  const top = tags.slice(0, 14);
  const max = Math.max(1, ...top.map((t) => t.attempted));
  if (top.length === 0) return <p className="muted">No tagged problems yet.</p>;
  return (
    <ul className="spectrum">
      {top.map((t) => (
        <li key={t.tag}>
          <button type="button" className={`spectrum__row ${active === t.tag ? 'spectrum__row--active' : ''}`} onClick={() => onPick(t.tag)} data-testid={`topic-${t.tag}`}>
            <span className="spectrum__tag">{t.tag}</span>
            <span className="spectrum__bar">
              <i className="spectrum__attempted" style={{ width: `${(t.attempted / max) * 100}%` }} />
              <i className="spectrum__solved" style={{ width: `${(t.solved / max) * 100}%` }} />
            </span>
            <span className="spectrum__nums num">
              {t.solved}
              <span className="faint">/{t.attempted}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TopicDrill({ tag, onClose }: { tag: string; onClose: () => void }) {
  const { data, loading, error } = useFetch<TopicDrilldown>(`/api/dashboard/topic?tag=${encodeURIComponent(tag)}`);
  return (
    <div className="panel panel--raised ticks drill rise" role="region" aria-label={`Problems tagged ${tag}`}>
      <div className="panel__head">
        <div>
          <p className="eyebrow eyebrow--accent">topic · {tag}</p>
          <h3>
            {data ? (
              <>
                {data.solved} solved of {data.attempted} attempted · {data.totalSubmissions} submissions
              </>
            ) : (
              'Loading…'
            )}
          </h3>
        </div>
        <div className="row">
          <Link to={`/next?tags=${encodeURIComponent(tag)}`} className="btn btn--sm">
            Recommend {tag}
          </Link>
          <Link to={`/library?tags=${encodeURIComponent(tag)}`} className="btn btn--sm">
            In library
          </Link>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close drill-down">
            ✕
          </button>
        </div>
      </div>
      {error && <div className="alert alert--danger">{error}</div>}
      {loading && !data && <div className="skeleton" style={{ height: 80 }} />}
      {data && (
        <ul className="list drill__list">
          {data.problems.map((p) => (
            <li key={p.problemKey}>
              <span className={`drill__dot ${p.solved ? 'drill__dot--ok' : ''}`} aria-hidden="true" />
              <a href={p.url} target="_blank" rel="noreferrer" className="drill__name">
                {p.problemName}
              </a>
              <RatingPill rating={p.rating} />
              <span className="faint mono" style={{ fontSize: '0.75rem' }}>
                {p.attempts} attempt{p.attempts === 1 ? '' : 's'}
              </span>
              <span className="faint mono" style={{ fontSize: '0.75rem', marginLeft: 'auto' }}>
                {relativeTime(p.lastAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dash" aria-busy="true">
      <div className="skeleton" style={{ height: 56, width: '50%' }} />
      <div className="skeleton" style={{ height: 20, width: '70%', marginTop: 12 }} />
      <div className="dash__grid" style={{ marginTop: 32 }}>
        <div className="skeleton" style={{ height: 200 }} />
        <div className="skeleton" style={{ height: 200 }} />
        <div className="skeleton" style={{ height: 200 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    </div>
  );
}
