import type { EdgeType } from '../../models/Concept.ts';

/**
 * Pure graph algorithms over concept nodes and typed edges. The data comes
 * from MongoDB (see graph/service.ts) but nothing here touches the database,
 * so it is fully unit-testable.
 */

export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
  explanation: string;
}

export interface GraphNode {
  slug: string;
  name: string;
  category: string;
}

export class ConceptGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly out = new Map<string, GraphEdge[]>();
  private readonly inc = new Map<string, GraphEdge[]>();

  constructor(nodes: GraphNode[], edges: GraphEdge[]) {
    for (const n of nodes) this.nodes.set(n.slug, n);
    for (const e of edges) {
      if (!this.nodes.has(e.from) || !this.nodes.has(e.to)) continue; // ignore dangling edges
      if (!this.out.has(e.from)) this.out.set(e.from, []);
      if (!this.inc.has(e.to)) this.inc.set(e.to, []);
      this.out.get(e.from)!.push(e);
      this.inc.get(e.to)!.push(e);
    }
  }

  has(slug: string): boolean {
    return this.nodes.has(slug);
  }

  node(slug: string): GraphNode | undefined {
    return this.nodes.get(slug);
  }

  allNodes(): GraphNode[] {
    return [...this.nodes.values()];
  }

  allEdges(): GraphEdge[] {
    return [...this.out.values()].flat();
  }

  outgoing(slug: string): GraphEdge[] {
    return this.out.get(slug) ?? [];
  }

  incoming(slug: string): GraphEdge[] {
    return this.inc.get(slug) ?? [];
  }

  /** Direct neighbours in either direction, with the connecting edge. */
  neighbours(slug: string): { slug: string; edge: GraphEdge; direction: 'out' | 'in' }[] {
    return [
      ...this.outgoing(slug).map((edge) => ({ slug: edge.to, edge, direction: 'out' as const })),
      ...this.incoming(slug).map((edge) => ({ slug: edge.from, edge, direction: 'in' as const })),
    ];
  }

  /**
   * All transitive prerequisites of `slug`, ordered so that each concept
   * appears after its own prerequisites (a learning order). Cycles are
   * tolerated: a node is emitted at most once.
   */
  prerequisites(slug: string): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const visit = (s: string) => {
      for (const e of this.incoming(s)) {
        if (e.type !== 'prerequisite') continue;
        if (visited.has(e.from)) continue;
        visited.add(e.from);
        visit(e.from);
        order.push(e.from);
      }
    };
    visit(slug);
    return order;
  }

  /** Concepts that list `slug` as a prerequisite, transitively (what it unlocks). */
  unlocks(slug: string): string[] {
    const visited = new Set<string>();
    const queue = [slug];
    const result: string[] = [];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of this.outgoing(cur)) {
        if (e.type !== 'prerequisite' || visited.has(e.to)) continue;
        visited.add(e.to);
        result.push(e.to);
        queue.push(e.to);
      }
    }
    return result;
  }

  /** BFS distances from `slug` treating edges as undirected. */
  distances(slug: string, maxDepth = Infinity): Map<string, number> {
    const dist = new Map<string, number>();
    if (!this.has(slug)) return dist;
    dist.set(slug, 0);
    const queue = [slug];
    while (queue.length) {
      const cur = queue.shift()!;
      const d = dist.get(cur)!;
      if (d >= maxDepth) continue;
      for (const n of this.neighbours(cur)) {
        if (!dist.has(n.slug)) {
          dist.set(n.slug, d + 1);
          queue.push(n.slug);
        }
      }
    }
    return dist;
  }

  /** Shortest undirected path between two concepts, or null if disconnected. */
  shortestPath(from: string, to: string): string[] | null {
    if (!this.has(from) || !this.has(to)) return null;
    const prev = new Map<string, string | null>([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur === to) break;
      for (const n of this.neighbours(cur)) {
        if (!prev.has(n.slug)) {
          prev.set(n.slug, cur);
          queue.push(n.slug);
        }
      }
    }
    if (!prev.has(to)) return null;
    const path: string[] = [];
    let cur: string | null = to;
    while (cur !== null) {
      path.unshift(cur);
      cur = prev.get(cur) ?? null;
    }
    return path;
  }

  /**
   * Given concepts the user has evidence for (e.g. solved ≥ N tagged problems),
   * return concepts whose prerequisites are all satisfied but which are not
   * yet themselves practised — the natural "next" nodes in the graph.
   */
  frontier(practised: Set<string>): string[] {
    const result: string[] = [];
    for (const n of this.nodes.values()) {
      if (practised.has(n.slug)) continue;
      const prereqs = this.incoming(n.slug).filter((e) => e.type === 'prerequisite');
      if (prereqs.length === 0) continue; // roots are always available but not interesting as "next"
      if (prereqs.every((e) => practised.has(e.from))) result.push(n.slug);
    }
    return result.sort();
  }
}
