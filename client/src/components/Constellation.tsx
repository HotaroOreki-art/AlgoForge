import { useMemo } from 'react';
import { useTheme } from '../theme/ThemeContext.tsx';
import './Constellation.css';

/**
 * The login-screen constellation: a hand-laid subset of the real knowledge
 * graph (same slugs and prerequisite edges as the seeded data) drawn as an
 * SVG whose edges connect one by one. Purely illustrative here — the live,
 * data-driven graph lives at /graph once signed in.
 */
const NODES = [
  { id: 'arrays', label: 'arrays', x: 90, y: 300, r: 7 },
  { id: 'sorting', label: 'sorting', x: 220, y: 200, r: 8 },
  { id: 'prefix', label: 'prefix sums', x: 230, y: 400, r: 7 },
  { id: 'two-pointers', label: 'two pointers', x: 370, y: 270, r: 9 },
  { id: 'binary-search', label: 'binary search', x: 390, y: 120, r: 10 },
  { id: 'sliding', label: 'sliding window', x: 520, y: 350, r: 8 },
  { id: 'monotone', label: 'monotonic predicates', x: 560, y: 90, r: 7 },
  { id: 'greedy', label: 'greedy', x: 520, y: 210, r: 8 },
  { id: 'hash', label: 'hash maps', x: 380, y: 440, r: 7 },
  { id: 'traversal', label: 'graph traversal', x: 700, y: 260, r: 9 },
  { id: 'bfs', label: 'BFS', x: 820, y: 180, r: 8 },
  { id: 'dfs', label: 'DFS', x: 830, y: 350, r: 8 },
  { id: 'dp', label: 'dynamic programming', x: 680, y: 450, r: 11 },
];

const EDGES: [string, string][] = [
  ['arrays', 'sorting'],
  ['arrays', 'prefix'],
  ['sorting', 'two-pointers'],
  ['sorting', 'binary-search'],
  ['sorting', 'greedy'],
  ['two-pointers', 'sliding'],
  ['binary-search', 'monotone'],
  ['monotone', 'greedy'],
  ['prefix', 'hash'],
  ['hash', 'sliding'],
  ['traversal', 'bfs'],
  ['traversal', 'dfs'],
  ['dfs', 'dp'],
  ['prefix', 'dp'],
  ['greedy', 'dp'],
];

export function Constellation() {
  const { reducedMotion } = useTheme();
  const byId = useMemo(() => new Map(NODES.map((n) => [n.id, n])), []);

  return (
    <svg className={`constellation ${reducedMotion ? 'constellation--static' : ''}`} viewBox="0 0 920 520" role="img" aria-label="A constellation of connected programming concepts">
      <defs>
        <radialGradient id="nodeGlow">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* orbital rings — the "personal universe" motif */}
      <g className="constellation__orbits" fill="none" stroke="var(--line)" strokeWidth="1">
        <ellipse cx="470" cy="270" rx="430" ry="220" />
        <ellipse cx="470" cy="270" rx="300" ry="150" strokeDasharray="2 8" />
        <ellipse cx="470" cy="270" rx="160" ry="80" />
      </g>

      <g className="constellation__edges" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round">
        {EDGES.map(([a, b], i) => {
          const na = byId.get(a)!;
          const nb = byId.get(b)!;
          const len = Math.hypot(nb.x - na.x, nb.y - na.y);
          return (
            <line
              key={`${a}-${b}`}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              className="constellation__edge"
              style={{ ['--len' as string]: len, ['--i' as string]: i } as React.CSSProperties}
            />
          );
        })}
      </g>

      <g className="constellation__nodes">
        {NODES.map((n, i) => (
          <g key={n.id} className="constellation__node" style={{ ['--i' as string]: i } as React.CSSProperties} transform={`translate(${n.x} ${n.y})`}>
            <circle r={n.r * 3.2} fill="url(#nodeGlow)" className="constellation__halo" />
            <circle r={n.r} className="constellation__dot" />
            <text y={n.r + 16} textAnchor="middle" className="constellation__label">
              {n.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
