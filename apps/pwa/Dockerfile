FROM oven/bun:1.3.6 AS pruner
WORKDIR /app
RUN bun add -g turbo@^2
COPY . .
RUN turbo prune pwa --docker

FROM oven/bun:1.3.6 AS installer
WORKDIR /app
# Private @stageholder/* packages resolve via npm.pkg.github.com — the PAT
# travels in as a build-arg, wired to the committed .npmrc's
# ${GITHUB_PACKAGES_TOKEN} reference. ARG scope ends at this stage so
# the token never lands in the runtime image layers.
ARG GITHUB_PACKAGES_TOKEN
ENV GITHUB_PACKAGES_TOKEN=$GITHUB_PACKAGES_TOKEN
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
COPY .npmrc ./.npmrc
RUN bun install --ignore-scripts
RUN rm -f ./.npmrc

FROM oven/bun:1.3.6 AS builder
WORKDIR /app
RUN bun add -g turbo@^2
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# NEXT_PUBLIC_* vars are inlined by Next.js at build time — must flow in
# here, not at runtime. Cloud Run's env vars only affect the server.
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_HUB_URL
ENV NEXT_PUBLIC_HUB_URL=$NEXT_PUBLIC_HUB_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_IDENTITY_ISSUER_URL
ENV NEXT_PUBLIC_IDENTITY_ISSUER_URL=$NEXT_PUBLIC_IDENTITY_ISSUER_URL
ENV NEXT_OUTPUT=standalone
RUN turbo build --filter=pwa --no-daemon && \
    if [ ! -d "/app/apps/pwa/.next/standalone" ]; then \
      echo "ERROR: Next.js standalone build failed"; exit 1; \
    fi

FROM oven/bun:1.3.6-slim AS runner
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
