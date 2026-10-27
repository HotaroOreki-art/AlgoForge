import type { EdgeType } from '../../models/Concept.ts';

export interface ConceptSeed {
  slug: string;
  name: string;
  category: 'searching' | 'arrays' | 'graphs' | 'dp' | 'strings' | 'math' | 'structures' | 'greedy';
  summary: string;
  description: string;
  whenToUse: string[];
  codeforcesTags: string[];
  typicalRating?: { min: number; max: number };
}

export interface EdgeSeed {
  from: string;
  to: string;
  type: EdgeType;
  explanation: string;
}

/**
 * Curated starter graph. Every edge carries a reason; the graph is meant to be
 * read, not just looked at. Edge semantics:
 *   prerequisite   : `from` should be understood before `to`.
 *   specializes    : `from` is a specialised form of `to`.
 *   combines-with  : `from` and `to` are frequently used together.
 *   alternative-to : `from` solves a similar class of problems as `to`.
 */
export const CONCEPT_SEEDS: ConceptSeed[] = [
  {
    slug: 'arrays-and-iteration',
    name: 'Arrays & Iteration',
    category: 'arrays',
    summary: 'Indexing, loops, and reasoning about contiguous data.',
    description:
      'The ground floor. Nearly every technique below is a disciplined way of iterating an array fewer times. Knowing how indices move, what an invariant is, and how to avoid off-by-one errors pays off everywhere.',
    whenToUse: ['Any problem with a sequence of values', 'Before reaching for a data structure, ask if one pass is enough'],
    codeforcesTags: ['implementation', 'brute force'],
    typicalRating: { min: 800, max: 1100 },
  },
  {
    slug: 'prefix-sums',
    name: 'Prefix Sums',
    category: 'arrays',
    summary: 'Precompute cumulative totals to answer range sums in O(1).',
    description:
      'Build P[i] = a[0] + … + a[i-1]. Then sum(l, r) = P[r+1] − P[l]. The idea generalises to XOR, counts, 2-D grids and difference arrays for range updates.',
    whenToUse: ['Many range-sum queries on static data', 'Counting subarrays with a property expressible via a prefix value', 'Range add / point query via difference arrays'],
    codeforcesTags: ['data structures', 'math'],
    typicalRating: { min: 1000, max: 1500 },
  },
  {
    slug: 'two-pointers',
    name: 'Two Pointers',
    category: 'arrays',
    summary: 'Move two indices monotonically to scan pairs or ranges in linear time.',
    description:
      'When the answer for a left index can only move the right index forward (monotonicity), a pair of pointers replaces a nested loop. Works on sorted arrays, for merging, and for shrinking/expanding windows.',
    whenToUse: ['Pairs with a sum/difference constraint in sorted data', 'Merging two sorted sequences', 'Finding the shortest/longest range satisfying a monotone condition'],
    codeforcesTags: ['two pointers'],
    typicalRating: { min: 1100, max: 1600 },
  },
  {
    slug: 'sliding-window',
    name: 'Sliding Window',
    category: 'arrays',
    summary: 'Maintain an aggregate over a moving contiguous range.',
    description:
      'A two-pointer pattern where the window state (sum, counts, max via deque) is updated incrementally as the window moves, instead of being recomputed.',
    whenToUse: ['Longest/shortest subarray with at most K distinct / sum ≤ S', 'Fixed-size window maxima (monotonic deque)', 'Substring problems with character counts'],
    codeforcesTags: ['two pointers', 'data structures'],
    typicalRating: { min: 1200, max: 1700 },
  },
  {
    slug: 'sorting',
    name: 'Sorting',
    category: 'arrays',
    summary: 'Order data so structure becomes visible and searchable.',
    description:
      'Sorting is often the first transformation that unlocks two pointers, binary search, or a greedy exchange argument. Know comparator design, stability, and sorting by custom keys.',
    whenToUse: ['Before two pointers or binary search', 'Greedy problems that process items in a specific order', 'Coordinate compression'],
    codeforcesTags: ['sortings'],
    typicalRating: { min: 900, max: 1300 },
  },
  {
    slug: 'binary-search',
    name: 'Binary Search',
    category: 'searching',
    summary: 'Halve a sorted or monotone search space each step.',
    description:
      'Over a sorted array it locates values in O(log n). The more powerful form searches over the *answer*: if a predicate feasible(x) is monotone, the boundary is found by bisection.',
    whenToUse: ['Lookup in sorted data (lower_bound / upper_bound)', '“Minimise the maximum” / “maximise the minimum” problems', 'Any time you can check an answer faster than you can construct it'],
    codeforcesTags: ['binary search'],
    typicalRating: { min: 1200, max: 1800 },
  },
  {
    slug: 'monotonic-predicates',
    name: 'Monotonic Predicates',
    category: 'searching',
    summary: 'Recognise yes/no functions that flip exactly once.',
    description:
      'The conceptual heart of binary search on the answer. If feasible(x) is false…false true…true, you can binary search the boundary. Proving monotonicity is the actual work.',
    whenToUse: ['Deciding whether binary search on the answer applies', 'Parametric search in optimisation problems'],
    codeforcesTags: ['binary search'],
    typicalRating: { min: 1400, max: 1900 },
  },
  {
    slug: 'greedy',
    name: 'Greedy',
    category: 'greedy',
    summary: 'Make the locally best choice and prove it never hurts.',
    description:
      'Greedy works when an exchange argument shows that any optimal solution can be transformed into the greedy one without loss. Sorting by the right key is usually half the solution.',
    whenToUse: ['Interval scheduling, deadline problems', 'Problems where a simple ordering obviously dominates', 'When DP state is too large and a monotone structure exists'],
    codeforcesTags: ['greedy'],
    typicalRating: { min: 1000, max: 1700 },
  },
  {
    slug: 'hashing-and-maps',
    name: 'Hash Maps & Sets',
    category: 'structures',
    summary: 'O(1) average membership and counting.',
    description:
      'Count frequencies, detect duplicates, and index by arbitrary keys. Combined with prefix sums they count subarrays with a given sum; combined with two pointers they track window contents.',
    whenToUse: ['Frequency counting', 'Pairing complements (two-sum style)', 'Deduplication and grouping'],
    codeforcesTags: ['hashing', 'data structures'],
    typicalRating: { min: 1000, max: 1500 },
  },
  {
    slug: 'graph-traversal',
    name: 'Graph Traversal',
    category: 'graphs',
    summary: 'Visit every reachable node exactly once.',
    description:
      'Adjacency lists, a visited array, and a systematic frontier. BFS and DFS are the two orders of traversal; everything else in graph theory builds on them.',
    whenToUse: ['Connectivity and components', 'Reachability', 'Grid problems disguised as graphs'],
    codeforcesTags: ['graphs', 'dfs and similar'],
    typicalRating: { min: 1200, max: 1600 },
  },
  {
    slug: 'bfs',
    name: 'Breadth-First Search',
    category: 'graphs',
    summary: 'Layer-by-layer traversal that yields shortest paths in unweighted graphs.',
    description:
      'A queue expands nodes in order of distance from the source. The first time a node is dequeued its distance is final. Multi-source BFS and 0-1 BFS are small twists.',
    whenToUse: ['Shortest path when all edges weigh 1', 'Minimum moves on a grid', 'Level-order processing of trees'],
    codeforcesTags: ['shortest paths', 'graphs'],
    typicalRating: { min: 1200, max: 1700 },
  },
  {
    slug: 'dfs',
    name: 'Depth-First Search',
    category: 'graphs',
    summary: 'Go deep first; the recursion stack encodes the path.',
    description:
      'Natural for trees, cycle detection, topological order, and bridges/articulation points. Entry/exit times turn subtree questions into range questions.',
    whenToUse: ['Tree DP and subtree aggregates', 'Detecting cycles, topological sort', 'Flood fill / connected components'],
    codeforcesTags: ['dfs and similar', 'trees'],
    typicalRating: { min: 1200, max: 1700 },
  },
  {
    slug: 'shortest-paths',
    name: 'Weighted Shortest Paths',
    category: 'graphs',
    summary: 'Dijkstra, Bellman-Ford and Floyd-Warshall for weighted edges.',
    description:
      'Dijkstra generalises BFS with a priority queue for non-negative weights. Bellman-Ford handles negatives, Floyd-Warshall gives all pairs. State can include more than a node (e.g. node + fuel).',
    whenToUse: ['Weighted graphs with non-negative edges (Dijkstra)', 'Negative edges or detecting negative cycles', 'Small graphs needing all-pairs distances'],
    codeforcesTags: ['shortest paths'],
    typicalRating: { min: 1600, max: 2100 },
  },
  {
    slug: 'recursion-and-backtracking',
    name: 'Recursion & Backtracking',
    category: 'searching',
    summary: 'Define a solution in terms of smaller instances; undo choices to explore alternatives.',
    description:
      'Backtracking explores a decision tree and prunes. It is the brute-force ancestor of DP: once you notice repeated subproblems, memoisation turns it into DP.',
    whenToUse: ['Small search spaces (n ≤ 20)', 'Generating permutations/subsets', 'First draft before optimising to DP'],
    codeforcesTags: ['brute force', 'bitmasks'],
    typicalRating: { min: 1000, max: 1500 },
  },
  {
    slug: 'dynamic-programming',
    name: 'Dynamic Programming',
    category: 'dp',
    summary: 'Cache answers to overlapping subproblems.',
    description:
      'Define a state, a transition, and a base case. The hard part is choosing a state that is small enough to compute and rich enough to decide the transition. Push vs pull, iterative vs memoised.',
    whenToUse: ['Counting ways / optimising over sequences', 'Knapsack-shaped constraints', 'Problems where greedy fails on a counterexample'],
    codeforcesTags: ['dp'],
    typicalRating: { min: 1300, max: 2000 },
  },
  {
    slug: 'bit-manipulation',
    name: 'Bit Manipulation',
    category: 'math',
    summary: 'Treat integers as sets of bits.',
    description:
      'XOR tricks, subset enumeration with masks, and bit-by-bit reasoning. Bitmask DP uses a mask as the DP state for small n.',
    whenToUse: ['Subsets of ≤ 20 items', 'XOR-based puzzles', 'Representing on/off state compactly'],
    codeforcesTags: ['bitmasks'],
    typicalRating: { min: 1200, max: 1800 },
  },
  {
    slug: 'number-theory',
    name: 'Number Theory',
    category: 'math',
    summary: 'GCD, primes, modular arithmetic.',
    description:
      'Euclid, sieve of Eratosthenes, modular inverse and fast exponentiation. Many combinatorics problems reduce to counting modulo a prime.',
    whenToUse: ['Divisibility conditions', 'Answers requested modulo 1e9+7', 'Counting with factorials'],
    codeforcesTags: ['number theory', 'math', 'combinatorics'],
    typicalRating: { min: 1100, max: 1900 },
  },
  {
    slug: 'string-algorithms',
    name: 'String Algorithms',
    category: 'strings',
    summary: 'Pattern matching and string structure.',
    description:
      'Prefix function (KMP), Z-function, hashing, and tries. Many string problems are two-pointer or hashing problems in disguise.',
    whenToUse: ['Finding occurrences of a pattern', 'Periodicity and borders', 'Comparing many substrings quickly'],
    codeforcesTags: ['strings', 'string suffix structures'],
    typicalRating: { min: 1200, max: 2000 },
  },
];

