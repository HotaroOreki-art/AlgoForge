import mongoose from 'mongoose';
import { loadEnv } from '../config/env.ts';
import { logger } from '../config/logger.ts';

/**
 * Connection handling that is safe for both a long-running local server and a
 * serverless function (where the module may be re-used across invocations).
 *
 * - With MONGODB_URI set: connect to that cluster and cache the promise.
 * - Without it (dev/test only): spin up mongodb-memory-server so the product
 *   can be developed and tested without a local MongoDB installation.
 */

let connectPromise: Promise<typeof mongoose> | null = null;
let memoryServer: { stop: () => Promise<boolean>; getUri: () => string } | null = null;

export async function connectDb(uriOverride?: string): Promise<typeof mongoose> {
  if (connectPromise) return connectPromise;

  const env = loadEnv();
  let uri = uriOverride ?? env.MONGODB_URI;

  connectPromise = (async () => {
    if (!uri) {
      if (env.isProd) throw new Error('MONGODB_URI is required in production');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      // In development, keep the data on disk (gitignored) so hot reloads don't
      // wipe accounts and imports. Tests set DEV_DB_PATH="" to stay ephemeral.
      const dbPath = env.DEV_DB_PATH || undefined;
      if (dbPath) {
        const { mkdirSync } = await import('node:fs');
        mkdirSync(dbPath, { recursive: true });
      }
      const server = await MongoMemoryServer.create(
        dbPath ? { instance: { dbPath, storageEngine: 'wiredTiger', port: env.DEV_DB_PORT } } : undefined,
      );
      memoryServer = server;
      uri = server.getUri('algoforge');
      logger.warn(
        { uri, dbPath: dbPath ?? null },
        dbPath
          ? 'MONGODB_URI not set — using a local MongoDB stored in DEV_DB_PATH (development only)'
          : 'MONGODB_URI not set — using in-memory MongoDB (data is NOT persisted between restarts)',
      );
    }
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: env.isProd ? 12000 : 20000,
      maxPoolSize: env.isProd ? 5 : 10,
      family: 4,
    });
    logger.info({ host: conn.connection.host, db: conn.connection.name }, 'MongoDB connected');
    return conn;
  })();

  try {
    return await connectPromise;
  } catch (err) {
    connectPromise = null;
    throw err;
  }
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  connectPromise = null;
}

export function dbState(): 'disconnected' | 'connected' | 'connecting' | 'disconnecting' | 'unknown' {
  switch (mongoose.connection.readyState) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'unknown';
  }
}

export function usingInMemoryDb(): boolean {
  return memoryServer !== null;
}
