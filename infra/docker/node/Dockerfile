# The Node services: the API and the agents (ADR 0011, 0019). One file for
# all of them; /docker-bake.hcl passes the package and what else it needs.
# The build context is the repository root (see /.dockerignore).
#
# TypeScript is built once, on the build machine's platform. Production
# dependencies are installed in a stage on the image's own platform, so
# native modules (sharp, better-sqlite3) match the CPU the image runs on:
# the asset agent is built for the NAS's amd64 as well as arm64.

ARG NODE_VERSION=26.9.0
ARG PNPM_VERSION=10.34.5
ARG TURBO_VERSION=2.11.1

# ---- The package and the workspace packages it depends on, and nothing else.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS prune
ARG APP
ARG TURBO_VERSION
ENV TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo
COPY . .
# turbo prune leaves the root .npmrc behind, so it is copied after.
RUN test -n "${APP}" || { echo "APP (the package name) is required" >&2; exit 1; } \
    && npx --yes turbo@${TURBO_VERSION} prune "${APP}" --docker --out-dir /pruned \
    && cp .npmrc /pruned/json/.npmrc

# ---- Install everything and build, natively.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS build
ARG APP
ARG PNPM_VERSION
ENV TURBO_TELEMETRY_DISABLED=1 \
    npm_config_store_dir=/pnpm/store
RUN npm install --global --no-fund --no-audit pnpm@${PNPM_VERSION}
WORKDIR /repo
# Manifests and lockfile first, so a source change reuses the install.
COPY --from=prune /pruned/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile
COPY --from=prune /pruned/full/ .
RUN pnpm turbo run build --filter="${APP}..."
# What the next stage needs is sources and build output; its installed
# modules are for this platform, not the image's.
RUN find . -name node_modules -prune -exec rm -rf {} +

# ---- Production dependencies, on the image's platform.
FROM node:${NODE_VERSION}-alpine AS deploy
ARG APP
ARG PNPM_VERSION
ENV npm_config_store_dir=/pnpm/store
# For a native module without a prebuilt binary for this platform. Alpine
# packages follow the Alpine release of the pinned Node image; pinning
# their versions too breaks the build whenever Alpine's repository moves on.
# hadolint ignore=DL3018
RUN apk add --no-cache python3 make g++ openssl \
    && npm install --global --no-fund --no-audit pnpm@${PNPM_VERSION}
WORKDIR /repo
COPY --from=build /repo .
# A step a package needs after its production install, on this platform
# too: Prisma generating its client and engine for the Minerva agent.
ARG POST_DEPLOY=""
# The store is content-addressed, so both platforms can share it. (The
# `cd` is in the optional step only, so it is not a WORKDIR.)
# hadolint ignore=DL3003
# `deploy` copies a workspace dependency straight out of the build
# context and keeps its mode, so a file the developer's umask left at 0600
# arrives unreadable to the `node` user the runtime drops to. Normalised
# here, in the same layer, rather than after the COPY, which would write a
# second copy of the whole tree.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm --filter="${APP}" deploy --prod --legacy /out \
    && if [ -n "${POST_DEPLOY}" ]; then cd /out && sh -c "${POST_DEPLOY}"; fi \
    && chmod -R a+rX /out

# ---- What runs.
FROM node:${NODE_VERSION}-alpine AS runtime
# Extra system packages, e.g. ffmpeg and HandBrake for the asset agent.
ARG RUNTIME_PACKAGES=""
# hadolint ignore=DL3018
RUN if [ -n "${RUNTIME_PACKAGES}" ]; then apk add --no-cache ${RUNTIME_PACKAGES}; fi
# The internal CA's roots, for an agent that calls internal HTTPS hosts;
# the file comes with the package (its `files`).
ARG EXTRA_CA_CERTS=""
ENV NODE_ENV=production \
    NODE_EXTRA_CA_CERTS=${EXTRA_CA_CERTS}
WORKDIR /app
# Owned by root and readable but not writable by the service: what it
# writes goes to volumes.
COPY --from=deploy /out .
USER node
# LISTEN_PORT comes from the environment at run time.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${LISTEN_PORT:-3100}/health" || exit 1
CMD ["node", "dist/main.js"]

ARG APP
ARG GIT_REVISION=unknown
LABEL org.opencontainers.image.title="${APP}" \
      org.opencontainers.image.source="https://github.com/ncfritz/olympus" \
      org.opencontainers.image.revision="${GIT_REVISION}"
