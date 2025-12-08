import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // DATABASE_URL is required for migrations/deploy but optional for generate
    // Empty string fallback allows `prisma generate` to work in CI without a DB connection
    url: process.env.DATABASE_URL ?? '',
  },
})
