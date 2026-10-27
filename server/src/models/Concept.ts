import mongoose, { Schema, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

export const CONCEPT_CATEGORIES = ['searching', 'arrays', 'graphs', 'dp', 'strings', 'math', 'structures', 'greedy'] as const;

/**
 * A node in the programming knowledge graph. `codeforcesTags` maps the concept
 * onto the tag vocabulary used by Codeforces so analytics and recommendations
 * can bridge between the user's real submissions and the graph.
 */
const conceptSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, enum: CONCEPT_CATEGORIES, required: true },
    summary: { type: String, required: true },
    description: { type: String, required: true },
    whenToUse: { type: [String], default: [] },
    codeforcesTags: { type: [String], default: [] },
    /** Typical Codeforces rating band where this concept is first needed. */
    typicalRating: { min: Number, max: Number },
  },
  { timestamps: true },
);

export type ConceptAttrs = InferSchemaType<typeof conceptSchema>;
export type ConceptDoc = HydratedDocument<ConceptAttrs>;

export const Concept: Model<ConceptAttrs> =
  (mongoose.models.Concept as Model<ConceptAttrs> | undefined) ?? mongoose.model<ConceptAttrs>('Concept', conceptSchema);

export const EDGE_TYPES = ['prerequisite', 'specializes', 'combines-with', 'alternative-to'] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

/**
 * A directed, typed relationship between two concepts. Every edge has a short
 * human explanation of *why* it exists — no decorative edges.
 */
const conceptEdgeSchema = new Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    type: { type: String, enum: EDGE_TYPES, required: true },
    explanation: { type: String, required: true },
  },
  { timestamps: true },
);

conceptEdgeSchema.index({ from: 1, to: 1, type: 1 }, { unique: true });

export type ConceptEdgeAttrs = InferSchemaType<typeof conceptEdgeSchema>;

export const ConceptEdge: Model<ConceptEdgeAttrs> =
  (mongoose.models.ConceptEdge as Model<ConceptEdgeAttrs> | undefined) ??
  mongoose.model<ConceptEdgeAttrs>('ConceptEdge', conceptEdgeSchema);
