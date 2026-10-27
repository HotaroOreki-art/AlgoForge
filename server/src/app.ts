import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { loadEnv } from './config/env.ts';
import { logger } from './config/logger.ts';
import { connectDb, dbState, usingInMemoryDb } from './db/connect.ts';
import { errorHandler, notFoundHandler } from './middleware/index.ts';
import { authRouter } from './routes/auth.ts';
import { platformsRouter } from './routes/platforms.ts';
import { dashboardRouter } from './routes/dashboard.ts';
import { problemsRouter } from './routes/problems.ts';
import { notesRouter } from './routes/notes.ts';
import { graphRouter } from './routes/graph.ts';
import { recommendationsRouter } from './routes/recommendations.ts';
import { workspaceRouter } from './routes/workspace.ts';
import { ensureGraphSeeded } from './services/graph/service.ts';
import { CodeforcesClient, codeforcesClient } from './services/codeforces/client.ts';

/**
 * Builds the Express app. Does not listen — used by the local server, the
 * Vercel serverless adapter, and the integration tests alike.
 */
export interface AppDeps {
  /** Override the Codeforces client (tests inject a fake fetcher). */
  codeforcesClient?: CodeforcesClient;
}

export function createApp(deps: AppDeps = {}) {
  const env = loadEnv();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.locals.codeforcesClient = deps.codeforcesClient ?? codeforcesClient;

  if (env.CLIENT_ORIGIN) {
    app.use(
      cors({
        origin: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
        credentials: true,
      }),
    );
  }

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Ensure DB connection + seed graph for every request (no-op once connected).
  app.use(async (_req, res, next) => {
    try {
      await connectDb();
      await ensureGraphSeeded();
      next();
    } catch (err) {
      logger.error({ err }, 'database unavailable');
      res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'The database is not reachable right now. Please try again shortly.' } });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: dbState() === 'connected',
      service: 'algoforge-api',
      db: dbState(),
      inMemoryDb: usingInMemoryDb(),
      env: env.NODE_ENV,
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/platforms', platformsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/problems', problemsRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/graph', graphRouter);
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/workspace', workspaceRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
