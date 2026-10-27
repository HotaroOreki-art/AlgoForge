import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client.ts';
import type { Graph, Note, NoteInput, NoteKind } from '../api/types.ts';
import { useFetch } from '../hooks/useFetch.ts';
import { useToast } from '../components/Toast.tsx';
import { EmptyState, relativeTime } from '../components/ui.tsx';
import './VaultPage.css';

const KIND_LABEL: Record<NoteKind, string> = { technique: 'technique', postmortem: 'post-mortem', insight: 'insight' };

export function emptyNote(overrides: Partial<NoteInput> = {}): NoteInput {
  return {
    kind: 'technique',
    title: '',
    coreIdea: '',
    explanation: '',
    checklist: [],
    pitfalls: [],
    codeSnippet: '',
    codeLanguage: 'cpp',
    whatWentWrong: '',
    whyItFailed: '',
    whatILearned: '',
    rememberNextTime: '',
    conceptSlugs: [],
    problemKeys: [],
    tags: [],
    pinned: false,
    ...overrides,
  };
}

/** Lines → list, dropping blanks. Exported for tests. */
export function linesToList(s: string): string[] {
  return s
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
}

export function VaultPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [kind, setKind] = useState<NoteKind | ''>('');
  const [concept, setConcept] = useState(params.get('concept') ?? '');

  const listPath = useMemo(() => {
    const qs = new URLSearchParams();
    if (q.trim()) qs.set('q', q.trim());
    if (kind) qs.set('kind', kind);
    if (concept) qs.set('concept', concept);
    return `/api/notes?${qs.toString()}`;
  }, [q, kind, concept]);

  const { data, loading, error, setData } = useFetch<{ total: number; notes: Note[] }>(listPath);
  const graph = useFetch<Graph>('/api/graph');
  const creating = params.get('new') === '1';
  const selected = data?.notes.find((n) => n.id === id) ?? null;
  const detail = useFetch<{ note: Note }>(id && !selected ? `/api/notes/${id}` : null);
  const activeNote = selected ?? detail.data?.note ?? null;
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setEditing(false);
  }, [id]);

  async function remove(note: Note) {
    if (!confirm(`Delete “${note.title}”? This cannot be undone.`)) return;
    try {
      await api<void>(`/api/notes/${note.id}`, { method: 'DELETE' });
      setData((prev) => (prev ? { total: prev.total - 1, notes: prev.notes.filter((n) => n.id !== note.id) } : prev));
      toast.push('Note deleted.', 'ok');
      navigate('/vault');
    } catch (err) {
      toast.push(errorMessage(err), 'danger');
    }
  }

  async function togglePin(note: Note) {
    try {
      const res = await api<{ note: Note }>(`/api/notes/${note.id}`, { method: 'PUT', body: { pinned: !note.pinned } });
      setData((prev) => (prev ? { ...prev, notes: prev.notes.map((n) => (n.id === note.id ? res.note : n)) } : prev));
    } catch (err) {
      toast.push(errorMessage(err), 'danger');
    }
  }

  const concepts = graph.data?.nodes ?? [];

  return (
    <div className="vault rise">
      <header className="page-head">
        <div>
          <p className="eyebrow eyebrow--accent">03 · technique vault</p>
          <h1 className="page-head__title">Lessons, in your own words.</h1>
          <p className="page-head__sub">Techniques, post-mortems and insights. What went wrong, why, what you learned, what to remember next time. Nothing here is generated for you.</p>
        </div>
        <Link to="/vault?new=1" className="btn btn--primary" data-testid="new-note">
          + New note
        </Link>
      </header>

      <div className="vault__layout">
        <aside className="vault__side">
          <input className="input" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search notes" data-testid="vault-search" />
          <div className="row row--wrap" style={{ gap: 5 }}>
            {(['', 'technique', 'postmortem', 'insight'] as const).map((k) => (
              <button key={k || 'all'} type="button" className={`tag tag--button ${kind === k ? 'tag--active' : ''}`} onClick={() => setKind(k)}>
                {k ? KIND_LABEL[k] : 'all kinds'}
              </button>
            ))}
          </div>
          <select className="select" value={concept} onChange={(e) => setConcept(e.target.value)} aria-label="Filter by concept">
            <option value="">any concept</option>
            {concepts.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          {error && <div className="alert alert--danger">{error}</div>}
          {loading && !data && <div className="skeleton" style={{ height: 120 }} />}
          {data && data.notes.length === 0 && !creating && (
            <p className="muted" style={{ fontSize: '0.88rem' }}>
              {q || kind || concept ? 'No notes match these filters.' : 'No notes yet.'}
            </p>
          )}
          <ul className="vault__list">
            {(data?.notes ?? []).map((n) => (
              <li key={n.id}>
                <Link to={`/vault/${n.id}`} className={`notecard ${id === n.id ? 'notecard--active' : ''}`}>
                  <span className="notecard__kind">
                    {n.pinned && <span aria-label="pinned">📌 </span>}
                    {KIND_LABEL[n.kind]}
                  </span>
                  <span className="notecard__title">{n.title}</span>
                  {n.coreIdea && <span className="notecard__idea">{n.coreIdea}</span>}
                  <span className="notecard__meta">
                    {n.conceptSlugs.slice(0, 2).map((s) => (
                      <span key={s} className="tag">
                        {concepts.find((c) => c.slug === s)?.name ?? s}
                      </span>
                    ))}
                    <span className="faint mono" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>
                      {relativeTime(n.updatedAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <section className="vault__main">
          {creating ? (
            <NoteEditor
              initial={emptyNote({
                title: params.get('title') ?? '',
                problemKeys: params.get('problem') ? [params.get('problem')!] : [],
                conceptSlugs: params.get('concept') ? [params.get('concept')!] : [],
                kind: (params.get('kind') as NoteKind | null) ?? 'technique',
              })}
              concepts={concepts}
              onCancel={() => {
                const next = new URLSearchParams(params);
                next.delete('new');
                next.delete('title');
                next.delete('problem');
                setParams(next);
              }}
              onSaved={(note) => {
                setData((prev) => (prev ? { total: prev.total + 1, notes: [note, ...prev.notes] } : { total: 1, notes: [note] }));
                toast.push('Saved to your vault.', 'celebrate');
                navigate(`/vault/${note.id}`);
              }}
            />
          ) : activeNote && editing ? (
            <NoteEditor
              initial={activeNote}
              noteId={activeNote.id}
              concepts={concepts}
              onCancel={() => setEditing(false)}
              onSaved={(note) => {
                setData((prev) => (prev ? { ...prev, notes: prev.notes.map((n) => (n.id === note.id ? note : n)) } : prev));
                detail.setData(() => ({ note }));
                setEditing(false);
                toast.push('Note updated.', 'ok');
              }}
            />
          ) : activeNote ? (
            <NoteView note={activeNote} concepts={concepts} onEdit={() => setEditing(true)} onDelete={() => remove(activeNote)} onPin={() => togglePin(activeNote)} />
          ) : id && detail.loading ? (
            <div className="skeleton" style={{ height: 300 }} />
          ) : id && detail.error ? (
            <div className="alert alert--danger">{detail.error}</div>
          ) : (
            <EmptyState
              art="notebook"
              title={data && data.total > 0 ? 'Pick a note, or start a new one' : 'Your vault is empty'}
              body="Write a technique the way you would explain it to yourself in six months. Or file a post-mortem for the problem that got away."
              action={
                <Link to="/vault?new=1" className="btn btn--primary">
                  Write your first note
                </Link>
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}

function NoteView({ note, concepts, onEdit, onDelete, onPin }: { note: Note; concepts: Graph['nodes']; onEdit: () => void; onDelete: () => void; onPin: () => void }) {
  const nameOf = (slug: string) => concepts.find((c) => c.slug === slug)?.name ?? slug;
  return (
    <article className="noteview panel ticks">
      <header className="noteview__head">
        <div>
          <p className="eyebrow eyebrow--accent">
            {KIND_LABEL[note.kind]} · updated {relativeTime(note.updatedAt)}
          </p>
          <h2 className="noteview__title">{note.title}</h2>
        </div>
        <div className="row">
          <button className="btn btn--sm btn--ghost" onClick={onPin} aria-pressed={note.pinned}>
            {note.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button className="btn btn--sm" onClick={onEdit} data-testid="edit-note">
            Edit
          </button>
          <button className="btn btn--sm btn--ghost btn--danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </header>

      {(note.conceptSlugs.length > 0 || note.problemKeys.length > 0 || note.tags.length > 0) && (
        <div className="row row--wrap noteview__links">
          {note.conceptSlugs.map((s) => (
            <Link key={s} to={`/graph/${s}`} className="tag tag--button tag--accent">
              ◈ {nameOf(s)}
            </Link>
          ))}
          {note.problemKeys.map((k) => (
            <Link key={k} to={`/library?q=${encodeURIComponent(k.replace('codeforces:', ''))}`} className="tag tag--button">
              # {k.replace('codeforces:', '')}
            </Link>
          ))}
          {note.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      )}

      {note.coreIdea && (
        <section className="noteview__section noteview__core">
          <h4 className="eyebrow">core idea</h4>
          <p>{note.coreIdea}</p>
        </section>
      )}
      {note.explanation && (
        <section className="noteview__section">
          <h4 className="eyebrow">my explanation</h4>
          <p className="noteview__prose">{note.explanation}</p>
        </section>
      )}
      <div className="noteview__two">
        {note.checklist.length > 0 && (
          <section className="noteview__section">
            <h4 className="eyebrow">implementation checklist</h4>
            <ul className="noteview__check">
              {note.checklist.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </section>
        )}
        {note.pitfalls.length > 0 && (
          <section className="noteview__section">
            <h4 className="eyebrow">common pitfalls</h4>
            <ul className="noteview__pitfalls">
              {note.pitfalls.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {note.codeSnippet && (
        <section className="noteview__section">
          <h4 className="eyebrow">snippet · {note.codeLanguage}</h4>
          <pre className="noteview__code">
            <code>{note.codeSnippet}</code>
          </pre>
        </section>
      )}
      {(note.whatWentWrong || note.whyItFailed || note.whatILearned || note.rememberNextTime) && (
        <section className="noteview__section noteview__pm">
          <h4 className="eyebrow">post-mortem</h4>
          <dl>
            {note.whatWentWrong && (
              <div>
                <dt>What went wrong</dt>
                <dd>{note.whatWentWrong}</dd>
              </div>
            )}
            {note.whyItFailed && (
              <div>
                <dt>Why it failed</dt>
                <dd>{note.whyItFailed}</dd>
              </div>
            )}
            {note.whatILearned && (
              <div>
                <dt>What I learned</dt>
                <dd>{note.whatILearned}</dd>
              </div>
            )}
            {note.rememberNextTime && (
              <div>
                <dt>Remember next time</dt>
                <dd className="noteview__remember">{note.rememberNextTime}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </article>
  );
}

function NoteEditor({
  initial,
  noteId,
  concepts,
  onCancel,
  onSaved,
}: {
  initial: NoteInput | Note;
  noteId?: string;
  concepts: Graph['nodes'];
  onCancel: () => void;
  onSaved: (note: Note) => void;
}) {
  const [form, setForm] = useState<NoteInput>(() => emptyNote(initial));
  const [checklistText, setChecklistText] = useState(initial.checklist.join('\n'));
  const [pitfallsText, setPitfallsText] = useState(initial.pitfalls.join('\n'));
  const [tagsText, setTagsText] = useState(initial.tags.join(', '));
  const [problemsText, setProblemsText] = useState(initial.problemKeys.map((k) => k.replace('codeforces:', '')).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const titleError = form.title.trim() ? null : 'Give your note a title.';
  const set = <K extends keyof NoteInput>(k: K, v: NoteInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (titleError) return;
    const problemKeys = problemsText
      .split(',')
      .map((s) => s.trim().replace(/^codeforces:/, ''))
      .filter(Boolean)
      .filter((s) => /^[A-Za-z0-9]+$/.test(s))
      .map((s) => `codeforces:${s.toUpperCase()}`);
    const body: NoteInput = {
      ...form,
      title: form.title.trim(),
      checklist: linesToList(checklistText),
      pitfalls: linesToList(pitfallsText),
      tags: tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      problemKeys,
    };
    setSaving(true);
    try {
      const res = noteId
        ? await api<{ note: Note }>(`/api/notes/${noteId}`, { method: 'PUT', body })
        : await api<{ note: Note }>('/api/notes', { method: 'POST', body });
      onSaved(res.note);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function toggleConcept(slug: string) {
    set('conceptSlugs', form.conceptSlugs.includes(slug) ? form.conceptSlugs.filter((s) => s !== slug) : [...form.conceptSlugs, slug]);
  }

  const isPostmortem = form.kind === 'postmortem';

  return (
    <form className="editor panel ticks" onSubmit={submit} noValidate>
      <div className="editor__head">
        <div className="row" role="radiogroup" aria-label="Note kind">
          {(Object.keys(KIND_LABEL) as NoteKind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={form.kind === k} className={`tag tag--button ${form.kind === k ? 'tag--active' : ''}`} onClick={() => set('kind', k)}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="row">
          <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--sm btn--primary" disabled={saving} data-testid="save-note">
            {saving ? 'Saving…' : noteId ? 'Save changes' : 'Save note'}
          </button>
        </div>
      </div>

      <input
        className="editor__title"
        placeholder={isPostmortem ? 'What happened? e.g. “TLE on 1352C — wrong complexity”' : 'Technique title, e.g. “Binary search on the answer”'}
        value={form.title}
        onChange={(e) => set('title', e.target.value)}
        aria-label="Title"
        aria-invalid={Boolean(touched && titleError)}
        data-testid="note-title"
        autoFocus
      />
      {touched && titleError && <span className="field__error">{titleError}</span>}

      <label className="field">
        <span className="field__label">Core idea — one or two sentences</span>
        <textarea className="textarea" rows={2} value={form.coreIdea} onChange={(e) => set('coreIdea', e.target.value)} placeholder="The one thing to remember." data-testid="note-core" />
      </label>

      <label className="field">
        <span className="field__label">My explanation</span>
        <textarea className="textarea" rows={6} value={form.explanation} onChange={(e) => set('explanation', e.target.value)} placeholder="Explain it the way you'd explain it to yourself in six months." />
      </label>

      <div className="editor__two">
        <label className="field">
          <span className="field__label">Implementation checklist — one per line</span>
          <textarea className="textarea" rows={4} value={checklistText} onChange={(e) => setChecklistText(e.target.value)} placeholder={'Sort first\nCheck the invariant before the loop'} />
        </label>
        <label className="field">
          <span className="field__label">Common pitfalls — one per line</span>
          <textarea className="textarea" rows={4} value={pitfallsText} onChange={(e) => setPitfallsText(e.target.value)} placeholder={'Off-by-one on the right bound\nOverflow in mid = (lo+hi)/2'} />
        </label>
      </div>

      <div className="field">
        <span className="field__label">
          Code snippet
          <select className="editor__lang" value={form.codeLanguage} onChange={(e) => set('codeLanguage', e.target.value)} aria-label="Snippet language">
            <option value="cpp">C++</option>
            <option value="java">Java</option>
            <option value="python">Python</option>
            <option value="pseudo">pseudo</option>
          </select>
        </span>
        <textarea className="textarea textarea--code" rows={6} value={form.codeSnippet} onChange={(e) => set('codeSnippet', e.target.value)} spellCheck={false} placeholder="// the template you keep retyping" />
      </div>

      <details className="editor__pm" open={isPostmortem}>
        <summary className="eyebrow">post-mortem fields</summary>
        <div className="editor__two" style={{ marginTop: 12 }}>
          <label className="field">
            <span className="field__label">What went wrong</span>
            <textarea className="textarea" rows={3} value={form.whatWentWrong} onChange={(e) => set('whatWentWrong', e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Why the solution failed</span>
            <textarea className="textarea" rows={3} value={form.whyItFailed} onChange={(e) => set('whyItFailed', e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">What I learned</span>
            <textarea className="textarea" rows={3} value={form.whatILearned} onChange={(e) => set('whatILearned', e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">What to remember next time</span>
            <textarea className="textarea" rows={3} value={form.rememberNextTime} onChange={(e) => set('rememberNextTime', e.target.value)} />
          </label>
        </div>
      </details>

      <div className="field">
        <span className="field__label">Concepts</span>
        <div className="row row--wrap" style={{ gap: 5 }}>
          {concepts.map((c) => (
            <button key={c.slug} type="button" className={`tag tag--button ${form.conceptSlugs.includes(c.slug) ? 'tag--active' : ''}`} onClick={() => toggleConcept(c.slug)} aria-pressed={form.conceptSlugs.includes(c.slug)}>
              {c.name}
            </button>
          ))}
          {concepts.length === 0 && <span className="faint">Loading concepts…</span>}
        </div>
      </div>

      <div className="editor__two">
        <label className="field">
          <span className="field__label">Problems — Codeforces ids, comma-separated</span>
          <input className="field__input mono" value={problemsText} onChange={(e) => setProblemsText(e.target.value)} placeholder="1352C, 4A" />
        </label>
        <label className="field">
          <span className="field__label">Tags — comma-separated</span>
          <input className="field__input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="template, contest-mistake" />
        </label>
      </div>

      {error && (
        <div className="alert alert--danger" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
