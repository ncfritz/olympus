# The Next.js apps: the Minerva console now, the site when it is imported
# (ADR 0011, 0019). docker-bake.hcl passes the package, its directory and
# its public build-time settings. The build context is the repository root.
#
# `output: "standalone"` in the app's next.config makes `next build` write
# a server with only the node_modules it uses. It is JavaScript only, so
# the build runs on the build machine's platform and the runtime copies it.

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

# ---- Install and build.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS build
ARG APP
ARG PNPM_VERSION
# Inlined into the browser bundle by `next build`: public, and the same on
# every host (a relative URL where it can be).
ARG NEXT_PUBLIC_API_URL=""
ENV TURBO_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    npm_config_store_dir=/pnpm/store
RUN npm install --global --no-fund --no-audit pnpm@${PNPM_VERSION}
WORKDIR /repo
COPY --from=prune /pruned/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile
COPY --from=prune /pruned/full/ .
RUN pnpm turbo run build --filter="${APP}..."

# ---- What runs.
FROM node:${NODE_VERSION}-alpine AS runtime
ARG APP_DIR
ARG PORT=3000
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=${PORT}
WORKDIR /app
# The standalone tree mirrors the workspace: server.js is under APP_DIR.
# Static assets and public/ are not part of it and are copied beside it.
COPY --from=build /repo/${APP_DIR}/.next/standalone ./
COPY --from=build /repo/${APP_DIR}/.next/static ./${APP_DIR}/.next/static
COPY --from=build /repo/${APP_DIR}/public ./${APP_DIR}/public
WORKDIR /app/${APP_DIR}
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1
CMD ["node", "server.js"]

ARG APP
ARG GIT_REVISION=unknown
LABEL org.opencontainers.image.title="${APP}" \
      org.opencontainers.image.source="https://github.com/ncfritz/olympus" \
      org.opencontainers.image.revision="${GIT_REVISION}"
