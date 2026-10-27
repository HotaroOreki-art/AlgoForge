import { Concept, ConceptEdge } from '../../models/Concept.ts';
import { CONCEPT_SEEDS, EDGE_SEEDS } from './seed.ts';
import { ConceptGraph, type GraphEdge } from './traversal.ts';

/**
 * Ensures the curated graph exists in MongoDB. Idempotent: upserts by slug /
 * (from,to,type) so it can run on every cold start without duplicating data.
 */
export async function ensureGraphSeeded(): Promise<void> {
  const count = await Concept.countDocuments();
  if (count >= CONCEPT_SEEDS.length) {
    const edgeCount = await ConceptEdge.countDocuments();
    if (edgeCount >= EDGE_SEEDS.length) return;
  }
  await Concept.bulkWrite(
    CONCEPT_SEEDS.map((c) => ({ updateOne: { filter: { slug: c.slug }, update: { $set: c }, upsert: true } })),
    { ordered: false },
  );
  await ConceptEdge.bulkWrite(
    EDGE_SEEDS.map((e) => ({
      updateOne: { filter: { from: e.from, to: e.to, type: e.type }, update: { $set: e }, upsert: true },
    })),
    { ordered: false },
  );
}

let cache: { graph: ConceptGraph; at: number } | null = null;
const CACHE_MS = 60_000;

export async function loadGraph(force = false): Promise<ConceptGraph> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.graph;
  const [concepts, edges] = await Promise.all([Concept.find().lean(), ConceptEdge.find().lean()]);
  const graph = new ConceptGraph(
    concepts.map((c) => ({ slug: c.slug, name: c.name, category: c.category })),
    edges.map((e): GraphEdge => ({ from: e.from, to: e.to, type: e.type, explanation: e.explanation })),
  );
  cache = { graph, at: Date.now() };
  return graph;
}

/** Map Codeforces tags → concept slugs using the seeded tag vocabulary. */
export async function tagToConceptMap(): Promise<Map<string, string[]>> {
  const concepts = await Concept.find().lean();
  const map = new Map<string, string[]>();
  for (const c of concepts) {
    for (const tag of c.codeforcesTags) {
      const list = map.get(tag) ?? [];
      list.push(c.slug);
      map.set(tag, list);
    }
  }
  return map;
}
