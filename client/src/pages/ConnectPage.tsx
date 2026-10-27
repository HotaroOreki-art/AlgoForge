import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client.ts';
import type { Connection, SyncResult, SyncRun } from '../api/types.ts';
import { useFetch } from '../hooks/useFetch.ts';
import { useAuth } from '../auth/AuthContext.tsx';
import { useToast } from '../components/Toast.tsx';
import { ThemeSwitcher } from '../components/ThemeSwitcher.tsx';
import { formatDate, relativeTime } from '../components/ui.tsx';
import './ConnectPage.css';

export function validateHandle(h: string): string | null {
  const v = h.trim();
  if (!v) return 'Enter your Codeforces handle.';
  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(v)) return 'Handles are 3–24 letters, digits, "_", "-" or ".".';
  return null;
}

export function ConnectPage() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch<{ connection: Connection | null; runs: SyncRun[] }>('/api/platforms/codeforces');
  const catalogue = useFetch<{ total: number; lastUpdatedAt: string | null }>('/api/problems/catalogue');
  const [handle, setHandle] = useState('');
  const [touched, setTouched] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [refreshingCatalogue, setRefreshingCatalogue] = useState(false);
  const [goalsText, setGoalsText] = useState(user?.learningGoals.join(', ') ?? '');
  const [savingGoals, setSavingGoals] = useState(false);

  const connection = data?.connection ?? null;
  const handleError = validateHandle(handle);

  async function runSync(target?: string) {
    setSyncing(true);
    setSyncError(null);
    setLastResult(null);
    try {
      const res = await api<{ result: SyncResult; connection: Connection }>('/api/platforms/codeforces/sync', {
        method: 'POST',
        body: target ? { handle: target } : {},
      });
      setLastResult(res.result);
      reload();
      toast.push(
        res.result.inserted > 0 ? `Imported ${res.result.inserted} new submission${res.result.inserted === 1 ? '' : 's'} for ${res.result.handle}.` : `Already up to date for ${res.result.handle}.`,
        res.result.inserted > 0 ? 'celebrate' : 'ok',
      );
      // Kick off a catalogue refresh in the background on the first connection so recommendations have candidates.
      if (!connection && (catalogue.data?.total ?? 0) < 100) void refreshCatalogue(true);
    } catch (err) {
      setSyncError(errorMessage(err));
      reload();
    } finally {
      setSyncing(false);
    }
  }

  function onConnect(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (handleError) return;
    void runSync(handle.trim());
  }

  async function disconnect() {
    if (!confirm('Disconnect Codeforces and delete the imported history from AlgoForge? Your notes and saved problems are kept.')) return;
    try {
      await api<void>('/api/platforms/codeforces', { method: 'DELETE' });
      setLastResult(null);
      reload();
      toast.push('Codeforces disconnected.', 'ok');
    } catch (err) {
      toast.push(errorMessage(err), 'danger');
    }
  }

  async function refreshCatalogue(silent = false) {
    setRefreshingCatalogue(true);
    try {
      const res = await api<{ upserted: number; total: number }>('/api/problems/catalogue/refresh', { method: 'POST' });
      catalogue.reload();
      if (!silent) toast.push(`Catalogue refreshed: ${res.total.toLocaleString()} problems (${res.upserted} new).`, 'ok');
    } catch (err) {
      if (!silent) toast.push(errorMessage(err), 'danger');
    } finally {
      setRefreshingCatalogue(false);
    }
  }

  async function saveGoals(e: FormEvent) {
    e.preventDefault();
    setSavingGoals(true);
    try {
      const goals = goalsText
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean)
        .slice(0, 10);
      await updateProfile({ learningGoals: goals });
      toast.push('Learning goals saved — recommendations will use them.', 'ok');
    } catch (err) {
      toast.push(errorMessage(err), 'danger');
    } finally {
      setSavingGoals(false);
    }
  }

  return (
    <div className="connect rise">
      <header className="page-head">
        <div>
          <p className="eyebrow eyebrow--accent">connections · settings</p>
          <h1 className="page-head__title">Wire up your history.</h1>
          <p className="page-head__sub">Codeforces is the first platform. We only ask for your public handle — never a password — and import via the official API.</p>
        </div>
      </header>

      <div className="connect__grid">
        <section className="panel ticks connect__cf">
          <div className="panel__head">
            <span className="panel__title">Codeforces</span>
            {connection && <span className={`tag ${connection.lastSyncStatus === 'success' ? 'tag--ok' : connection.lastSyncStatus === 'failed' ? 'tag--danger' : ''}`}>{connection.lastSyncStatus}</span>}
          </div>

          {error && <div className="alert alert--danger">{error}</div>}
          {loading && !data && <div className="skeleton" style={{ height: 120 }} />}

          {data && !connection && (
            <form className="connect__form" onSubmit={onConnect} noValidate>
              <label className="field">
                <span className="field__label">Codeforces handle</span>
                <input
                  className="field__input mono"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="e.g. tourist"
                  aria-invalid={Boolean(touched && handleError)}
                  autoComplete="off"
                  spellCheck={false}
                  data-testid="cf-handle"
                />
                {touched && handleError && <span className="field__error">{handleError}</span>}
                <span className="field__hint">Imports take a few seconds — Codeforces asks for one request every two seconds, and we respect that.</span>
              </label>
              {syncError && (
                <div className="alert alert--danger" role="alert">
                  {syncError}
                </div>
              )}
              <button type="submit" className="btn btn--primary" disabled={syncing} data-testid="cf-connect">
                {syncing ? (
                  <>
                    <span className="spinner" /> Importing…
                  </>
                ) : (
                  'Connect & import'
                )}
              </button>
            </form>
          )}

          {connection && (
            <div className="connect__connected">
              <div className="connect__profile">
                {connection.profile?.avatar && (
                  <img
                    src={connection.profile.avatar}
                    alt=""
                    className="connect__avatar"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <a href={`https://codeforces.com/profile/${connection.handle}`} target="_blank" rel="noreferrer" className="connect__handle mono">
                    {connection.handle} ↗
                  </a>
                  <p className="muted" style={{ fontSize: '0.88rem' }}>
                    {connection.profile?.rank ?? 'unrated'} · rating {connection.profile?.rating ?? '—'} (max {connection.profile?.maxRating ?? '—'})
                    {connection.profile?.organization ? ` · ${connection.profile.organization}` : ''}
                  </p>
                </div>
              </div>

              <dl className="connect__facts">
                <div>
                  <dt>submissions stored</dt>
                  <dd className="num">{connection.submissionCount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>last successful sync</dt>
                  <dd>{relativeTime(connection.lastSuccessfulSyncAt)}</dd>
                </div>
                <div>
                  <dt>rated contests</dt>
                  <dd className="num">{connection.ratingHistory.length}</dd>
                </div>
              </dl>

              {connection.lastSyncStatus === 'failed' && (
                <div className="alert alert--warn" role="alert">
                  Last sync failed: {connection.lastSyncError}. Your previous import is intact.
                </div>
              )}
              {syncError && (
                <div className="alert alert--danger" role="alert">
                  {syncError}
                </div>
              )}
              {lastResult && (
                <div className="alert alert--ok" role="status">
                  {lastResult.incremental ? 'Incremental sync' : 'Full import'}: fetched {lastResult.fetched}, inserted {lastResult.inserted}, updated {lastResult.updated}
                  {lastResult.skippedInvalid ? `, skipped ${lastResult.skippedInvalid} malformed` : ''}
                  {lastResult.truncated ? ' — history is very long; run sync again to continue.' : '.'}
                </div>
              )}

              <div className="row row--wrap">
                <button type="button" className="btn btn--primary" onClick={() => runSync()} disabled={syncing}>
                  {syncing ? (
                    <>
                      <span className="spinner" /> Syncing…
                    </>
                  ) : (
                    'Sync now'
                  )}
                </button>
                <Link to="/" className="btn">
                  View signals
                </Link>
                <button type="button" className="btn btn--ghost btn--danger" onClick={disconnect}>
                  Disconnect
                </button>
              </div>

              <details className="connect__history">
                <summary className="eyebrow">sync history ({data?.runs.length ?? 0})</summary>
                <ul className="list">
                  {data?.runs.map((r) => (
                    <li key={r._id} className="connect__run">
                      <span className={`tag ${r.status === 'success' ? 'tag--ok' : r.status === 'failed' ? 'tag--danger' : ''}`}>{r.status}</span>
                      <span className="mono" style={{ fontSize: '0.8rem' }}>
                        {formatDate(r.startedAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="muted" style={{ fontSize: '0.85rem' }}>
                        {r.status === 'failed' ? r.error : `${r.incremental ? 'incremental' : 'full'} · +${r.inserted} new, ${r.updated} updated`}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>

              <details className="connect__history">
                <summary className="eyebrow">change handle</summary>
                <form className="connect__form" onSubmit={onConnect} noValidate style={{ marginTop: 12 }}>
                  <label className="field">
                    <span className="field__label">New handle</span>
                    <input className="field__input mono" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="another_handle" aria-invalid={Boolean(touched && handleError)} />
                    {touched && handleError && <span className="field__error">{handleError}</span>}
                    <span className="field__hint">Switching handles replaces the imported history with the new account’s.</span>
                  </label>
                  <button type="submit" className="btn" disabled={syncing}>
                    Switch & import
                  </button>
                </form>
              </details>
            </div>
          )}
        </section>

        <aside className="connect__side">
          <section className="panel ticks">
            <div className="panel__head">
              <span className="panel__title">Problem catalogue</span>
              <span className="faint mono">shared</span>
            </div>
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              The public Codeforces problemset (names, ratings, tags, links) powers the library and recommendations. Statements stay on Codeforces — we link, we don’t scrape.
            </p>
            <dl className="connect__facts" style={{ marginTop: 12 }}>
              <div>
                <dt>problems</dt>
                <dd className="num">{catalogue.data ? catalogue.data.total.toLocaleString() : '…'}</dd>
              </div>
              <div>
                <dt>updated</dt>
                <dd>{relativeTime(catalogue.data?.lastUpdatedAt ?? null)}</dd>
              </div>
            </dl>
            <button type="button" className="btn btn--sm" onClick={() => refreshCatalogue()} disabled={refreshingCatalogue} style={{ marginTop: 12 }}>
              {refreshingCatalogue ? (
                <>
                  <span className="spinner" /> Refreshing…
                </>
              ) : (
                'Refresh catalogue'
              )}
            </button>
          </section>

          <section className="panel ticks">
            <div className="panel__head">
              <span className="panel__title">Learning goals</span>
            </div>
            <form onSubmit={saveGoals} className="stack">
              <label className="field">
                <span className="field__label">Concepts or tags, comma-separated</span>
                <input className="field__input" value={goalsText} onChange={(e) => setGoalsText(e.target.value)} placeholder="dynamic-programming, graphs, binary search" />
                <span className="field__hint">Matching problems get a boost in your recommendations, with the goal named in the explanation.</span>
              </label>
              <button type="submit" className="btn btn--sm" disabled={savingGoals}>
                {savingGoals ? 'Saving…' : 'Save goals'}
              </button>
            </form>
          </section>

          <section className="panel ticks">
            <div className="panel__head">
              <span className="panel__title">Theme</span>
            </div>
            <ThemeSwitcher variant="cards" />
            <p className="faint" style={{ fontSize: '0.8rem', marginTop: 10 }}>
              Themes are design tokens over the same data. Switching never resets your state. Saved to your account.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
