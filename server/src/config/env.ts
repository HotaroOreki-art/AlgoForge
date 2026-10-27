import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

function applyEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** Load repo-root / server `.env` for local runs. Skip in tests so Atlas is never used. */
function loadLocalEnvFiles() {
  if (process.env.NODE_ENV === 'test') return;
  const here = fileURLToPath(new URL('.', import.meta.url));
  applyEnvFile(resolve(here, '../../../.env'));
  applyEnvFile(resolve(here, '../../.env'));
}

loadLocalEnvFiles();

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
  // Development only: where the fallback MongoDB keeps its files so restarts
  // don't lose data. Empty string = purely in-memory (tests use this).
  DEV_DB_PATH: z.string().optional(),
  DEV_DB_PORT: z.coerce.number().int().positive().optional(),
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

  // Development default: persist the fallback DB under <repo>/.data/mongo (gitignored).
  const devDbPath =
    env.DEV_DB_PATH !== undefined
      ? env.DEV_DB_PATH
      : env.NODE_ENV === 'development'
        ? fileURLToPath(new URL('../../../.data/mongo', import.meta.url))
        : '';

  cached = {
    ...env,
    DEV_DB_PATH: devDbPath,
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
