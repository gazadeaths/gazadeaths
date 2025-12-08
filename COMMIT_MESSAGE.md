# feat: migrate Prisma ORM from v6 to v7 + update all packages

## Overview
Complete migration from Prisma ORM v6.19.0 to v7.1.0, implementing Direct TCP connections via the `@prisma/adapter-pg` adapter as recommended for Prisma v7. Also updated all packages to latest versions.

## Changes

### Dependencies (package.json)
**Prisma Migration:**
- Upgraded `prisma` from ^6.19.0 to ^7.1.0
- Upgraded `@prisma/client` from ^6.19.0 to ^7.1.0
- Upgraded `@prisma/adapter-pg` from ^7.0.0 to ^7.1.0

**All Package Updates:**
- `@clerk/nextjs` ^6.35.2 → ^6.36.0
- `@clerk/themes` ^2.4.37 → ^2.4.42
- `@types/react` ^19.2.6 → ^19.2.7
- `@vercel/analytics` ^1.5.0 → ^1.6.1
- `eslint-config-next` 16.0.3 → 16.0.7
- `lucide-react` ^0.554.0 → ^0.556.0
- `next` 16.0.3 → 16.0.7
- `react` 19.2.0 → 19.2.1
- `react-dom` 19.2.0 → 19.2.1
- `react-hook-form` ^7.66.1 → ^7.68.0
- `shadcn` ^3.5.0 → ^3.5.1
- `svix` ^1.81.0 → ^1.82.0
- `tsx` ^4.20.6 → ^4.21.0
- `zod` ^4.1.12 → ^4.1.13

### Schema Changes (prisma/schema.prisma)
- Changed generator provider from `prisma-client-js` to `prisma-client`
- Added `output = "./generated/prisma"` to generator block
- Removed `url = env("DATABASE_URL")` from datasource block (moved to prisma.config.ts)

### New Configuration (prisma.config.ts)
Created new Prisma v7 configuration file at project root:
- Defines schema and migrations paths
- Centralized datasource URL configuration
- Uses `dotenv/config` for environment variable loading

### Client Refactor (src/lib/prisma.ts)
- Updated import path from `@prisma/client` to local generated client
- Implemented `PrismaPg` adapter for Direct TCP connections
- Client now uses adapter pattern: `new PrismaClient({ adapter })`

### Path Alias (tsconfig.json)
Added `@prisma/*` path alias mapping to `./prisma/generated/prisma/*`
- Allows clean imports: `import { PrismaClient } from '@prisma/client'`
- Same import syntax as before, but now points to generated client

### ESLint Configuration (eslint.config.mjs)
- Added `prisma/generated/**` to ignores to prevent linting generated files

### Cursor Rules (.cursorrules)
- Added "Always Work on Feature Branches" rule to Git Workflow section
- Feature branches from main are now required before starting any work

### Hydration Fix (src/components/PublicNavbar.tsx)
- Fixed Radix UI hydration mismatch with Sheet component
- Added mounted state to defer Sheet rendering until after hydration
- Prevents `aria-controls` ID mismatch between server and client

## Technical Details

### Prisma v7 Key Changes
1. **Direct TCP by Default**: v7 uses native database adapters instead of the query engine binary
2. **New Client Generator**: `prisma-client` replaces `prisma-client-js`
3. **Configuration File**: `prisma.config.ts` centralizes CLI and datasource configuration
4. **Adapter Pattern**: Database connections now use typed adapters like `PrismaPg`

### Accelerate Status
```
Direct TCP is the recommended default for Prisma v7.
No Prisma Accelerate detected in this project - Direct TCP migration applied.
```

## Testing Checklist
- [x] `npm install` completes successfully
- [x] `prisma generate` creates client in ./prisma/generated/prisma
- [x] `npm run lint` passes with no errors
- [ ] `npm run build` completes (requires DATABASE_URL)
- [ ] `prisma migrate dev` works (requires DATABASE_URL)
- [ ] Application queries work correctly

## Impact
- **Non-breaking**: Import paths remain `@prisma/client` (via path alias to generated client)
- **Performance**: Direct TCP connections may improve latency vs query engine
- **Compatibility**: Requires Node.js ≥ 20.19 and TypeScript ≥ 5.4
