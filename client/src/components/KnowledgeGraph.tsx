import { useEffect, useMemo, useRef, useState } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import type { EdgeType, GraphEdge, GraphNode } from '../api/types.ts';
import { useTheme } from '../theme/ThemeContext.tsx';
import './KnowledgeGraph.css';

interface SimNode extends SimulationNodeDatum {
  id: string;
  node: GraphNode;
  r: number;
}
interface SimLink extends SimulationLinkDatum<SimNode> {
  edge: GraphEdge;
}

const CATEGORY_X: Record<string, number> = {
  arrays: 0.22,
  searching: 0.42,
  greedy: 0.5,
  structures: 0.3,
  strings: 0.62,
  math: 0.7,
  dp: 0.62,
  graphs: 0.82,
};
const CATEGORY_Y: Record<string, number> = {
  arrays: 0.55,
  searching: 0.3,
  greedy: 0.72,
  structures: 0.82,
  strings: 0.86,
  math: 0.35,
  dp: 0.6,
  graphs: 0.45,
};

export function radiusFor(n: GraphNode): number {
  const base = 14;
  return base + Math.min(14, Math.sqrt(n.evidence.solved) * 2.6);
}

/**
 * Force-directed SVG graph. Layout runs synchronously to a settled state on
 * data change (fast for ~20 nodes) so it is deterministic and does not jitter.
 * Interaction: hover highlights the neighbourhood, click selects.
 */
