import mongoose, { Schema, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

export const NOTE_KINDS = ['technique', 'postmortem', 'insight'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

/**
 * Technique Vault entry / learning-journal note. Written in the user's own
 * words. Always scoped to the owning user; ownership is enforced server-side.
 */
const noteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: NOTE_KINDS, default: 'technique' },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    coreIdea: { type: String, default: '', maxlength: 2000 },
    explanation: { type: String, default: '', maxlength: 20000 },
    checklist: { type: [String], default: [] },
    pitfalls: { type: [String], default: [] },
    codeSnippet: { type: String, default: '', maxlength: 20000 },
    codeLanguage: { type: String, default: 'cpp' },
    whatWentWrong: { type: String, default: '', maxlength: 5000 },
    whyItFailed: { type: String, default: '', maxlength: 5000 },
    whatILearned: { type: String, default: '', maxlength: 5000 },
    rememberNextTime: { type: String, default: '', maxlength: 5000 },
    conceptSlugs: { type: [String], default: [] },
    problemKeys: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

noteSchema.index({ userId: 1, updatedAt: -1 });
noteSchema.index({ userId: 1, conceptSlugs: 1 });
noteSchema.index({ userId: 1, problemKeys: 1 });

export type NoteAttrs = InferSchemaType<typeof noteSchema>;
export type NoteDoc = HydratedDocument<NoteAttrs>;

export const Note: Model<NoteAttrs> =
  (mongoose.models.Note as Model<NoteAttrs> | undefined) ?? mongoose.model<NoteAttrs>('Note', noteSchema);
