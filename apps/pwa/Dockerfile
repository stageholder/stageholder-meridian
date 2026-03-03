FROM oven/bun:1 AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock turbo.json ./
COPY apps/pwa/package.json apps/pwa/
COPY packages/core/package.json packages/core/
COPY packages/offline/package.json packages/offline/
COPY packages/ui/package.json packages/ui/
RUN bun install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/pwa && bun run build

# Runtime — Node for Next.js standalone
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/pwa/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/pwa/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/pwa/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
