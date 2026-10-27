import { describe, expect, it } from 'vitest';
import { radiusFor } from '../components/KnowledgeGraph.tsx';
import type { GraphNode } from '../api/types.ts';

function node(solved: number): GraphNode {
  return {
    slug: 'binary-search',
    name: 'Binary Search',
    category: 'searching',
    summary: '',
    codeforcesTags: ['binary search'],
    typicalRating: null,
    evidence: { solved, attempted: solved, notes: 0 },
    practised: solved >= 3,
    frontier: false,
  };
}

describe('knowledge graph node radius', () => {
  it('grows with solved evidence but stays capped', () => {
    expect(radiusFor(node(0))).toBe(14);
    expect(radiusFor(node(1))).toBeGreaterThan(14);
    expect(radiusFor(node(100))).toBe(28);
    expect(radiusFor(node(10000))).toBe(28);
  });
});
