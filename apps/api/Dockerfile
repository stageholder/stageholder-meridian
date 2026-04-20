FROM oven/bun:1.3.6 AS pruner
WORKDIR /app
RUN bun add -g turbo@^2
COPY . .
RUN turbo prune api --docker

FROM oven/bun:1.3.6 AS installer
WORKDIR /app
# Private @stageholder/* packages resolve via npm.pkg.github.com — the PAT
# travels in as a build-arg secret, wired to the committed .npmrc's
# ${GITHUB_PACKAGES_TOKEN} reference. The ARG is scoped to this stage so
# the token never leaks into the final runtime image layer.
ARG GITHUB_PACKAGES_TOKEN
ENV GITHUB_PACKAGES_TOKEN=$GITHUB_PACKAGES_TOKEN
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
COPY .npmrc ./.npmrc
RUN bun install --ignore-scripts
# Scrub the token reference after install so the installer stage itself
# can't be used to exfiltrate it. The runner stage doesn't inherit ARG.
RUN rm -f ./.npmrc

FROM oven/bun:1.3.6 AS builder
WORKDIR /app
RUN bun add -g turbo@^2
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN turbo build --filter=api --no-daemon

FROM oven/bun:1.3.6-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=bun:bun /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=bun:bun /app/apps/api/package.json ./apps/api/package.json
USER bun
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD bun -e "fetch('http://localhost:4000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "run", "dist/main.js"]
