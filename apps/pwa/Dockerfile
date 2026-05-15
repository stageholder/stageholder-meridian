# ── Pruner: trim the monorepo to just the PWA + its workspace deps ──
FROM oven/bun:1.3.6 AS pruner
WORKDIR /app
RUN bun add -g turbo@^2
COPY . .
RUN turbo prune pwa --docker

# ── Installer: install only the pruned dep tree ──
FROM oven/bun:1.3.6 AS installer
WORKDIR /app
# Private @stageholder/* packages resolve via npm.pkg.github.com — PAT
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

# ── Builder: vite build → dist/ ──
FROM oven/bun:1.3.6 AS builder
WORKDIR /app
RUN bun add -g turbo@^2
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
ENV NODE_ENV=production
# VITE_* vars are inlined into the SPA bundle at build time. Cloud Run's
# runtime env vars CANNOT change these — they must flow in here. Public
# only; no secrets ship in the client bundle.
ARG VITE_IDENTITY_ISSUER_URL
ENV VITE_IDENTITY_ISSUER_URL=$VITE_IDENTITY_ISSUER_URL
ARG VITE_IDENTITY_CLIENT_ID
ENV VITE_IDENTITY_CLIENT_ID=$VITE_IDENTITY_CLIENT_ID
ARG VITE_PUBLIC_APP_URL
ENV VITE_PUBLIC_APP_URL=$VITE_PUBLIC_APP_URL
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_HUB_WEB_URL
ENV VITE_HUB_WEB_URL=$VITE_HUB_WEB_URL
RUN turbo build --filter=pwa --no-daemon && \
    if [ ! -d "/app/apps/pwa/dist" ]; then \
      echo "ERROR: Vite build did not produce apps/pwa/dist/"; exit 1; \
    fi

# ── Runner: nginx static-serve ──
FROM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/apps/pwa/dist/ ./
COPY apps/pwa/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --spider --quiet http://localhost:4001/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
