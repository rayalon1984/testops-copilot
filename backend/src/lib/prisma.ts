import { PrismaClient } from '@prisma/client';
import { config } from '../config';

// Prevent multiple instances of Prisma Client in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// For SQLite (demo/dev), let Prisma resolve the schema's built-in file: URL
// relative to the schema file — avoids cwd path resolution mismatches.
// For PostgreSQL (production), override with the env-configured URL + pool params.
function createPrismaClient(): PrismaClient {
  if (config.database.url.startsWith('postgres')) {
    return new PrismaClient({
      datasources: { db: { url: config.database.url } },
    });
  }
  return new PrismaClient();
}

export const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}