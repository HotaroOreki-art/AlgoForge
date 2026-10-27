import { afterAll, beforeAll, inject } from 'vitest';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../src/db/connect.ts';
import { ensureGraphSeeded } from '../src/services/graph/service.ts';

/**
 * Integration-test harness: every test file gets a fresh database on the
 * shared in-memory server. Pure unit tests simply don't touch mongoose.
 */
let dbName = '';

beforeAll(async () => {
  const base = inject('mongoBaseUri');
  dbName = `af_test_${Math.random().toString(36).slice(2, 10)}`;
  await connectDb(`${base}${dbName}`);
  await ensureGraphSeeded();
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db?.dropDatabase();
  }
  await disconnectDb();
});
