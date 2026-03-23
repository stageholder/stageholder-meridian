FROM oven/bun:1 AS pruner
WORKDIR /app
RUN bun add -g turbo@^2
COPY . .
RUN turbo prune pwa --docker

FROM oven/bun:1 AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --ignore-scripts

FROM oven/bun:1 AS builder
WORKDIR /app
RUN bun add -g turbo@^2
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_OUTPUT=standalone
RUN turbo build --filter=pwa --no-daemon && \
    if [ ! -d "/app/apps/pwa/.next/standalone" ]; then \
      echo "ERROR: Next.js standalone build failed"; exit 1; \
    fi

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
COPY --from=builder --chown=bun:bun /app/apps/pwa/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/apps/pwa/.next/static ./apps/pwa/.next/static
COPY --from=builder --chown=bun:bun /app/apps/pwa/public ./apps/pwa/public
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "run", "apps/pwa/server.js"]
