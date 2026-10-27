import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ConceptDetail, Graph } from '../api/types.ts';
import { useFetch } from '../hooks/useFetch.ts';
import { EDGE_LEGEND, KnowledgeGraph } from '../components/KnowledgeGraph.tsx';
import { RatingPill, relativeTime } from '../components/ui.tsx';
import './GraphPage.css';

export function GraphPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch<Graph>('/api/graph');
  const detail = useFetch<ConceptDetail>(slug ? `/api/graph/${slug}` : null);

  const selectedNode = data?.nodes.find((n) => n.slug === slug) ?? null;

  return (
    <div className="gp rise">
      <header className="page-head">
        <div>
          <p className="eyebrow eyebrow--accent">04 · knowledge graph</p>
          <h1 className="page-head__title">How the techniques connect.</h1>
          <p className="page-head__sub">
            Every edge has a reason. Arrows mean “learn this first”; dashed lines mean “often used together”. Node size reflects problems you have solved in that area; a dashed ring marks your
            frontier — prerequisites met, not yet practised.
          </p>
        </div>
        <ul className="gp__legend" aria-label="Edge legend">
          {EDGE_LEGEND.map((l) => (
            <li key={l.type}>
              <svg width="34" height="10" aria-hidden="true">
                <line x1="0" y1="5" x2="34" y2="5" className={`kg__edge kg__edge--${l.type}`} style={{ opacity: 1 }} />
              </svg>
              {l.label}
            </li>
          ))}
          <li>
            <span className="gp__ringlegend" aria-hidden="true" />
            frontier
          </li>
          <li>
            <span className="gp__notelegend" aria-hidden="true" />
            has notes
          </li>
        </ul>
      </header>

      {error && (
        <div className="alert alert--danger">
          {error}{' '}
          <button className="auth__link" onClick={reload}>
            retry
          </button>
        </div>
      )}

      <div className={`gp__layout ${slug ? 'gp__layout--detail' : ''}`}>
        <div className="gp__canvas">
          {loading && !data && <div className="skeleton" style={{ height: 560 }} />}
          {data && <KnowledgeGraph nodes={data.nodes} edges={data.edges} selected={slug ?? null} onSelect={(s) => navigate(s ? `/graph/${s}` : '/graph')} />}
          {data && !slug && (
            <p className="faint gp__hint">
              {data.nodes.length} concepts · {data.edges.length} explained relationships · click a node to inspect it
            </p>
          )}
        </div>

        {slug && (
          <aside className="gp__detail panel panel--raised ticks" aria-live="polite">
            {detail.loading && !detail.data && <div className="skeleton" style={{ height: 300 }} />}
            {detail.error && <div className="alert alert--danger">{detail.error}</div>}
            {detail.data && (
              <ConceptPanel
                d={detail.data}
                evidence={selectedNode?.evidence}
                onClose={() => navigate('/graph')}
                onJump={(s) => navigate(`/graph/${s}`)}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function ConceptPanel({ d, evidence, onClose, onJump }: { d: ConceptDetail; evidence?: { solved: number; attempted: number; notes: number }; onClose: () => void; onJump: (slug: string) => void }) {
  const { concept } = d;
  const prereqEdges = d.neighbours.filter((n) => n.direction === 'in' && n.type === 'prerequisite');
  const unlockEdges = d.neighbours.filter((n) => n.direction === 'out' && n.type === 'prerequisite');
  const related = d.neighbours.filter((n) => n.type !== 'prerequisite');

  return (
    <div className="cp">
      <div className="cp__head">
        <div>
          <p className="eyebrow eyebrow--accent">
            {concept.category}
            {concept.typicalRating ? ` · typically ${concept.typicalRating.min}–${concept.typicalRating.max}` : ''}
          </p>
          <h2 className="cp__title">{concept.name}</h2>
          <p className="muted">{concept.summary}</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close concept panel">
          ✕
        </button>
      </div>

      <div className="cp__evidence">
        <span>
          <strong className="num">{d.evidence.solved}</strong> solved
        </span>
        <span>
          <strong className="num">{d.evidence.attempted}</strong> attempted
        </span>
        <span>
          <strong className="num">{evidence?.notes ?? d.notes.length}</strong> notes
        </span>
        <span className="faint mono" style={{ fontSize: '0.72rem' }}>
          via tags: {concept.codeforcesTags.join(', ')}
        </span>
      </div>

      <p className="cp__desc">{concept.description}</p>

      {concept.whenToUse.length > 0 && (
        <section>
          <h4 className="eyebrow">when to reach for it</h4>
          <ul className="cp__list">
            {concept.whenToUse.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {d.prerequisites.length > 0 && (
        <section>
          <h4 className="eyebrow">learning path (prerequisites, in order)</h4>
          <ol className="cp__path">
            {d.prerequisites.map((p) => (
              <li key={p.slug}>
                <button type="button" className="cp__jump" onClick={() => onJump(p.slug)}>
                  {p.name}
                </button>
              </li>
            ))}
            <li className="cp__path-here">{concept.name}</li>
          </ol>
        </section>
      )}

      {(prereqEdges.length > 0 || unlockEdges.length > 0 || related.length > 0) && (
        <section>
          <h4 className="eyebrow">connections, explained</h4>
          <ul className="cp__edges">
            {prereqEdges.map((n) => (
              <EdgeRow key={`in-${n.slug}`} label="needs" name={n.name} explanation={n.explanation} onJump={() => onJump(n.slug)} />
            ))}
            {unlockEdges.map((n) => (
              <EdgeRow key={`out-${n.slug}`} label="unlocks" name={n.name} explanation={n.explanation} onJump={() => onJump(n.slug)} tone="accent2" />
            ))}
            {related.map((n) => (
              <EdgeRow key={`${n.type}-${n.slug}`} label={n.type.replace('-', ' ')} name={n.name} explanation={n.explanation} onJump={() => onJump(n.slug)} tone="accent3" />
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="row row--between">
          <h4 className="eyebrow">problems</h4>
          <Link to={`/library?tags=${encodeURIComponent(concept.codeforcesTags[0] ?? '')}`} className="faint mono" style={{ fontSize: '0.72rem' }}>
            all in library →
          </Link>
        </div>
        {d.problems.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            Load the problem catalogue (Connect page) to see problems here.
          </p>
        ) : (
          <ul className="list cp__problems">
            {d.problems.slice(0, 8).map((p) => (
              <li key={p.key}>
                <span className={`drill__dot ${p.solved ? 'drill__dot--ok' : ''}`} aria-hidden="true" />
                <a href={p.url} target="_blank" rel="noreferrer" className="cp__problem">
                  {p.name}
                </a>
                <RatingPill rating={p.rating} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="row row--between">
          <h4 className="eyebrow">your notes</h4>
          <Link to={`/vault?new=1&concept=${concept.slug}`} className="faint mono" style={{ fontSize: '0.72rem' }}>
            + write one
          </Link>
        </div>
        {d.notes.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            Nothing written about {concept.name} yet.
          </p>
        ) : (
          <ul className="list">
            {d.notes.map((n) => (
              <li key={n.id} className="cp__note">
                <Link to={`/vault/${n.id}`}>{n.title}</Link>
                {n.coreIdea && <span className="muted">{n.coreIdea}</span>}
                <span className="faint mono" style={{ fontSize: '0.7rem' }}>
                  {relativeTime(n.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to={`/next?tags=${encodeURIComponent(concept.codeforcesTags.join(','))}`} className="btn btn--primary btn--block">
        Recommend {concept.name} problems
      </Link>
    </div>
  );
}

function EdgeRow({ label, name, explanation, onJump, tone }: { label: string; name: string; explanation: string; onJump: () => void; tone?: 'accent2' | 'accent3' }) {
  return (
    <li>
      <span className={`tag ${tone ? `tag--${tone}` : 'tag--accent'}`}>{label}</span>
      <div>
        <button type="button" className="cp__jump" onClick={onJump}>
          {name}
        </button>
        <p className="muted" style={{ fontSize: '0.84rem' }}>
          {explanation}
        </p>
      </div>
    </li>
  );
}
