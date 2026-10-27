import mongoose, { Schema, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

/** Audit record for each synchronisation attempt. */
const syncRunSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, enum: ['codeforces'], required: true },
    handle: { type: String, required: true },
    status: { type: String, enum: ['running', 'success', 'failed'], required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date },
    fetched: { type: Number, default: 0 },
    inserted: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    skippedInvalid: { type: Number, default: 0 },
    error: { type: String },
    incremental: { type: Boolean, default: false },
  },
  { timestamps: true },
);

syncRunSchema.index({ userId: 1, startedAt: -1 });

export type SyncRunAttrs = InferSchemaType<typeof syncRunSchema>;
export type SyncRunDoc = HydratedDocument<SyncRunAttrs>;

export const SyncRun: Model<SyncRunAttrs> =
  (mongoose.models.SyncRun as Model<SyncRunAttrs> | undefined) ?? mongoose.model<SyncRunAttrs>('SyncRun', syncRunSchema);
