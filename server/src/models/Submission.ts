import mongoose, { Schema, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

export const VERDICTS = [
  'OK',
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'RUNTIME_ERROR',
  'COMPILATION_ERROR',
  'IDLENESS_LIMIT_EXCEEDED',
  'SECURITY_VIOLATED',
  'CRASHED',
  'INPUT_PREPARATION_CRASHED',
  'CHALLENGED',
  'SKIPPED',
  'TESTING',
  'REJECTED',
  'PARTIAL',
  'FAILED',
  'PRESENTATION_ERROR',
  'UNKNOWN',
] as const;
export type Verdict = (typeof VERDICTS)[number];

/**
 * One submission imported from an external platform. Uniqueness is enforced on
 * (userId, platform, platformSubmissionId) so re-running a sync is idempotent.
 */
const submissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, enum: ['codeforces'], required: true },
    platformSubmissionId: { type: Number, required: true },
    problemKey: { type: String, required: true },
    problemName: { type: String, required: true },
    problemRating: { type: Number },
    tags: { type: [String], default: [] },
    verdict: { type: String, enum: VERDICTS, required: true },
    language: { type: String },
    submittedAt: { type: Date, required: true },
    contestId: { type: Number },
    participantType: { type: String },
    passedTestCount: { type: Number },
    timeMs: { type: Number },
    memoryBytes: { type: Number },
  },
  { timestamps: true },
);

submissionSchema.index({ userId: 1, platform: 1, platformSubmissionId: 1 }, { unique: true });
submissionSchema.index({ userId: 1, problemKey: 1 });
submissionSchema.index({ userId: 1, submittedAt: -1 });

export type SubmissionAttrs = InferSchemaType<typeof submissionSchema>;
export type SubmissionDoc = HydratedDocument<SubmissionAttrs>;

export const Submission: Model<SubmissionAttrs> =
  (mongoose.models.Submission as Model<SubmissionAttrs> | undefined) ??
  mongoose.model<SubmissionAttrs>('Submission', submissionSchema);
