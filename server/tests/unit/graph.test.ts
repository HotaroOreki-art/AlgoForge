import { describe, expect, it } from 'vitest';
import { ConceptGraph } from '../../src/services/graph/traversal.ts';
import { CONCEPT_SEEDS, EDGE_SEEDS } from '../../src/services/graph/seed.ts';

const seeded = () =>
  new ConceptGraph(
    CONCEPT_SEEDS.map((c) => ({ slug: c.slug, name: c.name, category: c.category })),
    EDGE_SEEDS,
  );

describe('seed integrity', () => {
  it('every edge references existing concepts and has an explanation', () => {
    const slugs = new Set(CONCEPT_SEEDS.map((c) => c.slug));
    for (const e of EDGE_SEEDS) {
      expect(slugs.has(e.from), `missing from: ${e.from}`).toBe(true);
      expect(slugs.has(e.to), `missing to: ${e.to}`).toBe(true);
      expect(e.explanation.length).toBeGreaterThan(10);
    }
  });

  it('has no duplicate concept slugs or edges', () => {
    expect(new Set(CONCEPT_SEEDS.map((c) => c.slug)).size).toBe(CONCEPT_SEEDS.length);
    expect(new Set(EDGE_SEEDS.map((e) => `${e.from}>${e.to}:${e.type}`)).size).toBe(EDGE_SEEDS.length);
  });

  it('prerequisite edges form a DAG', () => {
    const g = seeded();
    for (const c of CONCEPT_SEEDS) {
      expect(g.prerequisites(c.slug)).not.toContain(c.slug);
    }
  });
});

describe('ConceptGraph traversal', () => {
  it('returns transitive prerequisites in learning order', () => {
    const g = seeded();
    const prereqs = g.prerequisites('sliding-window');
    expect(prereqs).toContain('two-pointers');
    expect(prereqs).toContain('sorting');
    expect(prereqs).toContain('arrays-and-iteration');
    // arrays-and-iteration must come before sorting, which must come before two-pointers
    expect(prereqs.indexOf('arrays-and-iteration')).toBeLessThan(prereqs.indexOf('sorting'));
    expect(prereqs.indexOf('sorting')).toBeLessThan(prereqs.indexOf('two-pointers'));
    expect(prereqs.indexOf('two-pointers')).toBeLessThan(prereqs.length);
  });

  it('computes what a concept unlocks', () => {
    const g = seeded();
    const unlocked = g.unlocks('graph-traversal');
    expect(unlocked).toEqual(expect.arrayContaining(['bfs', 'dfs', 'shortest-paths']));
    // dfs → dynamic-programming is "combines-with", not a prerequisite, so it must NOT appear.
    expect(unlocked).not.toContain('dynamic-programming');
  });

  it('lists neighbours in both directions with the connecting edge', () => {
    const g = seeded();
    const n = g.neighbours('binary-search');
    const slugs = n.map((x) => x.slug);
    expect(slugs).toContain('sorting'); // incoming prerequisite
    expect(slugs).toContain('monotonic-predicates'); // outgoing prerequisite
    expect(slugs).toContain('two-pointers'); // alternative-to incoming
    expect(n.every((x) => x.edge.explanation.length > 0)).toBe(true);
  });

  it('finds shortest undirected paths and reports disconnection', () => {
    const g = seeded();
    const path = g.shortestPath('prefix-sums', 'bfs');
    expect(path).not.toBeNull();
    expect(path![0]).toBe('prefix-sums');
    expect(path![path!.length - 1]).toBe('bfs');
    const island = new ConceptGraph(
      [
        { slug: 'a', name: 'A', category: 'x' },
        { slug: 'b', name: 'B', category: 'x' },
      ],
      [],
    );
    expect(island.shortestPath('a', 'b')).toBeNull();
    expect(island.shortestPath('a', 'zzz')).toBeNull();
  });

  it('computes the learning frontier from practised concepts', () => {
    const g = seeded();
    const frontier = g.frontier(new Set(['arrays-and-iteration', 'sorting']));
    expect(frontier).toContain('two-pointers'); // prereqs: arrays, sorting
    expect(frontier).toContain('binary-search'); // prereq: sorting
    expect(frontier).not.toContain('sliding-window'); // needs two-pointers
    expect(frontier).not.toContain('arrays-and-iteration'); // already practised
  });

  it('ignores dangling edges instead of crashing', () => {
    const g = new ConceptGraph([{ slug: 'a', name: 'A', category: 'x' }], [{ from: 'a', to: 'ghost', type: 'prerequisite', explanation: 'nope' }]);
    expect(g.allEdges()).toHaveLength(0);
    expect(g.distances('a').size).toBe(1);
  });
});
