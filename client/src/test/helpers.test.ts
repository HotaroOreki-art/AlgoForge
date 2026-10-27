import { describe, expect, it } from 'vitest';
import { buildLibraryQuery } from '../pages/LibraryPage.tsx';
import { emptyNote, linesToList } from '../pages/VaultPage.tsx';
import { formatDate, percent, relativeTime } from '../components/ui.tsx';

describe('buildLibraryQuery', () => {
  it('forwards only known filters and always sets a limit', () => {
    const url = buildLibraryQuery(new URLSearchParams('q=two%20pointers&minRating=1200&evil=1&open=abc'));
    const qs = new URLSearchParams(url.split('?')[1]);
    expect(url.startsWith('/api/problems?')).toBe(true);
    expect(qs.get('q')).toBe('two pointers');
    expect(qs.get('minRating')).toBe('1200');
    expect(qs.get('limit')).toBe('30');
    expect(qs.has('evil')).toBe(false);
    expect(qs.has('open')).toBe(false); // UI-only state never reaches the API
  });
  it('drops empty values', () => {
    const url = buildLibraryQuery(new URLSearchParams('q=&tags=dp&page=2'));
    const qs = new URLSearchParams(url.split('?')[1]);
    expect(qs.has('q')).toBe(false);
    expect(qs.get('tags')).toBe('dp');
    expect(qs.get('page')).toBe('2');
  });
});

describe('vault helpers', () => {
  it('emptyNote returns a technique note with empty lists and honours overrides', () => {
    const n = emptyNote();
    expect(n.kind).toBe('technique');
    expect(n.checklist).toEqual([]);
    expect(n.pitfalls).toEqual([]);
    expect(n.conceptSlugs).toEqual([]);
    const m = emptyNote({ kind: 'postmortem', title: 'Off by one' });
    expect(m.kind).toBe('postmortem');
    expect(m.title).toBe('Off by one');
    expect(m.checklist).toEqual([]);
  });

  it('linesToList strips bullets and blank lines', () => {
    expect(linesToList('- first\n* second\n• third\n\n   \nfourth  ')).toEqual(['first', 'second', 'third', 'fourth']);
    expect(linesToList('')).toEqual([]);
  });
});

describe('ui formatters', () => {
  it('percent renders a dash for unknown values instead of NaN', () => {
    expect(percent(null)).toBe('—');
    expect(percent(undefined)).toBe('—');
    expect(percent(0)).toBe('0%');
    expect(percent(0.25)).toBe('25%');
  });
  it('relativeTime describes past instants', () => {
    const now = Date.now();
    expect(relativeTime(null)).toBe('never');
    expect(relativeTime(new Date(now - 10_000).toISOString())).toBe('just now');
    expect(relativeTime(new Date(now - 3 * 60_000).toISOString())).toBe('3 min ago');
    expect(relativeTime(new Date(now - 5 * 3_600_000).toISOString())).toBe('5 h ago');
    expect(relativeTime(new Date(now - 2 * 86_400_000).toISOString())).toBe('2 d ago');
  });
  it('formatDate returns a readable string and a dash for nothing', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('2026-01-15T12:00:00.000Z')).toMatch(/2026/);
  });
});
