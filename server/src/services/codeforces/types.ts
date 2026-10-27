import { z } from 'zod';

/**
 * Zod schemas for the subset of the Codeforces API we consume.
 * https://codeforces.com/apiHelp/objects
 * Schemas are deliberately permissive about unknown fields and treat optional
 * numbers as "not published" rather than zero.
 */

export const cfProblemSchema = z.object({
  contestId: z.number().int().optional(),
  problemsetName: z.string().optional(),
  index: z.string(),
  name: z.string(),
  type: z.string().optional(),
  points: z.number().optional(),
  rating: z.number().int().optional(),
  tags: z.array(z.string()).default([]),
});
export type CfProblem = z.infer<typeof cfProblemSchema>;

export const cfSubmissionSchema = z.object({
  id: z.number().int(),
  contestId: z.number().int().optional(),
  creationTimeSeconds: z.number().int(),
  relativeTimeSeconds: z.number().optional(),
  problem: cfProblemSchema,
  author: z
    .object({
      participantType: z.string().optional(),
      members: z.array(z.object({ handle: z.string() })).optional(),
    })
    .passthrough()
    .optional(),
  programmingLanguage: z.string().optional(),
  verdict: z.string().optional(), // absent while still TESTING
  testset: z.string().optional(),
  passedTestCount: z.number().int().optional(),
  timeConsumedMillis: z.number().optional(),
  memoryConsumedBytes: z.number().optional(),
});
export type CfSubmission = z.infer<typeof cfSubmissionSchema>;

export const cfUserSchema = z.object({
  handle: z.string(),
  rating: z.number().int().optional(),
  maxRating: z.number().int().optional(),
  rank: z.string().optional(),
  maxRank: z.string().optional(),
  avatar: z.string().optional(),
  titlePhoto: z.string().optional(),
  country: z.string().optional(),
  organization: z.string().optional(),
  friendOfCount: z.number().int().optional(),
  contribution: z.number().int().optional(),
  registrationTimeSeconds: z.number().int().optional(),
});
export type CfUser = z.infer<typeof cfUserSchema>;

export const cfRatingChangeSchema = z.object({
  contestId: z.number().int(),
  contestName: z.string(),
  handle: z.string(),
  rank: z.number().int(),
  ratingUpdateTimeSeconds: z.number().int(),
  oldRating: z.number().int(),
  newRating: z.number().int(),
});
export type CfRatingChange = z.infer<typeof cfRatingChangeSchema>;

export const cfProblemsetSchema = z.object({
  problems: z.array(cfProblemSchema),
  problemStatistics: z.array(z.object({ contestId: z.number().int().optional(), index: z.string(), solvedCount: z.number().int() })),
});

export const cfEnvelopeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('OK'), result: z.unknown() }),
  z.object({ status: z.literal('FAILED'), comment: z.string().optional() }),
]);
