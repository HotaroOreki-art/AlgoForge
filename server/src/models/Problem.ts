import mongoose, { Schema, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

/**
 * Canonical problem record shared across users.
 * `key` is `${platform}:${platformId}` — e.g. `codeforces:1352C`.
 * Only metadata we can legitimately obtain is stored (no scraped statements).
 */
const problemSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['codeforces'], required: true },
    platformId: { type: String, required: true },
    contestId: { type: Number },
    index: { type: String },
    name: { type: String, required: true },
    rating: { type: Number }, // undefined = rating not published by the platform
    tags: { type: [String], default: [] },
    url: { type: String, required: true },
    solvedCount: { type: Number }, // from problemset.problems statistics when available
  },
  { timestamps: true },
);

problemSchema.index({ platform: 1, tags: 1 });
problemSchema.index({ platform: 1, rating: 1 });
problemSchema.index({ name: 'text' });

export type ProblemAttrs = InferSchemaType<typeof problemSchema>;
export type ProblemDoc = HydratedDocument<ProblemAttrs>;

export const Problem: Model<ProblemAttrs> =
  (mongoose.models.Problem as Model<ProblemAttrs> | undefined) ?? mongoose.model<ProblemAttrs>('Problem', problemSchema);
