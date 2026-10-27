import type { ReactNode } from 'react';
import './ui.css';

export function EmptyState({ title, body, action, art = 'orbit' }: { title: string; body: ReactNode; action?: ReactNode; art?: 'orbit' | 'notebook' | 'spark' }) {
  return (
    <div className="empty ticks">
      <div className={`empty__art empty__art--${art}`} aria-hidden="true">
        {art === 'orbit' && (
          <svg viewBox="0 0 120 120" width="96" height="96">
            <ellipse cx="60" cy="60" rx="52" ry="22" fill="none" stroke="var(--line-strong)" />
            <ellipse cx="60" cy="60" rx="52" ry="22" fill="none" stroke="var(--line)" transform="rotate(60 60 60)" />
            <ellipse cx="60" cy="60" rx="52" ry="22" fill="none" stroke="var(--line)" transform="rotate(-60 60 60)" />
            <circle cx="60" cy="60" r="7" fill="var(--accent)" />
            <circle cx="112" cy="60" r="3" fill="var(--accent-2)" />
            <circle cx="34" cy="15" r="3" fill="var(--accent-3)" />
          </svg>
        )}
        {art === 'notebook' && (
          <svg viewBox="0 0 120 120" width="96" height="96">
            <rect x="24" y="14" width="72" height="92" rx="6" fill="var(--surface-2)" stroke="var(--line-strong)" />
            <line x1="36" y1="34" x2="84" y2="34" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
            <line x1="36" y1="50" x2="78" y2="50" stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" />
            <line x1="36" y1="62" x2="84" y2="62" stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" />
            <line x1="36" y1="74" x2="66" y2="74" stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="88" cy="92" r="10" fill="var(--accent-2)" />
          </svg>
        )}
        {art === 'spark' && (
          <svg viewBox="0 0 120 120" width="96" height="96">
            <path d="M60 12 L68 50 L108 60 L68 70 L60 108 L52 70 L12 60 L52 50 Z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="60" cy="60" r="6" fill="var(--accent-2)" />
          </svg>
        )}
      </div>
      <h3 className="empty__title">{title}</h3>
      <p className="empty__body">{body}</p>
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'accent' | 'accent2' | 'accent3' }) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value num">{value}</span>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="row" style={{ gap: 8 }}>
      <span className="spinner" aria-hidden="true" />
      {label && <span className="muted">{label}</span>}
    </span>
  );
}

export function VerdictTag({ verdict }: { verdict: string }) {
  const cls = verdict === 'OK' ? 'tag--ok' : verdict === 'TESTING' ? '' : verdict === 'WRONG_ANSWER' ? 'tag--danger' : 'tag--warn';
  return <span className={`tag ${cls}`}>{verdictLabel(verdict)}</span>;
}

export function verdictLabel(v: string): string {
  const map: Record<string, string> = {
    OK: 'Accepted',
    WRONG_ANSWER: 'Wrong answer',
    TIME_LIMIT_EXCEEDED: 'Time limit',
    MEMORY_LIMIT_EXCEEDED: 'Memory limit',
    RUNTIME_ERROR: 'Runtime error',
    COMPILATION_ERROR: 'Compile error',
    IDLENESS_LIMIT_EXCEEDED: 'Idleness limit',
    CHALLENGED: 'Hacked',
    SKIPPED: 'Skipped',
    TESTING: 'Testing',
    PARTIAL: 'Partial',
    PRESENTATION_ERROR: 'Presentation error',
  };
  return map[v] ?? v.toLowerCase().replace(/_/g, ' ');
}

export function RatingPill({ rating }: { rating: number | null | undefined }) {
  if (rating === null || rating === undefined) return <span className="tag faint">unrated</span>;
  const tone = rating < 1200 ? 'tag--ok' : rating < 1600 ? 'tag--accent' : rating < 2100 ? 'tag--accent2' : 'tag--accent3';
  return <span className={`tag ${tone} num`}>{rating}</span>;
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, opts);
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return formatDate(iso);
}

export function percent(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n * 100)}%`;
}