export function KnowledgeGraph({
  nodes,
  edges,
  selected,
  onSelect,
  width = 960,
  height = 560,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
  width?: number;
  height?: number;
}) {
  const { reducedMotion } = useTheme();
  const [hover, setHover] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const svgRef = useRef<SVGSVGElement | null>(null);

  const key = useMemo(() => nodes.map((n) => `${n.slug}:${n.evidence.solved}`).join('|') + edges.length, [nodes, edges]);

  useEffect(() => {
    const simNodes: SimNode[] = nodes.map((n) => ({
      id: n.slug,
      node: n,
      r: radiusFor(n),
      x: (CATEGORY_X[n.category] ?? 0.5) * width + (hash(n.slug) % 80) - 40,
      y: (CATEGORY_Y[n.category] ?? 0.5) * height + (hash(n.slug + 'y') % 80) - 40,
    }));
    const byId = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SimLink[] = edges
      .filter((e) => byId.has(e.from) && byId.has(e.to))
      .map((e) => ({ source: e.from, target: e.to, edge: e }));

    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => (l.edge.type === 'prerequisite' ? 110 : 140))
          .strength((l) => (l.edge.type === 'prerequisite' ? 0.6 : 0.25)),
      )
      .force('charge', forceManyBody().strength(-520))
      .force('collide', forceCollide<SimNode>().radius((d) => d.r + 30))
      .force('center', forceCenter(width / 2, height / 2))
      .force('x', forceX<SimNode>((d) => (CATEGORY_X[d.node.category] ?? 0.5) * width).strength(0.06))
      .force('y', forceY<SimNode>((d) => (CATEGORY_Y[d.node.category] ?? 0.5) * height).strength(0.06))
      .stop();

    // Settle synchronously — deterministic and no layout jitter.
    for (let i = 0; i < 300; i += 1) sim.tick();

    const pad = 36;
    const next = new Map<string, { x: number; y: number }>();
    for (const n of simNodes) {
      next.set(n.id, {
        x: Math.max(pad + n.r, Math.min(width - pad - n.r, n.x ?? width / 2)),
        y: Math.max(pad + n.r, Math.min(height - pad - n.r, n.y ?? height / 2)),
      });
    }
    setPositions(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, width, height]);

  const focus = hover ?? selected;
  const neighbourhood = useMemo(() => {
    if (!focus) return null;
    const set = new Set<string>([focus]);
    for (const e of edges) {
      if (e.from === focus) set.add(e.to);
      if (e.to === focus) set.add(e.from);
    }
    return set;
  }, [focus, edges]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.slug, n])), [nodes]);

  return (
    <svg
      ref={svgRef}
      className={`kg ${reducedMotion ? 'kg--static' : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      role="application"
      aria-label="Interactive knowledge graph of programming concepts"
      onClick={(e) => {
        if (e.target === svgRef.current) onSelect(null);
      }}
    >
      <defs>
        <marker id="kg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-3)" />
        </marker>
        <marker id="kg-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
        </marker>
        <filter id="kg-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* orbital background rings */}
      <g className="kg__orbits" fill="none" stroke="var(--line)">
        <ellipse cx={width / 2} cy={height / 2} rx={width * 0.46} ry={height * 0.44} />
        <ellipse cx={width / 2} cy={height / 2} rx={width * 0.3} ry={height * 0.28} strokeDasharray="2 10" />
      </g>

      <g className="kg__edges">
        {edges.map((e) => {
          const a = positions.get(e.from);
          const b = positions.get(e.to);
          const na = nodeMap.get(e.from);
          const nb = nodeMap.get(e.to);
          if (!a || !b || !na || !nb) return null;
          // shorten the line so the arrowhead lands on the circle edge
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const ra = radiusFor(na) + 2;
          const rb = radiusFor(nb) + 4;
          const x1 = a.x + (dx / len) * ra;
          const y1 = a.y + (dy / len) * ra;
          const x2 = b.x - (dx / len) * rb;
          const y2 = b.y - (dy / len) * rb;
          const hot = neighbourhood ? neighbourhood.has(e.from) && neighbourhood.has(e.to) && (e.from === focus || e.to === focus) : false;
          const dim = neighbourhood ? !hot : false;
          return (
            <line
              key={`${e.from}-${e.to}-${e.type}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={`kg__edge kg__edge--${e.type} ${hot ? 'kg__edge--hot' : ''} ${dim ? 'kg__edge--dim' : ''}`}
              markerEnd={e.type === 'prerequisite' || e.type === 'specializes' ? (hot ? 'url(#kg-arrow-hot)' : 'url(#kg-arrow)') : undefined}
            >
              <title>
                {na.name} → {nb.name} ({e.type}): {e.explanation}
              </title>
            </line>
          );
        })}
      </g>

      <g className="kg__nodes">
        {nodes.map((n) => {
          const p = positions.get(n.slug);
          if (!p) return null;
          const r = radiusFor(n);
          const isSel = selected === n.slug;
          const isHot = focus === n.slug;
          const dim = neighbourhood ? !neighbourhood.has(n.slug) : false;
          return (
            <g
              key={n.slug}
              className={`kg__node kg__node--${n.category} ${isSel ? 'kg__node--selected' : ''} ${isHot ? 'kg__node--hot' : ''} ${dim ? 'kg__node--dim' : ''} ${n.frontier ? 'kg__node--frontier' : ''} ${n.practised ? 'kg__node--practised' : ''}`}
              transform={`translate(${p.x} ${p.y})`}
              onMouseEnter={() => setHover(n.slug)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(n.slug)}
              onBlur={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(isSel ? null : n.slug);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(isSel ? null : n.slug);
                }
              }}
              tabIndex={0}
              role="button"
              aria-pressed={isSel}
              aria-label={`${n.name}: ${n.evidence.solved} solved, ${n.evidence.notes} notes${n.frontier ? ', on your frontier' : ''}`}
              data-testid={`kg-node-${n.slug}`}
            >
              {n.frontier && <circle r={r + 9} className="kg__frontier-ring" />}
              <circle r={r + 4} className="kg__halo" />
              <circle r={r} className="kg__dot" />
              {n.evidence.notes > 0 && <circle cx={r * 0.7} cy={-r * 0.7} r={5} className="kg__notedot" />}
              <text y={r + 15} textAnchor="middle" className="kg__label">
                {n.name}
              </text>
              {n.evidence.solved > 0 && (
                <text y={4} textAnchor="middle" className="kg__count">
                  {n.evidence.solved}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

export const EDGE_LEGEND: { type: EdgeType; label: string }[] = [
  { type: 'prerequisite', label: 'prerequisite →' },
  { type: 'combines-with', label: 'combines with' },
  { type: 'alternative-to', label: 'alternative to' },
  { type: 'specializes', label: 'specialises →' },
];
