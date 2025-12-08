import { PrismaClient } from '@prisma/client'

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// For Prisma v7 with Accelerate, provide accelerateUrl
export const prisma = global.prisma || new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
