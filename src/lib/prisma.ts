import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const dbUrl = process.env.DATABASE_URL || '';
const isAccelerate = dbUrl.startsWith('prisma://') || dbUrl.startsWith('prisma+postgres://');

function createPrismaClient(): PrismaClient {
  const logConfig = process.env.NODE_ENV === 'development' ? ['error', 'warn'] as const : ['error'] as const;

  if (isAccelerate) {
    return new PrismaClient({
      accelerateUrl: dbUrl,
      log: [...logConfig],
    });
  }

  const pool = new pg.Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: [...logConfig],
  });
}

export const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
