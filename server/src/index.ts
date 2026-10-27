import app from './app.ts';
import { loadEnv } from './config/env.ts';
import { logger } from './config/logger.ts';
import { connectDb, disconnectDb } from './db/connect.ts';
import { ensureGraphSeeded } from './services/graph/service.ts';

async function main() {
  const env = loadEnv();
  await connectDb();
  await ensureGraphSeeded();
  const server = app.listen(env.SERVER_PORT, '0.0.0.0', () => {
    logger.info({ port: env.SERVER_PORT, env: env.NODE_ENV }, 'AlgoForge API listening');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
