import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

export const WORKSPACE_LANGUAGES = ['cpp', 'java', 'python'] as const;
export type WorkspaceLanguage = (typeof WORKSPACE_LANGUAGES)[number];

/** A saved code draft in the online workspace, scoped to a user (+ optional problem). */
const draftSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    problemKey: { type: String, default: '' }, // '' = scratchpad
    language: { type: String, enum: WORKSPACE_LANGUAGES, required: true },
    code: { type: String, default: '', maxlength: 100000 },
    stdin: { type: String, default: '', maxlength: 20000 },
  },
  { timestamps: true },
);

draftSchema.index({ userId: 1, problemKey: 1, language: 1 }, { unique: true });

export type DraftAttrs = InferSchemaType<typeof draftSchema>;

export const Draft: Model<DraftAttrs> =
  (mongoose.models.Draft as Model<DraftAttrs> | undefined) ?? mongoose.model<DraftAttrs>('Draft', draftSchema);
