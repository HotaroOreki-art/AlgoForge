import { z } from 'zod';

/**
 * Environment configuration. Validated once at startup so misconfiguration
 * fails loudly instead of producing confusing runtime errors.
 *
 * MONGODB_URI is optional in development/test: when absent the server starts an
 * in-memory MongoDB (see db/connect.ts). In production it is required.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVER_PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().trim().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').optional(),
  CLIENT_ORIGIN: z.string().trim().optional(),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  // Optional: Judge0-compatible execution service for the coding workspace.
  JUDGE0_URL: z.string().trim().optional(),
  JUDGE0_KEY: z.string().trim().optional(),
  JUDGE0_HOST: z.string().trim().optional(),
});

export type Env = z.infer<typeof envSchema> & {
  jwtSecret: string;
  cookieSecure: boolean;
  isProd: boolean;
  isTest: boolean;
};

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  const isProd = env.NODE_ENV === 'production';
  const isTest = env.NODE_ENV === 'test';

  if (isProd && !env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in production');
  }
  if (isProd && !env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production');
  }

  cached = {
    ...env,
    jwtSecret: env.JWT_SECRET ?? 'algoforge-dev-secret-change-me-please',
    cookieSecure: env.COOKIE_SECURE ?? isProd,
    isProd,
    isTest,
  };
  return cached;
}

/** Test helper: clear cached env so a test can re-load with overrides. */
export function resetEnvCache() {
  cached = null;
}
