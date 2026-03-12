FROM oven/bun:1 AS base

# Prune the monorepo for the pwa workspace
FROM base AS pruner
WORKDIR /app
RUN bun add -g turbo
COPY . .
RUN turbo prune pwa --docker

# Install dependencies then build
FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN bun run --filter pwa build

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
