import mongoose, { Schema, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

/**
 * A link between an AlgoForge user and an external platform account.
 * Only public handles are stored — never platform passwords.
 */
const platformConnectionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, enum: ['codeforces'], required: true },
    handle: { type: String, required: true, trim: true },
    profile: {
      rating: { type: Number },
      maxRating: { type: Number },
      rank: { type: String },
      maxRank: { type: String },
      avatar: { type: String },
      country: { type: String },
      organization: { type: String },
      friendOfCount: { type: Number },
      contribution: { type: Number },
      registrationTime: { type: Date },
    },
    ratingHistory: {
      type: [
        {
          contestId: Number,
          contestName: String,
          rank: Number,
          oldRating: Number,
          newRating: Number,
          at: Date,
        },
      ],
      default: [],
    },
    lastSyncStatus: { type: String, enum: ['never', 'running', 'success', 'failed'], default: 'never' },
    lastSyncError: { type: String },
    lastSyncStartedAt: { type: Date },
    lastSuccessfulSyncAt: { type: Date },
    /** Highest Codeforces submission id seen so far — enables incremental sync. */
    lastSubmissionId: { type: Number },
    submissionCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

platformConnectionSchema.index({ userId: 1, platform: 1 }, { unique: true });

export type PlatformConnectionAttrs = InferSchemaType<typeof platformConnectionSchema>;
export type PlatformConnectionDoc = HydratedDocument<PlatformConnectionAttrs>;

export const PlatformConnection: Model<PlatformConnectionAttrs> =
  (mongoose.models.PlatformConnection as Model<PlatformConnectionAttrs> | undefined) ??
  mongoose.model<PlatformConnectionAttrs>('PlatformConnection', platformConnectionSchema);
