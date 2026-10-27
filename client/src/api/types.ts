export type ThemeName = 'after-dark' | 'dreamscape' | 'daylight';

export interface User {
  id: string;
  email: string;
  displayName: string;
  theme: ThemeName;
  learningGoals: string[];
  createdAt: string;
}

export interface RatingChange {
  contestId: number;
  contestName: string;
  rank: number;
  oldRating: number;
  newRating: number;
  at: string;
}

export interface Connection {
  platform: 'codeforces';
  handle: string;
  profile: {
    rating?: number;
    maxRating?: number;
    rank?: string;
    maxRank?: string;
    avatar?: string;
    country?: string;
    organization?: string;
    friendOfCount?: number;
    contribution?: number;
    registrationTime?: string;
  } | null;
  ratingHistory: RatingChange[];
  lastSyncStatus: 'never' | 'running' | 'success' | 'failed';
  lastSyncError: string | null;
  lastSyncStartedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  submissionCount: number;
}

export interface SyncResult {
  handle: string;
  incremental: boolean;
  fetched: number;
  inserted: number;
  updated: number;
  skippedInvalid: number;
  truncated: boolean;
  lastSuccessfulSyncAt: string;
}

export interface SyncRun {
  _id: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt?: string;
  fetched: number;
  inserted: number;
  updated: number;
  skippedInvalid: number;
  error?: string;
  incremental: boolean;
}

export interface TagStat {
  tag: string;
  solved: number;
  attempted: number;
  submissions: number;
  failedAttempts: number;
  solveRate: number | null;
  lastPracticedAt: string | null;
}

export interface Stats {
  totalSubmissions: number;
  uniqueProblemsAttempted: number;
  uniqueProblemsSolved: number;
  acceptanceRate: number | null;
  solvedAfterStruggle: number;
  unsolvedAttempts: number;
  avgSolvedRating: number | null;
  maxSolvedRating: number | null;
  firstSubmissionAt: string | null;
  lastSubmissionAt: string | null;
  activeDays: number;
  currentStreakDays: number;
  longestStreakDays: number;
  verdicts: { verdict: string; count: number; share: number }[];
  tags: TagStat[];
  ratingBuckets: { rating: number; solved: number; attempted: number }[];
  weeklyActivity: { week: string; submissions: number; solved: number }[];
  languages: { language: string; count: number }[];
  unratedSubmissions: number;
}

export interface PracticeSignal {
  tag: string;
  kind: 'friction' | 'unexplored' | 'stale';
  reason: string;
  solved: number;
  attempted: number;
}

export interface Dashboard {
  hasData: boolean;
  connection: {
    handle: string;
    profile: Connection['profile'];
    ratingHistory: RatingChange[];
    lastSyncStatus: Connection['lastSyncStatus'];
    lastSyncError: string | null;
    lastSuccessfulSyncAt: string | null;
  } | null;
  stats: Stats;
  signals: PracticeSignal[];
  recent: { problemKey: string; problemName: string; rating: number | null; verdict: string; at: string; tags: string[] }[];
  counts: { notes: number; saved: number };
}

export interface TopicDrilldown {
  tag: string;
  totalSubmissions: number;
  solved: number;
  attempted: number;
  problems: { problemKey: string; problemName: string; url: string; rating: number | null; tags: string[]; solved: boolean; attempts: number; lastAt: string; verdicts: string[] }[];
}

export type PracticeStatus = 'todo' | 'attempting' | 'solved' | 'revisit';

export interface Problem {
  key: string;
  platform: 'codeforces';
  platformId: string;
  contestId: number | null;
  index: string | null;
  name: string;
  rating: number | null;
  tags: string[];
  url: string;
  solvedCount: number | null;
  user: {
    saved: boolean;
    bookmarked: boolean;
    markedForRevision: boolean;
    status: PracticeStatus | null;
    personalTags: string[];
    solvedOnPlatform: boolean;
    attemptedOnPlatform: boolean;
    notes: number;
  };
}

export interface ProblemList {
  total: number;
  page: number;
  limit: number;
  problems: Problem[];
}

export interface ProblemDetail {
  problem: Problem;
  submissions: { id: number; verdict: string; language: string | null; submittedAt: string; passedTestCount: number | null; timeMs: number | null }[];
  notes: { id: string; title: string; kind: NoteKind; updatedAt: string }[];
}

export type NoteKind = 'technique' | 'postmortem' | 'insight';

export interface Note {
  id: string;
  kind: NoteKind;
  title: string;
  coreIdea: string;
  explanation: string;
  checklist: string[];
  pitfalls: string[];
  codeSnippet: string;
  codeLanguage: string;
  whatWentWrong: string;
  whyItFailed: string;
  whatILearned: string;
  rememberNextTime: string;
  conceptSlugs: string[];
  problemKeys: string[];
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NoteInput = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>;

export type EdgeType = 'prerequisite' | 'specializes' | 'combines-with' | 'alternative-to';

export interface GraphNode {
  slug: string;
  name: string;
  category: string;
  summary: string;
  codeforcesTags: string[];
  typicalRating: { min?: number; max?: number } | null;
  evidence: { solved: number; attempted: number; notes: number };
  practised: boolean;
  frontier: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
  explanation: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meaning: Record<EdgeType, string>;
}

export interface ConceptDetail {
  concept: {
    slug: string;
    name: string;
    category: string;
    summary: string;
    description: string;
    whenToUse: string[];
    codeforcesTags: string[];
    typicalRating: { min?: number; max?: number } | null;
  };
  neighbours: { slug: string; name: string; category: string; direction: 'in' | 'out'; type: EdgeType; explanation: string }[];
  prerequisites: { slug: string; name: string }[];
  unlocks: { slug: string; name: string }[];
  evidence: { solved: number; attempted: number };
  problems: { key: string; name: string; rating: number | null; tags: string[]; url: string; solvedCount: number | null; solved: boolean; attempted: boolean }[];
  notes: { id: string; title: string; kind: NoteKind; coreIdea: string; updatedAt: string }[];
}

export interface Recommendation {
  problem: { key: string; name: string; url: string; rating: number | null; tags: string[]; solvedCount: number | null };
  score: number;
  headline: string;
  reasons: { points: number; text: string; kind: string }[];
}

export interface RecommendationResponse {
  recommendations: Recommendation[];
  context: {
    levelEstimate: number | null;
    stretch: number;
    candidateCount: number;
    catalogueSize: number;
    solvedCount: number;
    unsolvedAttempts: number;
    frictionTags: string[];
    staleTags: string[];
    recentTags: string[];
    goalTags: { tag: string; goal: string }[];
    frontier: string[];
    focusTags: string[];
    missing: string[];
  };
}

export type WorkspaceLanguage = 'cpp' | 'java' | 'python';

export interface ExecutionResult {
  status: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'time_limit' | 'error';
  statusDescription: string;
  stdout: string;
  stderr: string;
  compileOutput: string;
  timeSeconds: number | null;
  memoryKb: number | null;
  expectedOutput: string | null;
}
