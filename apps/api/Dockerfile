FROM oven/bun:1 AS base

# Prune the monorepo for the api workspace
FROM base AS pruner
WORKDIR /app
RUN bun add -g turbo
COPY . .
RUN turbo prune api --docker

# Install dependencies then build
FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN cd apps/api && bun run build

# Runtime — Node for NestJS compatibility
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./root_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./

USER nestjs

EXPOSE 4000
CMD ["node", "dist/main"]