export const EDGE_SEEDS: EdgeSeed[] = [
  { from: 'arrays-and-iteration', to: 'prefix-sums', type: 'prerequisite', explanation: 'Prefix sums are a single pass over an array; comfortable indexing comes first.' },
  { from: 'arrays-and-iteration', to: 'two-pointers', type: 'prerequisite', explanation: 'Two pointers is a disciplined form of iteration with two indices.' },
  { from: 'arrays-and-iteration', to: 'sorting', type: 'prerequisite', explanation: 'Sorting is the first transformation applied to raw arrays.' },
  { from: 'arrays-and-iteration', to: 'hashing-and-maps', type: 'prerequisite', explanation: 'Maps replace linear scans once you know what a scan costs.' },
  { from: 'sorting', to: 'two-pointers', type: 'prerequisite', explanation: 'Most two-pointer arguments rely on the array being sorted.' },
  { from: 'sorting', to: 'binary-search', type: 'prerequisite', explanation: 'Classic binary search requires sorted data.' },
  { from: 'sorting', to: 'greedy', type: 'prerequisite', explanation: 'Greedy solutions usually process items in a sorted order.' },
  { from: 'two-pointers', to: 'sliding-window', type: 'prerequisite', explanation: 'A sliding window is two pointers plus incremental window state.' },
  { from: 'hashing-and-maps', to: 'sliding-window', type: 'combines-with', explanation: 'A map tracks counts inside the window as it moves.' },
  { from: 'prefix-sums', to: 'hashing-and-maps', type: 'combines-with', explanation: 'Counting subarrays with sum K = prefix sums + a frequency map.' },
  { from: 'binary-search', to: 'monotonic-predicates', type: 'prerequisite', explanation: 'Binary search on the answer requires recognising a monotone predicate.' },
  { from: 'monotonic-predicates', to: 'greedy', type: 'combines-with', explanation: 'The feasibility check inside a parametric search is often a greedy pass.' },
  { from: 'two-pointers', to: 'binary-search', type: 'alternative-to', explanation: 'Both exploit monotonicity; two pointers is linear when both ends move forward, binary search when you can only probe.' },
  { from: 'graph-traversal', to: 'bfs', type: 'prerequisite', explanation: 'BFS is traversal with a queue as the frontier.' },
  { from: 'graph-traversal', to: 'dfs', type: 'prerequisite', explanation: 'DFS is traversal with a stack (or recursion) as the frontier.' },
  { from: 'bfs', to: 'shortest-paths', type: 'prerequisite', explanation: 'Dijkstra is BFS with a priority queue; understand unweighted first.' },
  { from: 'recursion-and-backtracking', to: 'dfs', type: 'prerequisite', explanation: 'DFS is recursion over a graph; the call stack is the path.' },
  { from: 'recursion-and-backtracking', to: 'dynamic-programming', type: 'prerequisite', explanation: 'DP is recursion with memoised overlapping subproblems.' },
  { from: 'dfs', to: 'dynamic-programming', type: 'combines-with', explanation: 'Tree DP runs a DFS and aggregates child answers at each node.' },
  { from: 'bit-manipulation', to: 'dynamic-programming', type: 'combines-with', explanation: 'Bitmask DP uses a mask as the DP state for small n.' },
  { from: 'bit-manipulation', to: 'recursion-and-backtracking', type: 'combines-with', explanation: 'Subset enumeration is backtracking expressed with masks.' },
  { from: 'greedy', to: 'dynamic-programming', type: 'alternative-to', explanation: 'When a greedy exchange argument fails, DP over the same decisions usually works.' },
  { from: 'prefix-sums', to: 'dynamic-programming', type: 'combines-with', explanation: 'Prefix sums over DP arrays speed up range transitions from O(n) to O(1).' },
  { from: 'hashing-and-maps', to: 'string-algorithms', type: 'prerequisite', explanation: 'Polynomial string hashing is hashing applied to prefixes.' },
  { from: 'two-pointers', to: 'string-algorithms', type: 'combines-with', explanation: 'Many substring problems are two-pointer scans over characters.' },
  { from: 'number-theory', to: 'string-algorithms', type: 'combines-with', explanation: 'String hashing relies on modular arithmetic and large primes.' },
  { from: 'number-theory', to: 'dynamic-programming', type: 'combines-with', explanation: 'Counting DPs are computed modulo a prime.' },
];
