import mongoose, { Schema, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

export const PRACTICE_STATUSES = ['todo', 'attempting', 'solved', 'revisit'] as const;
export type PracticeStatus = (typeof PRACTICE_STATUSES)[number];

/**
 * A user's personal relationship with a problem: saved/bookmarked, marked for
 * revision, and their own practice status. One record per (user, problem).
 */
const savedProblemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    problemKey: { type: String, required: true },
    bookmarked: { type: Boolean, default: true },
    markedForRevision: { type: Boolean, default: false },
    status: { type: String, enum: PRACTICE_STATUSES, default: 'todo' },
    personalTags: { type: [String], default: [] },
    notesCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

savedProblemSchema.index({ userId: 1, problemKey: 1 }, { unique: true });

export type SavedProblemAttrs = InferSchemaType<typeof savedProblemSchema>;
export type SavedProblemDoc = HydratedDocument<SavedProblemAttrs>;

export const SavedProblem: Model<SavedProblemAttrs> =
  (mongoose.models.SavedProblem as Model<SavedProblemAttrs> | undefined) ??
  mongoose.model<SavedProblemAttrs>('SavedProblem', savedProblemSchema);
