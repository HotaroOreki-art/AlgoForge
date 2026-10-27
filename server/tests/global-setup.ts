import { MongoMemoryServer } from 'mongodb-memory-server';
import type { GlobalSetupContext } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoBaseUri: string;
  }
}

/**
 * One in-memory MongoDB for the whole test run. Each test file connects to its
 * own database name so files do not interfere.
 */
export default async function globalSetup({ provide }: GlobalSetupContext) {
  const server = await MongoMemoryServer.create();
  provide('mongoBaseUri', server.getUri());
  return async () => {
    await server.stop();
  };
}
